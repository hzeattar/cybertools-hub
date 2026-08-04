import json
import os
import re
import tempfile
from contextlib import contextmanager
from typing import Any

import jwt
import psycopg
import requests
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from pydantic import BaseModel, Field


EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1024"))
MAX_CHARS_PER_CHUNK = int(os.getenv("RAG_CHUNK_CHARS", "1800"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "180"))

app = FastAPI(title="CyberTools RAG API", version="0.1.0")


class QueryRequest(BaseModel):
    file_id: str = Field(min_length=1)
    query: str = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=20)
    entity_id: str | None = None


def env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"{name} is required")
    return value


def db_connect_kwargs() -> dict[str, Any]:
    return {
        "host": env("DB_HOST"),
        "port": int(env("DB_PORT", "5432")),
        "dbname": env("POSTGRES_DB"),
        "user": env("POSTGRES_USER"),
        "password": env("POSTGRES_PASSWORD"),
    }


@contextmanager
def db_conn():
    with psycopg.connect(**db_connect_kwargs()) as conn:
        yield conn


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"


def require_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, env("JWT_SECRET"), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc

    user_id = payload.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid bearer token subject")
    return user_id


def init_db() -> None:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("create extension if not exists vector")
            cur.execute(
                f"""
                create table if not exists cybertools_rag_chunks (
                    id bigserial primary key,
                    user_id text not null,
                    entity_id text,
                    file_id text not null,
                    filename text not null,
                    page integer,
                    chunk_index integer not null,
                    content text not null,
                    embedding vector({EMBEDDING_DIMENSION}) not null,
                    metadata jsonb not null default '{{}}'::jsonb,
                    created_at timestamptz not null default now()
                )
                """
            )
            cur.execute(
                """
                create index if not exists cybertools_rag_chunks_owner_file_idx
                on cybertools_rag_chunks (user_id, file_id)
                """
            )
            cur.execute(
                """
                create index if not exists cybertools_rag_chunks_entity_idx
                on cybertools_rag_chunks (user_id, entity_id, file_id)
                """
            )
            cur.execute(
                """
                create index if not exists cybertools_rag_chunks_embedding_idx
                on cybertools_rag_chunks using ivfflat (embedding vector_cosine_ops)
                with (lists = 100)
                """
            )
        conn.commit()


@app.on_event("startup")
def on_startup() -> None:
    if os.getenv("CYBERTOOLS_RAG_SKIP_DB_INIT") == "true":
        return
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "UP"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "UP"}


def embed_text(text: str, input_type: str) -> list[float]:
    base_url = env("RAG_OPENAI_BASEURL").rstrip("/")
    api_key = env("RAG_OPENAI_API_KEY")
    model = env("EMBEDDINGS_MODEL", "nvidia/nv-embedqa-e5-v5")
    response = requests.post(
        f"{base_url}/embeddings",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "input": text, "input_type": input_type},
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    embedding = payload["data"][0]["embedding"]
    if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIMENSION:
        raise RuntimeError("Unexpected embedding response dimension")
    return [float(value) for value in embedding]


def extract_text(upload: UploadFile, path: str) -> tuple[bool, list[tuple[int | None, str]]]:
    name = (upload.filename or "").lower()
    content_type = (upload.content_type or "").lower()

    if content_type.startswith("text/") or name.endswith((".txt", ".md", ".csv", ".json", ".log")):
        with open(path, "rb") as handle:
            text = handle.read().decode("utf-8", errors="replace")
        return True, [(None, text)]

    if content_type == "application/pdf" or name.endswith(".pdf"):
        try:
            reader = PdfReader(path)
            pages = []
            for index, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append((index, text))
            return True, pages
        except PdfReadError as exc:
            raise HTTPException(status_code=400, detail="PDF could not be parsed") from exc

    return False, []


def chunk_text(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + MAX_CHARS_PER_CHUNK)
        chunks.append(normalized[start:end])
        if end >= len(normalized):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


@app.post("/embed")
def embed_document(
    user_id: str = Depends(require_user_id),
    file_id: str = Form(...),
    entity_id: str | None = Form(default=None),
    storage_metadata: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        known_type, pages = extract_text(file, tmp_path)
        if not known_type:
            return {"status": True, "known_type": False}

        parsed_storage_metadata: dict[str, Any] = {}
        if storage_metadata:
            try:
                parsed_storage_metadata = json.loads(storage_metadata)
            except json.JSONDecodeError:
                parsed_storage_metadata = {}

        rows: list[tuple[Any, ...]] = []
        chunk_index = 0
        for page, text in pages:
            for chunk in chunk_text(text):
                embedding = embed_text(chunk, "passage")
                metadata = {
                    "source": file.filename or file_id,
                    "page": page,
                    "storage": parsed_storage_metadata,
                }
                rows.append(
                    (
                        user_id,
                        entity_id,
                        file_id,
                        file.filename or file_id,
                        page,
                        chunk_index,
                        chunk,
                        vector_literal(embedding),
                        json.dumps(metadata),
                    )
                )
                chunk_index += 1

        if not rows:
            return {"status": False, "known_type": True, "message": "No text extracted"}

        with db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "delete from cybertools_rag_chunks where user_id = %s and file_id = %s",
                    (user_id, file_id),
                )
                cur.executemany(
                    """
                    insert into cybertools_rag_chunks
                    (user_id, entity_id, file_id, filename, page, chunk_index, content, embedding, metadata)
                    values (%s, %s, %s, %s, %s, %s, %s, %s::vector, %s::jsonb)
                    """,
                    rows,
                )
            conn.commit()

        return {"status": True, "known_type": True, "chunks": len(rows)}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/text")
def parse_document_text(
    user_id: str = Depends(require_user_id),
    file_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        known_type, pages = extract_text(file, tmp_path)
        if not known_type:
            raise HTTPException(status_code=400, detail="File type is not supported for text parsing")
        text = "\n\n".join(text for _page, text in pages).strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text extracted")
        return {"text": text, "file_id": file_id}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/query")
def query_document(payload: QueryRequest, user_id: str = Depends(require_user_id)) -> list[list[Any]]:
    embedding = embed_text(payload.query, "query")
    query_vector = vector_literal(embedding)
    params: list[Any] = [query_vector, user_id, payload.file_id]
    entity_filter = ""
    if payload.entity_id:
        entity_filter = "and entity_id = %s"
        params.append(payload.entity_id)
    params.extend([query_vector, payload.k])

    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                select filename, page, content, metadata, embedding <=> %s::vector as distance
                from cybertools_rag_chunks
                where user_id = %s and file_id = %s {entity_filter}
                order by embedding <=> %s::vector
                limit %s
                """,
                params,
            )
            rows = cur.fetchall()

    results: list[list[Any]] = []
    for filename, page, content, metadata, distance in rows:
        source = metadata.get("source") if isinstance(metadata, dict) else filename
        results.append(
            [
                {
                    "page_content": content,
                    "metadata": {"source": source or filename, "page": page},
                },
                float(distance),
            ]
        )
    return results


@app.get("/documents/{file_id}/context")
def document_context(file_id: str, user_id: str = Depends(require_user_id)) -> str:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select content
                from cybertools_rag_chunks
                where user_id = %s and file_id = %s
                order by chunk_index asc
                """,
                (user_id, file_id),
            )
            rows = cur.fetchall()
    return "\n\n".join(row[0] for row in rows)


@app.delete("/documents")
def delete_documents(file_ids: list[str], user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    if not file_ids:
        return {"status": True, "deleted": 0}
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "delete from cybertools_rag_chunks where user_id = %s and file_id = any(%s)",
                (user_id, file_ids),
            )
            deleted = cur.rowcount
        conn.commit()
    return {"status": True, "deleted": deleted}

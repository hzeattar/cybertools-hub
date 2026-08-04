import importlib
import os
import sys
from pathlib import Path

import jwt
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def load_app(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("DB_HOST", "localhost")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "postgres")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres")
    monkeypatch.setenv("RAG_OPENAI_BASEURL", "https://example.test/v1")
    monkeypatch.setenv("RAG_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("EMBEDDINGS_MODEL", "nvidia/nv-embedqa-e5-v5")
    monkeypatch.setenv("CYBERTOOLS_RAG_SKIP_DB_INIT", "true")
    import app.main as main

    return importlib.reload(main)


def test_health_does_not_require_db(monkeypatch):
    main = load_app(monkeypatch)
    client = TestClient(main.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_require_user_id_accepts_librechat_token(monkeypatch):
    main = load_app(monkeypatch)
    token = jwt.encode({"id": "user-123"}, os.environ["JWT_SECRET"], algorithm="HS256")
    user_id = main.require_user_id(f"Bearer {token}")
    assert user_id == "user-123"


def test_chunk_text_keeps_overlap(monkeypatch):
    main = load_app(monkeypatch)
    monkeypatch.setattr(main, "MAX_CHARS_PER_CHUNK", 10)
    monkeypatch.setattr(main, "CHUNK_OVERLAP", 3)
    chunks = main.chunk_text("abcdefghijklmnopqrstuvwxyz")
    assert chunks[:2] == ["abcdefghij", "hijklmnopq"]


def test_nvidia_embedding_payload_uses_input_type(monkeypatch):
    main = load_app(monkeypatch)
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"embedding": [0.1] * main.EMBEDDING_DIMENSION}]}

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return FakeResponse()

    monkeypatch.setattr(main.requests, "post", fake_post)
    embedding = main.embed_text("hello", "query")
    assert len(embedding) == main.EMBEDDING_DIMENSION
    assert calls[0]["json"]["input"] == "hello"
    assert calls[0]["json"]["input_type"] == "query"


def test_text_endpoint_extracts_utf8(monkeypatch):
    main = load_app(monkeypatch)
    client = TestClient(main.app)
    token = jwt.encode({"id": "user-123"}, os.environ["JWT_SECRET"], algorithm="HS256")
    response = client.post(
        "/text",
        headers={"Authorization": f"Bearer {token}"},
        data={"file_id": "file-123"},
        files={"file": ("note.txt", "CyberTools marker text".encode("utf-8"), "text/plain")},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "CyberTools marker text"

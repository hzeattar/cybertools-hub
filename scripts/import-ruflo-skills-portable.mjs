import path from 'node:path';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';

const SOURCE_OWNER = 'ruvnet';
const SOURCE_REPO = 'ruflo';
const SOURCE_PATH = '.agents/skills';
const DEFAULT_REF = '26c35b59b40a0a95b286ccf5ac675a15edcc995f';
const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const MAX_FILES = 1000;
const MAX_SKILLS = 500;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 4 * 1024 * 1024;
const MAX_SKILL_NAME_LENGTH = 64;
const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
const DOWNLOAD_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_ATTEMPTS = 3;

const sourceRef = process.env.RUFLO_SKILLS_REF?.trim() || DEFAULT_REF;
const targetRoot = path.resolve(
  process.env.RUFLO_SKILLS_OUTPUT_DIR || process.env.DEPLOYMENT_SKILLS_DIR || './skill',
);
const githubToken = process.env.RUFLO_GITHUB_TOKEN?.trim();
const manifestPath = path.join(targetRoot, '.ruflo-import-manifest.json');

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestHeaders({ json = false } = {}) {
  const headers = { 'User-Agent': 'CyberTools-Ruflo-Skills-Importer' };
  if (json) {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}

async function fetchWithRetry(url, { json = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: requestHeaders({ json }),
        signal: controller.signal,
        redirect: 'follow',
      });
      if (response.ok) {
        return response;
      }
      const detail = await response.text().catch(() => '');
      const retryable = response.status === 429 || response.status >= 500;
      const error = new Error(
        `Request failed (${response.status}) for ${url}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
      if (!retryable || attempt === REQUEST_ATTEMPTS) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === REQUEST_ATTEMPTS) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
    await sleep(500 * 2 ** (attempt - 1));
  }
  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { json: true });
  return response.json();
}

async function fetchBuffer(url) {
  const response = await fetchWithRetry(url);
  return Buffer.from(await response.arrayBuffer());
}

function encodePathSegments(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

async function resolveSourceTree() {
  const commit = await fetchJson(
    `${API_BASE}/repos/${SOURCE_OWNER}/${SOURCE_REPO}/commits/${encodePathSegments(sourceRef)}`,
  );
  const resolvedCommit = commit?.sha;
  let treeSha = commit?.commit?.tree?.sha;
  if (!resolvedCommit || !treeSha) {
    throw new Error('GitHub did not return a valid Ruflo commit/tree response');
  }

  for (const segment of SOURCE_PATH.split('/')) {
    const tree = await fetchJson(
      `${API_BASE}/repos/${SOURCE_OWNER}/${SOURCE_REPO}/git/trees/${encodeURIComponent(treeSha)}`,
    );
    if (tree?.truncated) {
      throw new Error(`GitHub truncated the tree while resolving ${SOURCE_PATH}`);
    }
    const next = tree?.tree?.find((entry) => entry.type === 'tree' && entry.path === segment);
    if (!next?.sha) {
      throw new Error(`Ruflo source path segment not found: ${segment}`);
    }
    treeSha = next.sha;
  }

  const skillTree = await fetchJson(
    `${API_BASE}/repos/${SOURCE_OWNER}/${SOURCE_REPO}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
  );
  if (skillTree?.truncated) {
    throw new Error('GitHub truncated the Ruflo skills tree; refusing a partial import');
  }
  if (!Array.isArray(skillTree?.tree)) {
    throw new Error('GitHub returned an invalid Ruflo skills tree');
  }
  return { resolvedCommit, entries: skillTree.tree };
}

function isSafeRelativePath(value) {
  if (!value || path.posix.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    return false;
  }
  return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

function discoverSkillPackages(entries) {
  const blobs = entries.filter((entry) => entry.type === 'blob');
  const skillRoots = blobs
    .filter((entry) => entry.path === 'SKILL.md' || entry.path.endsWith('/SKILL.md'))
    .map((entry) => (entry.path === 'SKILL.md' ? '' : path.posix.dirname(entry.path)));

  if (skillRoots.length === 0) {
    throw new Error('No SKILL.md files were found in the Ruflo source path');
  }
  if (skillRoots.length > MAX_SKILLS) {
    throw new Error(`Refusing to import ${skillRoots.length} skills; limit is ${MAX_SKILLS}`);
  }

  const uniqueRoots = [...new Set(skillRoots)].sort();
  const files = blobs.filter((entry) =>
    uniqueRoots.some((root) => (root ? entry.path.startsWith(`${root}/`) : !entry.path.includes('/'))),
  );
  if (files.length > MAX_FILES) {
    throw new Error(`Refusing to import ${files.length} files; limit is ${MAX_FILES}`);
  }

  let totalBytes = 0;
  for (const entry of files) {
    if (!isSafeRelativePath(entry.path)) {
      throw new Error(`Unsafe source path rejected: ${entry.path}`);
    }
    if (entry.mode === '120000') {
      throw new Error(`Symbolic links are not allowed in imported skills: ${entry.path}`);
    }
    if (!Number.isInteger(entry.size) || entry.size < 0) {
      throw new Error(`GitHub did not report a valid size for ${entry.path}`);
    }
    if (entry.size > MAX_SINGLE_FILE_BYTES) {
      throw new Error(`File exceeds ${MAX_SINGLE_FILE_BYTES} bytes: ${entry.path}`);
    }
    totalBytes += entry.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Ruflo skills total ${totalBytes} bytes; limit is ${MAX_TOTAL_BYTES}`);
  }
  return { skillRoots: uniqueRoots, files, totalBytes };
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractSimpleFrontmatterValue(block, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`^\\s*${escaped}\\s*:\\s*(.*?)\\s*$`, 'im'));
  if (!match) {
    return '';
  }
  const value = stripWrappingQuotes(match[1]);
  if (!value || value === '|' || value === '>' || value === '|-' || value === '>-') {
    return '';
  }
  return value;
}

function splitFirstFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) {
    return { block: '', body: normalized };
  }
  return {
    block: match[1],
    body: normalized.slice(match[0].length).replace(/^\n+/, ''),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function makeUniqueSkillName(root, rawName, usedNames) {
  const identity = root || rawName || 'ruflo-skill';
  let base = slugify(identity) || 'ruflo-skill';
  if (base.length > MAX_SKILL_NAME_LENGTH) {
    const suffix = createHash('sha256').update(identity).digest('hex').slice(0, 8);
    base = `${base.slice(0, MAX_SKILL_NAME_LENGTH - suffix.length - 1).replace(/-+$/g, '')}-${suffix}`;
  }
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }
  const suffix = createHash('sha256').update(`${identity}:${rawName}`).digest('hex').slice(0, 8);
  const unique = `${base.slice(0, MAX_SKILL_NAME_LENGTH - suffix.length - 1).replace(/-+$/g, '')}-${suffix}`;
  if (usedNames.has(unique)) {
    throw new Error(`Unable to derive a unique LibreChat skill name for ${root || rawName}`);
  }
  usedNames.add(unique);
  return unique;
}

function yamlDoubleQuoted(value) {
  return JSON.stringify(value);
}

function normalizeSkillMarkdown(markdown, sourcePath, root, usedNames) {
  const { block, body } = splitFirstFrontmatter(markdown);
  const rawName = extractSimpleFrontmatterValue(block, 'name');
  const heading = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() || '';
  const rawDescription =
    extractSimpleFrontmatterValue(block, 'description') ||
    extractSimpleFrontmatterValue(block, 'when-to-use');
  const label = heading || rawName || path.posix.basename(root) || 'Ruflo skill';
  const description = (
    rawDescription || `Ruflo agent skill for ${label}. Use it when the task matches this specialized workflow.`
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SKILL_DESCRIPTION_LENGTH);
  const name = makeUniqueSkillName(root, rawName, usedNames);

  if (!description) {
    throw new Error(`Unable to derive a skill description for ${sourcePath}`);
  }

  return {
    name,
    content: `---\nname: ${name}\ndescription: ${yamlDoubleQuoted(description)}\n---\n\n${body}`,
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function pathExists(value) {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

async function readPreviousManifest() {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.topLevelEntries) ? parsed : null;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Unable to read previous Ruflo import manifest: ${error.message}`);
  }
}

async function main() {
  console.log(`[ruflo-skills] Resolving ${SOURCE_OWNER}/${SOURCE_REPO}@${sourceRef}`);
  const { resolvedCommit, entries } = await resolveSourceTree();
  const { skillRoots, files, totalBytes } = discoverSkillPackages(entries);
  const tempRoot = path.join(targetRoot, `.ruflo-import-${process.pid}`);

  await mkdir(targetRoot, { recursive: true });
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });

  try {
    const downloaded = await mapWithConcurrency(files, DOWNLOAD_CONCURRENCY, async (entry) => {
      const rawPath = `${SOURCE_PATH}/${entry.path}`;
      const rawUrl = `${RAW_BASE}/${SOURCE_OWNER}/${SOURCE_REPO}/${resolvedCommit}/${encodePathSegments(rawPath)}`;
      const buffer = await fetchBuffer(rawUrl);
      if (buffer.length !== entry.size) {
        throw new Error(
          `Size mismatch for ${entry.path}: expected ${entry.size}, downloaded ${buffer.length}`,
        );
      }
      return { entry, buffer };
    });

    const usedNames = new Set();
    let normalizedSkillCount = 0;
    for (const record of downloaded) {
      const destination = path.join(tempRoot, ...record.entry.path.split('/'));
      await mkdir(path.dirname(destination), { recursive: true });
      if (record.entry.path === 'SKILL.md' || record.entry.path.endsWith('/SKILL.md')) {
        const root = record.entry.path === 'SKILL.md' ? '' : path.posix.dirname(record.entry.path);
        const normalized = normalizeSkillMarkdown(
          record.buffer.toString('utf8'),
          record.entry.path,
          root,
          usedNames,
        );
        await writeFile(destination, normalized.content, { mode: 0o644 });
        normalizedSkillCount += 1;
      } else {
        await writeFile(destination, record.buffer, { mode: 0o644 });
      }
    }

    if (normalizedSkillCount !== skillRoots.length) {
      throw new Error(`Expected ${skillRoots.length} skills but normalized ${normalizedSkillCount}`);
    }

    const topLevelEntries = [...new Set(files.map((entry) => entry.path.split('/')[0]))].sort();
    const previousManifest = await readPreviousManifest();
    const previouslyImported = new Set(previousManifest?.topLevelEntries ?? []);

    for (const entry of topLevelEntries) {
      const destination = path.join(targetRoot, entry);
      if ((await pathExists(destination)) && !previouslyImported.has(entry)) {
        throw new Error(`Refusing to overwrite an existing non-Ruflo skill path: ${entry}`);
      }
    }
    for (const entry of previouslyImported) {
      await rm(path.join(targetRoot, entry), { recursive: true, force: true });
    }
    for (const entry of topLevelEntries) {
      await rename(path.join(tempRoot, entry), path.join(targetRoot, entry));
    }

    const manifest = {
      schemaVersion: 3,
      source: `${SOURCE_OWNER}/${SOURCE_REPO}`,
      requestedRef: sourceRef,
      resolvedCommit,
      sourcePath: SOURCE_PATH,
      license: 'MIT',
      skills: skillRoots.length,
      files: files.length,
      totalBytes,
      portableFrontmatter: true,
      topLevelEntries,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const manifestStats = await stat(manifestPath);
    console.log(
      `[ruflo-skills] Imported ${skillRoots.length} portable skills (${files.length} files, ${totalBytes} bytes) from ${resolvedCommit}; manifest ${manifestStats.size} bytes`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[ruflo-skills] Import failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});

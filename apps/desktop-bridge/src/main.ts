import { invoke } from '@tauri-apps/api/core';
import './styles.css';

type AllowedRoot = {
  id: string;
  path: string;
  label: string;
  created_at: string;
};

type FileEntry = {
  name: string;
  relative_path: string;
  kind: 'file' | 'directory';
  size: number | null;
};

type BridgeStatus = {
  version: string;
  read_only: boolean;
  network_enabled: boolean;
  allowed_root_count: number;
};

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('Application root was not found');
}

app.innerHTML = `
  <section class="shell">
    <header>
      <div>
        <p class="eyebrow">CyberTools Local Companion</p>
        <h1>Desktop Bridge</h1>
        <p class="subtitle">Read-only local file access with explicit folder permissions.</p>
      </div>
      <span id="status" class="status">Loading…</span>
    </header>

    <section class="notice">
      <strong>Safe foundation mode</strong>
      <span>No write, delete, shell, process, or network access is enabled.</span>
    </section>

    <section class="controls">
      <button id="add-root" type="button">Choose allowed folder</button>
      <input id="search" type="search" placeholder="Search filenames in selected root" />
    </section>

    <section class="workspace">
      <aside>
        <h2>Allowed folders</h2>
        <div id="roots" class="list"></div>
      </aside>
      <article>
        <div class="article-header">
          <h2 id="current-title">Select an allowed folder</h2>
          <button id="up" class="secondary" type="button" disabled>Up</button>
        </div>
        <div id="entries" class="list"></div>
        <pre id="preview" hidden></pre>
      </article>
    </section>

    <p id="error" class="error" role="alert"></p>
  </section>
`;

const statusEl = document.querySelector<HTMLElement>('#status')!;
const rootsEl = document.querySelector<HTMLElement>('#roots')!;
const entriesEl = document.querySelector<HTMLElement>('#entries')!;
const previewEl = document.querySelector<HTMLPreElement>('#preview')!;
const errorEl = document.querySelector<HTMLElement>('#error')!;
const titleEl = document.querySelector<HTMLElement>('#current-title')!;
const addRootButton = document.querySelector<HTMLButtonElement>('#add-root')!;
const upButton = document.querySelector<HTMLButtonElement>('#up')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;

let roots: AllowedRoot[] = [];
let selectedRoot: AllowedRoot | null = null;
let currentRelativePath = '';
let searchTimer: number | undefined;

function showError(error: unknown) {
  errorEl.textContent = error instanceof Error ? error.message : String(error);
}

function clearError() {
  errorEl.textContent = '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

async function loadStatus() {
  const status = await invoke<BridgeStatus>('bridge_status');
  statusEl.textContent = status.read_only ? 'Read-only' : 'Restricted';
  statusEl.title = `Version ${status.version}; roots: ${status.allowed_root_count}`;
}

async function loadRoots() {
  roots = await invoke<AllowedRoot[]>('list_allowed_roots');
  rootsEl.innerHTML = '';
  for (const root of roots) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `list-item ${selectedRoot?.id === root.id ? 'selected' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(root.label)}</strong><small>${escapeHtml(root.path)}</small>`;
    button.addEventListener('click', () => selectRoot(root));
    rootsEl.append(button);
  }
  if (roots.length === 0) {
    rootsEl.innerHTML = '<p class="empty">No folder has been allowed yet.</p>';
  }
}

async function selectRoot(root: AllowedRoot) {
  selectedRoot = root;
  currentRelativePath = '';
  previewEl.hidden = true;
  await loadRoots();
  await loadDirectory();
}

async function loadDirectory() {
  if (!selectedRoot) {
    return;
  }
  clearError();
  searchInput.value = '';
  previewEl.hidden = true;
  const entries = await invoke<FileEntry[]>('list_directory', {
    rootId: selectedRoot.id,
    relativePath: currentRelativePath,
  });
  renderEntries(entries);
  titleEl.textContent = currentRelativePath
    ? `${selectedRoot.label} / ${currentRelativePath}`
    : selectedRoot.label;
  upButton.disabled = currentRelativePath === '';
}

function renderEntries(entries: FileEntry[]) {
  entriesEl.innerHTML = '';
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'list-item';
    button.innerHTML = `<strong>${entry.kind === 'directory' ? '📁' : '📄'} ${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.relative_path)}</small>`;
    button.addEventListener('click', async () => {
      if (!selectedRoot) {
        return;
      }
      try {
        clearError();
        if (entry.kind === 'directory') {
          currentRelativePath = entry.relative_path;
          await loadDirectory();
          return;
        }
        const content = await invoke<string>('read_text_file', {
          rootId: selectedRoot.id,
          relativePath: entry.relative_path,
          maxBytes: 512_000,
        });
        previewEl.textContent = content;
        previewEl.hidden = false;
      } catch (error) {
        showError(error);
      }
    });
    entriesEl.append(button);
  }
  if (entries.length === 0) {
    entriesEl.innerHTML = '<p class="empty">No readable entries found.</p>';
  }
}

addRootButton.addEventListener('click', async () => {
  try {
    clearError();
    const added = await invoke<AllowedRoot | null>('choose_allowed_root');
    if (added) {
      selectedRoot = added;
      currentRelativePath = '';
      await Promise.all([loadStatus(), loadRoots()]);
      await loadDirectory();
    }
  } catch (error) {
    showError(error);
  }
});

upButton.addEventListener('click', async () => {
  currentRelativePath = currentRelativePath.split('/').slice(0, -1).join('/');
  await loadDirectory();
});

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(async () => {
    if (!selectedRoot) {
      return;
    }
    const query = searchInput.value.trim();
    if (query.length < 2) {
      await loadDirectory();
      return;
    }
    try {
      clearError();
      previewEl.hidden = true;
      const entries = await invoke<FileEntry[]>('search_files', {
        rootId: selectedRoot.id,
        query,
        maxResults: 100,
      });
      titleEl.textContent = `Search: ${query}`;
      renderEntries(entries);
    } catch (error) {
      showError(error);
    }
  }, 250);
});

Promise.all([loadStatus(), loadRoots()]).catch(showError);

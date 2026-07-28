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

type PairingOffer = {
  pairing_id: string;
  pairing_code: string;
  confirmation_fingerprint: string;
  expires_at: string;
  capabilities: string[];
  denied_capabilities: string[];
  transport: string;
};

type PairingSession = {
  session_id: string;
  pairing_id: string;
  confirmation_fingerprint: string;
  capabilities: string[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type PairingStatus = {
  offer: PairingOffer | null;
  session: PairingSession | null;
};

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('Application root was not found');
}

app.innerHTML = `
  <main class="app-shell">
    <aside class="sidebar" aria-label="CyberTools navigation">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">CT</span>
        <div>
          <strong>CyberTools</strong>
          <span>Local Bridge</span>
        </div>
      </div>
      <nav class="nav-list">
        <button class="nav-item active" type="button">
          <span class="nav-icon" aria-hidden="true">01</span>
          Workspace
        </button>
        <button class="nav-item" type="button">
          <span class="nav-icon" aria-hidden="true">02</span>
          Pairing
        </button>
        <button class="nav-item" type="button">
          <span class="nav-icon" aria-hidden="true">03</span>
          Audit
        </button>
      </nav>
      <div class="sidebar-footer">
        <span class="lock-dot" aria-hidden="true"></span>
        <div>
          <strong>Read-only mode</strong>
          <span>No shell, process, delete, or write access.</span>
        </div>
      </div>
    </aside>

    <section class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">Desktop companion</p>
          <h1>Connect local files to CyberTools safely.</h1>
        </div>
        <div class="topbar-actions">
          <button id="add-root-top" class="primary" type="button">Allow folder</button>
          <span id="status" class="status-pill">Starting</span>
        </div>
      </header>

      <section class="overview-grid" aria-label="Connection overview">
        <article class="metric-card">
          <span class="metric-label">Access</span>
          <strong id="access-mode">Read-only</strong>
          <small>Only folders you approve are visible.</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">Folders</span>
          <strong id="folder-count">0</strong>
          <small>Allowed workspace roots.</small>
        </article>
        <article class="metric-card">
          <span class="metric-label">Network</span>
          <strong id="network-mode">Off</strong>
          <small>Pairing is loopback-only dry confirmation.</small>
        </article>
      </section>

      <section class="setup-strip" aria-label="Setup flow">
        <div class="setup-step complete">
          <span>1</span>
          <div>
            <strong>Choose folder</strong>
            <small>Grant a local workspace root.</small>
          </div>
        </div>
        <div class="setup-step">
          <span>2</span>
          <div>
            <strong>Browse files</strong>
            <small>Preview text files locally.</small>
          </div>
        </div>
        <div class="setup-step">
          <span>3</span>
          <div>
            <strong>Pair later</strong>
            <small>Confirm the fingerprint before web use.</small>
          </div>
        </div>
      </section>

      <section class="pairing-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Secure pairing</p>
            <h2>Web connection approval</h2>
          </div>
          <div class="button-row">
            <button id="create-pairing" class="secondary" type="button">Create code</button>
            <button id="confirm-pairing" class="secondary" type="button" disabled>Dry confirm</button>
            <button id="revoke-pairing" class="danger" type="button" disabled>Revoke</button>
          </div>
        </div>
        <div id="pairing-state" class="pairing-state"></div>
      </section>

      <section class="file-workspace">
        <aside class="roots-pane">
          <div class="pane-heading">
            <div>
              <p class="eyebrow">Allowed roots</p>
              <h2>Local workspaces</h2>
            </div>
            <button id="add-root" class="icon-button" type="button" aria-label="Allow folder" title="Allow folder">+</button>
          </div>
          <div id="roots" class="root-list"></div>
        </aside>

        <article class="browser-pane">
          <div class="browser-toolbar">
            <div>
              <p class="eyebrow">File browser</p>
              <h2 id="current-title">Select a workspace</h2>
            </div>
            <div class="toolbar-actions">
              <button id="up" class="icon-button" type="button" aria-label="Go up" title="Go up" disabled>Up</button>
              <button id="revoke-root" class="danger" type="button" disabled>Remove access</button>
            </div>
          </div>
          <div class="search-bar">
            <input id="search" type="search" placeholder="Search selected workspace files" />
          </div>
          <div id="entries" class="entries-table" role="table" aria-label="Files"></div>
        </article>

        <aside class="preview-pane">
          <div class="pane-heading">
            <div>
              <p class="eyebrow">Preview</p>
              <h2 id="preview-title">No file selected</h2>
            </div>
          </div>
          <pre id="preview" hidden></pre>
          <div id="preview-empty" class="empty-state">
            <strong>Pick a text file</strong>
            <span>Content is read locally and never written back.</span>
          </div>
        </aside>
      </section>

      <p id="error" class="error" role="alert"></p>
    </section>
  </main>
`;

const statusEl = document.querySelector<HTMLElement>('#status')!;
const accessModeEl = document.querySelector<HTMLElement>('#access-mode')!;
const folderCountEl = document.querySelector<HTMLElement>('#folder-count')!;
const networkModeEl = document.querySelector<HTMLElement>('#network-mode')!;
const rootsEl = document.querySelector<HTMLElement>('#roots')!;
const entriesEl = document.querySelector<HTMLElement>('#entries')!;
const previewEl = document.querySelector<HTMLPreElement>('#preview')!;
const previewEmptyEl = document.querySelector<HTMLElement>('#preview-empty')!;
const previewTitleEl = document.querySelector<HTMLElement>('#preview-title')!;
const errorEl = document.querySelector<HTMLElement>('#error')!;
const titleEl = document.querySelector<HTMLElement>('#current-title')!;
const addRootButton = document.querySelector<HTMLButtonElement>('#add-root')!;
const addRootTopButton = document.querySelector<HTMLButtonElement>('#add-root-top')!;
const revokeRootButton = document.querySelector<HTMLButtonElement>('#revoke-root')!;
const upButton = document.querySelector<HTMLButtonElement>('#up')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const pairingStateEl = document.querySelector<HTMLElement>('#pairing-state')!;
const createPairingButton = document.querySelector<HTMLButtonElement>('#create-pairing')!;
const confirmPairingButton = document.querySelector<HTMLButtonElement>('#confirm-pairing')!;
const revokePairingButton = document.querySelector<HTMLButtonElement>('#revoke-pairing')!;

let roots: AllowedRoot[] = [];
let selectedRoot: AllowedRoot | null = null;
let currentRelativePath = '';
let searchTimer: number | undefined;
let activeOffer: PairingOffer | null = null;
let activeSession: PairingSession | null = null;

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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSize(value: number | null) {
  if (value === null) {
    return '';
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function showError(error: unknown) {
  errorEl.textContent = error instanceof Error ? error.message : String(error);
}

function clearError() {
  errorEl.textContent = '';
}

function clearPreview() {
  previewTitleEl.textContent = 'No file selected';
  previewEl.hidden = true;
  previewEl.textContent = '';
  previewEmptyEl.hidden = false;
}

function resetSelection() {
  selectedRoot = null;
  currentRelativePath = '';
  titleEl.textContent = 'Select a workspace';
  entriesEl.innerHTML = `
    <div class="empty-state wide">
      <strong>No workspace selected</strong>
      <span>Use Allow folder to choose a project folder, then browse files here.</span>
    </div>
  `;
  searchInput.value = '';
  searchInput.disabled = true;
  revokeRootButton.disabled = true;
  upButton.disabled = true;
  clearPreview();
}

async function loadStatus() {
  const status = await invoke<BridgeStatus>('bridge_status');
  statusEl.textContent = status.read_only ? 'Protected' : 'Restricted';
  statusEl.title = `Version ${status.version}; roots: ${status.allowed_root_count}`;
  accessModeEl.textContent = status.read_only ? 'Read-only' : 'Restricted';
  folderCountEl.textContent = String(status.allowed_root_count);
  networkModeEl.textContent = status.network_enabled ? 'Limited' : 'Off';
}

function renderPairing() {
  confirmPairingButton.disabled = !activeOffer || Boolean(activeSession);
  revokePairingButton.disabled = !activeSession;

  if (activeSession) {
    pairingStateEl.innerHTML = `
      <div class="pairing-details active">
        <div>
          <span class="state-dot"></span>
          <strong>Session active</strong>
        </div>
        <dl>
          <div><dt>Fingerprint</dt><dd>${escapeHtml(activeSession.confirmation_fingerprint)}</dd></div>
          <div><dt>Expires</dt><dd>${escapeHtml(formatDate(activeSession.expires_at))}</dd></div>
          <div><dt>Capabilities</dt><dd>${activeSession.capabilities.map(escapeHtml).join(', ')}</dd></div>
        </dl>
      </div>
    `;
    return;
  }

  if (activeOffer) {
    pairingStateEl.innerHTML = `
      <div class="pairing-details">
        <div class="pairing-code-block">
          <span>Pairing code</span>
          <strong>${escapeHtml(activeOffer.pairing_code)}</strong>
        </div>
        <dl>
          <div><dt>Fingerprint</dt><dd>${escapeHtml(activeOffer.confirmation_fingerprint)}</dd></div>
          <div><dt>Expires</dt><dd>${escapeHtml(formatDate(activeOffer.expires_at))}</dd></div>
          <div><dt>Transport</dt><dd>${escapeHtml(activeOffer.transport)}</dd></div>
          <div><dt>Allowed</dt><dd>${activeOffer.capabilities.map(escapeHtml).join(', ')}</dd></div>
        </dl>
      </div>
    `;
    return;
  }

  pairingStateEl.innerHTML = `
    <div class="empty-state inline">
      <strong>No pairing session</strong>
      <span>Create a code only when the web app asks to connect.</span>
    </div>
  `;
}

async function loadPairingStatus() {
  const status = await invoke<PairingStatus>('pairing_status');
  activeOffer = status.offer;
  activeSession = status.session;
  renderPairing();
}

async function loadRoots() {
  roots = await invoke<AllowedRoot[]>('list_allowed_roots');
  if (selectedRoot && !roots.some((root) => root.id === selectedRoot?.id)) {
    resetSelection();
  }

  rootsEl.innerHTML = '';
  for (const root of roots) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `root-item ${selectedRoot?.id === root.id ? 'selected' : ''}`;
    button.innerHTML = `
      <span class="folder-icon" aria-hidden="true"></span>
      <span>
        <strong>${escapeHtml(root.label)}</strong>
        <small>${escapeHtml(root.path)}</small>
      </span>
    `;
    button.addEventListener('click', () => selectRoot(root));
    rootsEl.append(button);
  }

  if (roots.length === 0) {
    rootsEl.innerHTML = `
      <div class="empty-state">
        <strong>No folders allowed</strong>
        <span>Add one project folder to begin.</span>
      </div>
    `;
  }
}

async function selectRoot(root: AllowedRoot) {
  selectedRoot = root;
  currentRelativePath = '';
  clearPreview();
  revokeRootButton.disabled = false;
  searchInput.disabled = false;
  await loadRoots();
  await loadDirectory();
}

async function loadDirectory() {
  if (!selectedRoot) {
    return;
  }
  clearError();
  searchInput.value = '';
  clearPreview();

  const entries = await invoke<FileEntry[]>('list_directory', {
    rootId: selectedRoot.id,
    relativePath: currentRelativePath,
  });

  renderEntries(entries);
  titleEl.textContent = currentRelativePath
    ? `${selectedRoot.label} / ${currentRelativePath}`
    : selectedRoot.label;
  upButton.disabled = currentRelativePath === '';
  revokeRootButton.disabled = false;
}

function renderEntries(entries: FileEntry[]) {
  if (entries.length === 0) {
    entriesEl.innerHTML = `
      <div class="empty-state wide">
        <strong>Nothing to show</strong>
        <span>No readable files or folders were found here.</span>
      </div>
    `;
    return;
  }

  entriesEl.innerHTML = `
    <div class="table-head" role="row">
      <span>Name</span>
      <span>Type</span>
      <span>Size</span>
    </div>
  `;

  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-row';
    button.innerHTML = `
      <span class="entry-name">
        <span class="${entry.kind === 'directory' ? 'folder-icon' : 'file-icon'}" aria-hidden="true"></span>
        <span>
          <strong>${escapeHtml(entry.name)}</strong>
          <small>${escapeHtml(entry.relative_path)}</small>
        </span>
      </span>
      <span class="muted">${entry.kind === 'directory' ? 'Folder' : 'File'}</span>
      <span class="muted">${escapeHtml(formatSize(entry.size))}</span>
    `;
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
        previewTitleEl.textContent = entry.name;
        previewEl.textContent = content;
        previewEl.hidden = false;
        previewEmptyEl.hidden = true;
      } catch (error) {
        showError(error);
      }
    });
    entriesEl.append(button);
  }
}

async function addAllowedRoot() {
  try {
    clearError();
    const added = await invoke<AllowedRoot | null>('choose_allowed_root');
    if (added) {
      selectedRoot = added;
      currentRelativePath = '';
      revokeRootButton.disabled = false;
      searchInput.disabled = false;
      await Promise.all([loadStatus(), loadRoots()]);
      await loadDirectory();
    }
  } catch (error) {
    showError(error);
  }
}

addRootButton.addEventListener('click', addAllowedRoot);
addRootTopButton.addEventListener('click', addAllowedRoot);

createPairingButton.addEventListener('click', async () => {
  try {
    clearError();
    activeOffer = await invoke<PairingOffer>('create_pairing_offer');
    activeSession = null;
    renderPairing();
  } catch (error) {
    showError(error);
  }
});

confirmPairingButton.addEventListener('click', async () => {
  if (!activeOffer) {
    return;
  }
  try {
    clearError();
    activeSession = await invoke<PairingSession>('confirm_pairing_code', {
      pairingId: activeOffer.pairing_id,
      pairingCode: activeOffer.pairing_code,
      webOrigin: 'http://localhost',
      requestedCapabilities: activeOffer.capabilities,
    });
    activeOffer = null;
    renderPairing();
  } catch (error) {
    showError(error);
  }
});

revokePairingButton.addEventListener('click', async () => {
  try {
    clearError();
    await invoke('revoke_pairing_session');
    activeSession = null;
    await loadPairingStatus();
  } catch (error) {
    showError(error);
  }
});

revokeRootButton.addEventListener('click', async () => {
  if (!selectedRoot) {
    return;
  }
  const approved = window.confirm(`Remove CyberTools access to "${selectedRoot.label}"?`);
  if (!approved) {
    return;
  }
  try {
    clearError();
    await invoke('remove_allowed_root', { rootId: selectedRoot.id });
    resetSelection();
    await Promise.all([loadStatus(), loadRoots()]);
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
      clearPreview();
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

resetSelection();
Promise.all([loadStatus(), loadRoots(), loadPairingStatus()]).catch(showError);

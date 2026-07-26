import { useState } from 'react';

const enabled = import.meta.env.CYBERTOOLS_MEMORY_ENABLED === 'true';
const autoWrite = import.meta.env.CYBERTOOLS_MEMORY_AUTO_WRITE === 'true';

export default function MemoryReviewPanel() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState([]);

  if (!enabled) {
    return null;
  }

  const addDraft = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setItems((current) => [{ id: crypto.randomUUID(), text, pinned: false }, ...current]);
    setDraft('');
  };

  return (
    <aside className="fixed bottom-4 left-4 z-[900] w-[min(380px,calc(100vw-2rem))] rounded-lg border border-border-light bg-surface-primary shadow-xl">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Memory review</span>
        <span className="text-xs text-text-secondary">{autoWrite ? 'auto-write blocked' : 'manual only'}</span>
      </button>
      {open && (
        <div className="border-t border-border-light px-4 pb-4 pt-3">
          <textarea
            className="h-20 w-full rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Review a memory before saving"
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white" onClick={addDraft}>
              Save draft
            </button>
            <button type="button" className="rounded-md border border-border-light px-3 py-2 text-xs text-text-primary" onClick={() => setDraft('')}>
              Clear
            </button>
            <button
              type="button"
              className="rounded-md border border-border-light px-3 py-2 text-xs text-text-primary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'cybertools-memory-review.json';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export
            </button>
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            Consent is required before storage. Secrets are redacted server-side before adapter writes.
          </p>
          <div className="mt-3 max-h-56 space-y-2 overflow-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-border-light bg-surface-secondary p-3">
                <textarea
                  className="h-16 w-full bg-transparent text-sm text-text-primary outline-none"
                  value={item.text}
                  onChange={(event) => {
                    const text = event.target.value;
                    setItems((current) => current.map((candidate) => (
                      candidate.id === item.id ? { ...candidate, text } : candidate
                    )));
                  }}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-text-secondary"
                    onClick={() => setItems((current) => current.map((candidate) => (
                      candidate.id === item.id ? { ...candidate, pinned: !candidate.pinned } : candidate
                    )))}
                  >
                    {item.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

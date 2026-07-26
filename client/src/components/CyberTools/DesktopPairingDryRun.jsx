import { useMemo, useState } from 'react';

const enabled = import.meta.env.CYBERTOOLS_DESKTOP_PAIRING_ENABLED === 'true';
const readOnlyCapabilities = ['filesystem.list', 'filesystem.read', 'filesystem.search'];

function fingerprintFromCode(code) {
  const groups = [];
  for (let index = 0; index < 6; index += 1) {
    const pair = code.slice(index, index + 2).padEnd(2, '0');
    groups.push(Number.parseInt(pair, 10).toString(16).padStart(2, '0').toUpperCase());
  }
  return groups.join(':');
}

export default function DesktopPairingDryRun() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const normalizedCode = code.replace(/\D/g, '').slice(0, 8);
  const error = normalizedCode.length > 0 && normalizedCode.length !== 8
    ? 'Enter the 8-digit code shown in CyberTools Desktop Bridge.'
    : '';
  const fingerprint = useMemo(
    () => (normalizedCode.length === 8 ? fingerprintFromCode(normalizedCode) : ''),
    [normalizedCode],
  );

  if (!enabled) {
    return null;
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[900] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border-light bg-surface-primary shadow-xl">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Desktop pairing</span>
        <span className="text-xs text-text-secondary">dry run</span>
      </button>
      {open && (
        <div className="border-t border-border-light px-4 pb-4 pt-3">
          <label className="block text-xs font-medium text-text-secondary" htmlFor="cybertools-pairing-code">
            Pairing code
          </label>
          <input
            id="cybertools-pairing-code"
            className="mt-2 w-full rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500"
            inputMode="numeric"
            autoComplete="off"
            value={normalizedCode}
            onChange={(event) => {
              setCode(event.target.value);
              setConfirmed(false);
            }}
            placeholder="00000000"
          />
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          {fingerprint && (
            <div className="mt-3 rounded-md border border-border-light bg-surface-secondary p-3">
              <p className="text-xs text-text-secondary">Confirmation fingerprint</p>
              <p className="mt-1 font-mono text-sm text-text-primary">{fingerprint}</p>
              <p className="mt-2 text-xs text-text-secondary">
                Capabilities: {readOnlyCapabilities.join(', ')}
              </p>
            </div>
          )}
          <button
            type="button"
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={normalizedCode.length !== 8}
            onClick={() => setConfirmed(true)}
          >
            Confirm dry pairing
          </button>
          <p className="mt-3 text-xs text-text-secondary">
            File transfer is disabled. No local files are uploaded or read by LibreChat.
          </p>
          {confirmed && (
            <p className="mt-2 rounded-md border border-green-700 bg-green-950/40 px-3 py-2 text-xs text-green-300">
              Pairing preview confirmed. Permissions remain closed until a later approved bridge integration.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

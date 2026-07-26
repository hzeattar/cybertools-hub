import { useMemo, useState } from 'react';

const enabled = import.meta.env.CYBERTOOLS_MODEL_ROUTER_DRY_RUN === 'true';

function decide(choice, allowCloudFiles) {
  const considered = [
    { provider: 'local', result: 'eligible', reason: 'privacy_first' },
    { provider: 'free', result: allowCloudFiles ? 'eligible' : 'blocked', reason: allowCloudFiles ? 'user_allowed_cloud' : 'cloud_file_consent_required' },
    { provider: 'premium', result: choice === 'premium' && allowCloudFiles ? 'eligible' : 'blocked', reason: choice === 'premium' ? 'premium_opt_in_required_for_use' : 'premium_not_selected' },
  ];
  const selected = choice === 'premium' && allowCloudFiles ? 'premium' : choice === 'free' && allowCloudFiles ? 'free' : 'local';
  return { selected, considered };
}

export default function ModelRouterDryRun() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('local');
  const [allowCloudFiles, setAllowCloudFiles] = useState(false);
  const decision = useMemo(() => decide(choice, allowCloudFiles), [choice, allowCloudFiles]);

  if (!enabled) {
    return null;
  }

  return (
    <aside className="fixed right-4 top-4 z-[900] w-[min(380px,calc(100vw-2rem))] rounded-lg border border-border-light bg-surface-primary shadow-xl">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Model router</span>
        <span className="text-xs text-text-secondary">dry run</span>
      </button>
      {open && (
        <div className="border-t border-border-light px-4 pb-4 pt-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['local', 'Use local'],
              ['free', 'Use free'],
              ['premium', 'Allow premium'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-2 py-2 text-xs ${choice === value ? 'border-blue-500 bg-blue-950/40 text-blue-200' : 'border-border-light text-text-primary'}`}
                onClick={() => setChoice(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={allowCloudFiles}
              onChange={(event) => setAllowCloudFiles(event.target.checked)}
            />
            Allow local file content to cloud for this dry decision
          </label>
          <div className="mt-3 rounded-md border border-border-light bg-surface-secondary p-3">
            <p className="text-xs text-text-secondary">Decision trace</p>
            <p className="mt-1 text-sm text-text-primary">Selected preview: {decision.selected}</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              {decision.considered.map((item) => (
                <li key={item.provider}>
                  {item.provider}: {item.result} ({item.reason})
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            This does not change the active endpoint, model, retry behavior, or billing tier.
          </p>
        </div>
      )}
    </aside>
  );
}

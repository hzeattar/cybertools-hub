import { readFile, writeFile } from 'node:fs/promises';

const configPath = process.env.CONFIG_PATH || 'librechat.yaml';
const withoutSkills =
  "capabilities: ['deferred_tools', 'execute_code', 'file_search', 'actions', 'tools']";
const withSkills =
  "capabilities: ['deferred_tools', 'execute_code', 'file_search', 'skills', 'actions', 'tools']";

const config = await readFile(configPath, 'utf8');

if (config.includes(withSkills)) {
  console.log('[librechat-skills] Skills capability is already enabled');
} else if (config.includes(withoutSkills)) {
  await writeFile(configPath, config.replace(withoutSkills, withSkills), 'utf8');
  console.log('[librechat-skills] Enabled the LibreChat Skills capability');
} else {
  throw new Error(
    'Unable to locate the expected agents capabilities list in librechat.yaml; refusing an unverified configuration edit',
  );
}

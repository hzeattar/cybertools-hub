/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  readonly CYBERTOOLS_DESKTOP_PAIRING_ENABLED?: string;
  readonly CYBERTOOLS_MEMORY_ENABLED?: string;
  readonly CYBERTOOLS_MEMORY_AUTO_WRITE?: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

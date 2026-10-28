/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_CLE?: string
}

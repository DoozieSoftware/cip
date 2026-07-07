/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** VAPID public key (base64url) used to subscribe to web push. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}

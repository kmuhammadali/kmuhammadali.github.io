/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_CONTACT_API_URL?: string; }
interface ImportMetaEnv {
  readonly VITE_PUBLIC_API_URL?: string;
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_SITE_URL?: string;
}

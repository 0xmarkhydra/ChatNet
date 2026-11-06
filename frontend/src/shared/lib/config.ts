export const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? import.meta.env.VITE_API_PROXY === '1' ? window.location.origin : 'http://localhost:8080'
    : 'https://api-chat.codelocal.cloud')

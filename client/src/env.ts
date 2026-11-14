// Backend URL – automatically detects Vercel env variables or falls back to your Render deployment
const configuredUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD
    ? 'https://chat-mpbz.onrender.com'
    : 'http://localhost:5000');

export const API_URL = (configuredUrl || 'https://chat-mpbz.onrender.com')
  .trim()
  .replace(/\/+$/, '');

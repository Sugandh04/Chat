# Chat

Private, invite-only messaging. One Expo codebase for web, Android and iOS (`client`), and a Node API (`server`).

## Server (Render)
- Build: `npm install && npm run build`, start: `npm start`, root directory: `server`.
- Env: `MONGODB_URI`, `SESSION_SECRET` (used to sign tokens), `CLIENT_URL` (comma-separated web origins, e.g. your Vercel URL), `ADMIN_SECRET`.
- First account: register in the app using `ADMIN_SECRET` as the invite code. It becomes the admin. After that, create invites from Settings.

## Client (Vercel for web)
- Root directory: `client`, build: `npm run build`, output: `dist`.
- Env: `EXPO_PUBLIC_API_URL` = your Render URL (no trailing slash). Optional `EXPO_PUBLIC_WEB_URL` = your Vercel URL, used to build invite links.
- Mobile: `npx expo start` for development, `npx eas-cli build -p android --profile preview` for an installable APK.

## Local development
```
cd server && npm run dev
cd client && npm run web
```

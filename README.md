# Chat

Private, invite-only messaging. One Expo codebase for web, Android and iOS (`client`), and a Node API (`server`).

## Server (Render)
- Build: `npm install && npm run build`, start: `npm start`, root directory: `server`.
- Env: `MONGODB_URI`, `SESSION_SECRET` (used to sign tokens), `CLIENT_URL` (comma-separated web origins, e.g. your Vercel URL), `ADMIN_SECRET`.
- First account: register in the app using `ADMIN_SECRET` as the invite code. It becomes the admin. After that, create invites from Settings.

## Client (Vercel for web)
- Root directory: `client`, build: `npm run build`, output: `dist`.
- Env: `EXPO_PUBLIC_API_URL` = your Render URL (no trailing slash). Optional `EXPO_PUBLIC_WEB_URL` = your Vercel URL, used to build invite links.
- Android app (same codebase):
  - Develop: start the emulator, then `npx expo start --android` (Expo Go; the app reaches a local server at `http://10.0.2.2:5000`).
  - Installable APK, built locally (works on Windows):
    1. `cd client && npx expo prebuild -p android --clean` (the `android-windows-build` plugin shortens native build paths).
    2. In `client/android/local.properties` set `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` and `cmake.dir=C:/Program Files/CMake` (CMake 3.31+/4.x; Android Studio's CMake 3.22 ships a Ninja that cannot use long paths). A Ninja 1.12+ must be on `PATH`.
    3. `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (add `,x86_64` to also run on an Intel emulator). Output: `app/build/outputs/apk/release/app-release.apk`.
  - Or build in Expo's cloud: `npx eas-cli login`, `npx eas-cli init`, `npx eas-cli build -p android --profile preview`.
  - Install the APK by copying it to the phone and opening it (allow "install unknown apps" for the app you open it from).

## Local development
```
cd server && npm run dev
cd client && npm run web
```

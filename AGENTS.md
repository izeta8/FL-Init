# FL-Init Agent Guidelines

## Project Overview

**FL-Init** is an Electron desktop application that simplifies creating FL Studio projects from YouTube songs. It automates audio downloading and project setup with customizable `.flp` templates and optional stem extraction.

- **Type**: Desktop Application (Electron)
- **Node Version**: 20.x+
- **Package Manager**: npm

## Architecture

```
src/
├── main/           # Electron main process (TypeScript)
├── preload/        # Preload scripts (bridge main-renderer)
└── renderer/       # Frontend (Vanilla JS + Webpack)
```

### Key Technologies

- **Main Process**: Electron 30.x, electron-log, electron-updater
- **Renderer**: Vanilla JS, Webpack 5, SweetAlert2
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build**: electron-builder, NSIS (Windows), DMG (macOS), AppImage (Linux)

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both renderer and electron in dev mode |
| `npm run build` | Build production app |
| `npm run dist` | Create distributable installer |
| `npm run start` | Run in development mode |

## Important Patterns

### IPC Communication

All main-renderer communication uses `ipcRenderer.invoke()` and `ipcMain.handle()`. Channels are defined in `src/renderer/services/ipc-service.ts`.

```typescript
// Renderer -> Main
window.electronAPI.downloadYouTube(params)

// Main handlers in src/main/ipc-handlers.ts
```

### Environment Variables

- Use `process.env.NODE_ENV` to differentiate dev/prod
- Supabase credentials via `load-env.js` in production builds

### Logging

Main process uses `electron-log` for file and console logging. Check logs at:
- Windows: `%APPDATA%/flinit/logs/`

### Database

Supabase client initialized in main process. Access via:
- `src/main/services/supabase-service.ts`

## Code Style

- TypeScript for main/preload, Vanilla JS for renderer
- Use `const` over `let`, arrow functions where appropriate
- Async/await for Promises, never use `.then()` chains
- CSS modules or global styles in `src/renderer/styles/`

## Security

- Context isolation enabled
- Preload script exposes limited API via `contextBridge`
- Never expose Node.js APIs directly to renderer
- Validate all IPC inputs in main process
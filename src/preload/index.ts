import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Allowlist of every IPC channel the renderer is permitted to call. Any other
// channel name is rejected at the preload boundary so that a compromised
// renderer (XSS, malicious widget) cannot reach handlers it shouldn't.
const INVOKE_CHANNELS = new Set<string>([
  // ADB / mobile
  'adb-close-app',
  'adb-connect',
  'adb-disconnect',
  'adb-get-history',
  'adb-get-notifications',
  'adb-hardware-toggle',
  'adb-open-app',
  'adb-pull-file',
  'adb-push-file',
  'adb-quick-action',
  'adb-screenshot',
  'adb-swipe',
  'adb-tap',
  'adb-telemetry',
  // chat memory
  'add-message',
  'get-history',
  'save-core-memory',
  'search-core-memory',
  // AI builders
  'build-animated-website',
  'consult-oracle',
  'cancel-ingestion',
  'ingest-codebase',
  'execute-deep-research',
  'index-folder',
  'search-files',
  'start-live-coding',
  // updater
  'check-for-updates',
  'download-update',
  'install-update',
  // vault / security
  'check-keys-exist',
  'check-vault-status',
  'get-personality',
  'set-personality',
  'secure-get-keys',
  'secure-save-keys',
  'setup-vault-face',
  'setup-vault-pin',
  'verify-vault-face',
  'verify-vault-pin',
  // app launch / system
  'close-app',
  'open-app',
  'get-app-version',
  'get-battery-info',
  'get-installed-apps',
  'get-mobile-info-ai',
  'get-personality',
  'get-running-apps',
  'get-screen-size',
  'get-screen-source',
  'get-system-stats',
  'set-volume',
  // file ops
  'copy-file-to-clipboard',
  'create-directory',
  'file-ops',
  'file:open',
  'file:reveal',
  'read-directory',
  'read-file',
  'write-file',
  'run-shell-command',
  // gallery / images
  'delete-image',
  'get-gallery',
  'move-file-to-category',
  'open-image-location',
  'save-image-external',
  'save-image-to-gallery',
  // notes
  'delete-note',
  'get-notes',
  'save-note',
  // gmail
  'gmail-draft',
  'gmail-read',
  'gmail-send',
  // web / wormhole
  'close-wormhole',
  'deploy-wormhole',
  'open-wormhole',
  'google-search',
  'hack-website',
  // ghost / keyboard / mouse
  'ghost-click-coordinate',
  'ghost-drag',
  'ghost-key',
  'ghost-mouse-move',
  'ghost-mouse-position',
  'ghost-scroll',
  'ghost-sequence',
  'take-screenshot',
  'teleport-windows',
  // permissions / admin
  'get-permissions',
  'get-permission-info',
  'set-permission',
  'request-elevation',
  'execute-elevated',
  // workflow editor
  'delete-workflow',
  'load-workflows',
  'save-workflow',
  // widgets
  'close-widgets',
  'create-widget',
  // misc
  'get-live-location',
  'open-in-vscode'
])

// Channels the renderer is allowed to RECEIVE events on.
const RECEIVE_CHANNELS = new Set<string>([
  'installed-apps',
  'live-code-chunk',
  'lock-screen',
  'oauth-callback',
  'oracle-progress',
  'overlay-mode',
  'semantic-progress',
  'terminal-data',
  'updater-event'
])

// Channels the renderer is allowed to fire-and-forget on (used for window
// controls and the AI-triggered lockdown).
const SEND_CHANNELS = new Set<string>([
  'toggle-overlay',
  'trigger-lockdown',
  'window-close',
  'window-max',
  'window-min'
])

const api = {}

const safeInvoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  if (!INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
  }
  return ipcRenderer.invoke(channel, ...args)
}

const safeSend = (channel: string, ...args: unknown[]): void => {
  if (!SEND_CHANNELS.has(channel)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[preload] blocked ipc send on disallowed channel: ${channel}`)
    }
    return
  }
  ipcRenderer.send(channel, ...args)
}

const safeOn = (
  channel: string,
  listener: (event: IpcRendererEvent, ...args: unknown[]) => void
): (() => void) => {
  if (!RECEIVE_CHANNELS.has(channel)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[preload] blocked ipc.on on disallowed channel: ${channel}`)
    }
    return () => {}
  }
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const safeRemoveListener = (
  channel: string,
  listener: (event: IpcRendererEvent, ...args: unknown[]) => void
): void => {
  if (!RECEIVE_CHANNELS.has(channel)) return
  ipcRenderer.removeListener(channel, listener)
}

const safeRemoveAllListeners = (channel: string): void => {
  if (!RECEIVE_CHANNELS.has(channel)) return
  ipcRenderer.removeAllListeners(channel)
}

// Filter the toolkit's electronAPI surface to only the methods we want exposed
// (the toolkit otherwise re-exports a broader ipcRenderer than we need).
const safeElectronAPI = {
  ...electronAPI,
  ipcRenderer: {
    invoke: safeInvoke,
    send: safeSend,
    on: safeOn,
    removeListener: safeRemoveListener,
    removeAllListeners: safeRemoveAllListeners
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', safeElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch {
    // Keep preload startup non-fatal if the bridge was already exposed.
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = safeElectronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

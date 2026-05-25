import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
  screen,
  session,
  safeStorage,
  systemPreferences,
  dialog
} from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { setImmediate } from 'node:timers'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import registerIpcHandlers from './logic/nexa-memory-save'
import registerSystemHandlers from './logic/get-system-info'
import registerFileSearch from './logic/file-search'
import registerFileOps from './logic/file-ops'
import registerFileWrite from './logic/file-write'
import registerFileRead from './logic/file-read'
import registerFileOpen from './logic/file-open'
import registerDirLoader from './logic/dir-load'
import registerFileScanner from './logic/file-launcher'
import registerAppLauncher from './logic/app-launcher'
import registerNotesHandlers from './logic/notes-manager'
import registerWebAgent from './logic/web-agent'
import registerGhostControl from './logic/ghost-control'
import registerterminalControl from './logic/terminal-control'
import registerGalleryHandlers from './logic/gallery-manager'
import registerGmailHandlers from './logic/gmail-manager'
import registerLocationHandlers from './logic/live-location'
import registerAdbHandlers from './logic/adb-manager'
import registerRealityHacker from './logic/reality-hacker'
import registerNexaCoder from './services/nexa-coder'
import registerTelekinesis from './logic/telekinesis'
import registerPermanentMemory from './logic/permanent-memory'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
import registerLockSystem from './security/lock-system'
import registerPermissionManager from './services/permission-manager'
import { autoUpdater } from 'electron-updater'

app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

// Suppress VAAPI / GPU initialization errors on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('nexa', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('nexa')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let isOverlayMode = false

const secureConfigPath = join(app.getPath('userData'), 'nexa_secure_vault.json')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('window-min', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => mainWindow?.close())
  ipcMain.on('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    const url = commandLine.find((arg) => arg.startsWith('nexa://'))
    if (url) {
      mainWindow.webContents.send('oauth-callback', url)
    }
  }
})

function toggleOverlayMode(): void {
  if (!mainWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  if (isOverlayMode) {
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setBounds({ width: 950, height: 670 })
    mainWindow.center()
    mainWindow.webContents.send('overlay-mode', false)
  } else {
    const w = 340
    const h = 70
    mainWindow.setBounds({
      width: w,
      height: h,
      x: Math.floor(width / 2 - w / 2),
      y: height - h - 50
    })
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setResizable(false)
    mainWindow.webContents.send('overlay-mode', true)
  }
  isOverlayMode = !isOverlayMode
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Found',
        message: `Nexa Core Update Found: v${info.version}. Downloading in background...`
      })
    })

    autoUpdater.on('error', (err) => {
      dialog.showErrorBox(
        'Auto-Updater Error',
        err == null ? 'unknown error' : (err.stack || err).toString()
      )
    })

    autoUpdater.on('update-downloaded', () => {
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'New version downloaded! The system will now force reboot to apply the patch.',
          buttons: ['Execute Restart']
        })
        .then(() => {
          setImmediate(() => {
            app.removeAllListeners('window-all-closed')
            autoUpdater.quitAndInstall(false, true)
          })
        })
    })
  }

  // Permissions that are silently auto-granted (Nexa needs constant hardware
  // access for the voice/vision pipeline).
  const autoGrantPermissions = new Set([
    'media',
    'audioCapture',
    'videoCapture',
    'microphone',
    'camera'
  ])
  // Permissions that require an explicit user prompt every time (full-screen
  // capture is too invasive to grant silently).
  const promptPermissions = new Set(['desktopVideoCapture'])
  // Persist user consent for the lifetime of the app session so they don't get
  // prompted on every single screen-capture call.
  const sessionGrantedDesktopCapture = { granted: false }

  session.defaultSession.setPermissionRequestHandler(async (_webContents, permission, callback) => {
    if (autoGrantPermissions.has(permission)) {
      callback(true)
      return
    }
    if (promptPermissions.has(permission)) {
      if (sessionGrantedDesktopCapture.granted) {
        callback(true)
        return
      }
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Allow for this session', 'Deny'],
        defaultId: 0,
        cancelId: 1,
        title: 'Screen Capture Permission',
        message: 'Nexa is requesting permission to capture your screen.',
        detail: 'This lets Nexa see what you see for vision-mode and OCR features.'
      })
      const granted = response === 0
      if (granted) sessionGrantedDesktopCapture.granted = true
      callback(granted)
      return
    }
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (autoGrantPermissions.has(permission)) return true
    if (promptPermissions.has(permission)) return sessionGrantedDesktopCapture.granted
    return false
  })

  if (process.platform === 'darwin') {
    if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      systemPreferences.askForMediaAccess('microphone')
    }
    if (systemPreferences.getMediaAccessStatus('camera') !== 'granted') {
      systemPreferences.askForMediaAccess('camera')
    }
  }

  ipcMain.handle('secure-save-keys', async (_, payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        return { success: false, error: 'Invalid payload.' }
      }
      const { groqKey, geminiKey, hfKey, tavilyKey } = payload as Record<string, unknown>

      // Refuse to persist secrets if the OS cannot encrypt them. Plain base64
      // is not encryption and any other process on disk can read the file.
      if (!safeStorage.isEncryptionAvailable()) {
        return {
          success: false,
          error: 'OS-level encryption is unavailable. Refusing to store secrets without encryption.'
        }
      }

      // Read any existing record so we can update a single key without
      // wiping the others.
      let existing: Record<string, string> = {}
      try {
        if (fs.existsSync(secureConfigPath)) {
          existing = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
        }
      } catch {
        existing = {}
      }

      const encrypt = (v: unknown): string | undefined =>
        typeof v === 'string' && v.length > 0
          ? safeStorage.encryptString(v).toString('base64')
          : undefined

      const next: Record<string, string> = { ...existing }
      const groq = encrypt(groqKey)
      const gemini = encrypt(geminiKey)
      const hf = encrypt(hfKey)
      const tavily = encrypt(tavilyKey)
      if (groq) next.groq = groq
      if (gemini) next.gemini = gemini
      if (hf) next.hf = hf
      if (tavily) next.tavily = tavily

      await fs.promises.writeFile(secureConfigPath, JSON.stringify(next), { mode: 0o600 })
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'unknown error' }
    }
  })

  ipcMain.handle('secure-get-keys', async () => {
    if (!fs.existsSync(secureConfigPath)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      const data = JSON.parse(await fs.promises.readFile(secureConfigPath, 'utf8'))
      const decrypt = (b64: unknown): string | undefined => {
        if (typeof b64 !== 'string' || !b64) return undefined
        try {
          return safeStorage.decryptString(Buffer.from(b64, 'base64'))
        } catch {
          return undefined
        }
      }
      return {
        groqKey: decrypt(data.groq),
        geminiKey: decrypt(data.gemini),
        hfKey: decrypt(data.hf),
        tavilyKey: decrypt(data.tavily)
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('check-keys-exist', () => {
    return fs.existsSync(secureConfigPath)
  })

  // Inject a strict CSP for the renderer instead of stripping the one upstream
  // services send. We only relax it for the renderer's own document so that
  // local API responses keep their own CSPs intact.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isRendererDoc =
      details.resourceType === 'mainFrame' || details.resourceType === 'subFrame'
    if (!isRendererDoc) {
      callback({ responseHeaders: details.responseHeaders, statusLine: details.statusLine })
      return
    }
    const responseHeaders = { ...details.responseHeaders }
    // CSP tuned for an Electron renderer with inline GSAP/Tailwind output and
    // outbound calls to the AI provider WebSocket + REST endpoints. Header
    // values are arrays in Electron's typing.
    responseHeaders['Content-Security-Policy'] = [
      [
        "default-src 'self' 'unsafe-inline' data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: data:",
        "connect-src 'self' https: wss:",
        "worker-src 'self' blob:",
        "font-src 'self' data: https:"
      ].join('; ')
    ]
    callback({ responseHeaders, statusLine: details.statusLine })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (mainWindow && url.startsWith('nexa://')) {
      mainWindow.webContents.send('oauth-callback', url)
    }
  })

  registerLockSystem()
  registerSecurityVault()
  registerPermissionManager(ipcMain)
  registerPhantomKeyboard()
  registerScreenPeeler()
  registerDropZoneControl(ipcMain)
  registerWorkflowManager()
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerDeepResearch({ ipcMain })
  registerOracle({ ipcMain })
  registerWormhole({ ipcMain })
  registerPermanentMemory({ ipcMain, app })
  registerTelekinesis({ ipcMain })
  registerNexaCoder({ ipcMain, app })
  registerRealityHacker(ipcMain)
  registerAdbHandlers(ipcMain)
  registerLocationHandlers(ipcMain)
  registerGmailHandlers(ipcMain)
  registerGalleryHandlers(ipcMain)
  registerterminalControl(ipcMain)
  registerGhostControl(ipcMain)
  registerWebAgent(ipcMain)
  registerNotesHandlers(ipcMain)
  registerAppLauncher(ipcMain)
  registerDirLoader(ipcMain)
  registerFileOpen(ipcMain)
  registerFileSearch(ipcMain)
  registerFileRead(ipcMain)
  registerFileWrite(ipcMain)
  registerFileOps(ipcMain)
  registerFileScanner(ipcMain)
  registerSystemHandlers(ipcMain)
  registerIpcHandlers({ ipcMain, app })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('get-screen-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id
  })

  createWindow()

  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Clean up IPC listeners to prevent GLib-GObject orphaned handler warnings
  if (mainWindow) {
    mainWindow.removeAllListeners()
    mainWindow.webContents.removeAllListeners()
  }
  ipcMain.removeAllListeners()
  globalShortcut.unregisterAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

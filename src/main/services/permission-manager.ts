import { IpcMain, app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export type PermissionId =
  | 'admin'
  | 'filesystem'
  | 'screen'
  | 'audio'
  | 'camera'
  | 'keyboard'
  | 'mouse'
  | 'exec'
  | 'network'
  | 'location'

export type PermissionState = 'granted' | 'denied' | 'prompt'

type PermissionRecord = Record<PermissionId, PermissionState>

const PERMISSIONS_FILE = 'nexa_permissions.json'

const DEFAULT_PERMISSIONS: PermissionRecord = {
  admin: 'denied',
  filesystem: 'granted',
  screen: 'prompt',
  audio: 'granted',
  camera: 'prompt',
  keyboard: 'prompt',
  mouse: 'prompt',
  exec: 'denied',
  network: 'granted',
  location: 'prompt'
}

export const PERMISSION_LABELS: Record<PermissionId, string> = {
  admin: 'Administrator Access',
  filesystem: 'File System',
  screen: 'Screen Capture',
  audio: 'Microphone',
  camera: 'Camera',
  keyboard: 'Keyboard Automation',
  mouse: 'Mouse Control',
  exec: 'Command Execution',
  network: 'Network Control',
  location: 'Location Services'
}

export const PERMISSION_DESCRIPTIONS: Record<PermissionId, string> = {
  admin: 'Full sudo/root system access for elevated operations',
  filesystem: 'Read and write files anywhere on disk',
  screen: 'Capture screen contents for vision mode',
  audio: 'Access microphone for voice input',
  camera: 'Access camera for face recognition and vision',
  keyboard: 'Simulate keyboard input and shortcuts',
  mouse: 'Control mouse cursor and clicks',
  exec: 'Execute shell commands and scripts',
  network: 'Monitor and control network connections',
  location: 'Access geographic location data'
}

class PermissionManager {
  private permissions: PermissionRecord = { ...DEFAULT_PERMISSIONS }
  private permissionsPath: string = ''
  private _isElevated = false
  private _initialized = false

  private ensureInit(): void {
    if (this._initialized) return
    this.permissionsPath = path.join(app.getPath('userData'), PERMISSIONS_FILE)
    this.load()
    this._initialized = true
  }

  get isElevated(): boolean {
    return this._isElevated
  }

  private load(): void {
    try {
      if (fs.existsSync(this.permissionsPath)) {
        const data = JSON.parse(fs.readFileSync(this.permissionsPath, 'utf8'))
        this.permissions = { ...DEFAULT_PERMISSIONS, ...data }
      }
    } catch {
      this.permissions = { ...DEFAULT_PERMISSIONS }
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.permissionsPath, JSON.stringify(this.permissions, null, 2), {
        mode: 0o600
      })
    } catch {
      /* best-effort persistence */
    }
  }

  getAll(): PermissionRecord & { isElevated: boolean } {
    this.ensureInit()
    return { ...this.permissions, isElevated: this._isElevated }
  }

  getState(id: PermissionId): PermissionState {
    this.ensureInit()
    return this.permissions[id]
  }

  setState(id: PermissionId, state: PermissionState): void {
    this.ensureInit()
    this.permissions[id] = state
    this.save()
  }

  isGranted(id: PermissionId): boolean {
    this.ensureInit()
    if (id === 'admin') return this._isElevated
    return this.permissions[id] === 'granted'
  }

  async requireElevation(): Promise<boolean> {
    this.ensureInit()
    if (this._isElevated) return true
    const platform = process.platform

    try {
      if (platform === 'linux') {
        await execAsync('sudo -n echo "elevated" 2>/dev/null', { timeout: 3000 })
        this._isElevated = true
      } else if (platform === 'darwin') {
        await execAsync(
          'osascript -e \'do shell script "echo elevated" with administrator privileges\'',
          { timeout: 10000 }
        )
        this._isElevated = true
      } else if (platform === 'win32') {
        const { stdout } = await execAsync(
          'powershell -Command "Start-Process cmd -ArgumentList \'/c echo elevated\' -Verb RunAs -Wait"',
          { timeout: 15000 }
        )
        this._isElevated = stdout.includes('elevated')
      }
    } catch {
      this._isElevated = false
    }

    return this._isElevated
  }

  async executeElevated(command: string): Promise<{ stdout: string; stderr: string }> {
    this.ensureInit()
    if (!this._isElevated) {
      throw new Error('Not elevated. Call requireElevation() first.')
    }
    const cmd = process.platform === 'win32' ? command : `sudo -n ${command}`
    return execAsync(cmd, { timeout: 30000 })
  }
}

export const permissionManager = new PermissionManager()

export default function registerPermissionManager(ipcMain: IpcMain): void {
  ipcMain.handle('get-permissions', () => {
    return permissionManager.getAll()
  })

  ipcMain.handle('set-permission', (_event, id: unknown, state: unknown) => {
    const VALID_IDS: ReadonlySet<string> = new Set([
      'admin',
      'filesystem',
      'screen',
      'audio',
      'camera',
      'keyboard',
      'mouse',
      'exec',
      'network',
      'location'
    ])
    const VALID_STATES: ReadonlySet<string> = new Set(['granted', 'denied', 'prompt'])
    if (typeof id !== 'string' || !VALID_IDS.has(id)) {
      return { error: `Invalid permission ID: ${String(id)}` }
    }
    if (typeof state !== 'string' || !VALID_STATES.has(state)) {
      return { error: `Invalid permission state: ${String(state)}` }
    }
    permissionManager.setState(id as PermissionId, state as PermissionState)
    return permissionManager.getAll()
  })

  ipcMain.handle('request-elevation', async () => {
    const result = await permissionManager.requireElevation()
    return { elevated: result, permissions: permissionManager.getAll() }
  })

  ipcMain.handle('execute-elevated', async (_event, command: string) => {
    if (!permissionManager.isGranted('admin')) {
      return {
        success: false,
        error: 'Admin permission not granted. Request elevation first.'
      }
    }
    try {
      const result = await permissionManager.executeElevated(command)
      return { success: true, stdout: result.stdout, stderr: result.stderr }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('get-permission-info', () => {
    return {
      labels: PERMISSION_LABELS,
      descriptions: PERMISSION_DESCRIPTIONS,
      current: permissionManager.getAll()
    }
  })
}

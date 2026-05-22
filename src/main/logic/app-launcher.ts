import { IpcMain } from 'electron'
import { exec } from 'child_process'

const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const isMac = process.platform === 'darwin'

const WIN_PROTECTED_PROCESSES = [
  'explorer.exe',
  'dwm.exe',
  'svchost.exe',
  'lsass.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'taskmgr.exe',
  'system',
  'registry'
]

const LINUX_PROTECTED_PROCESSES = [
  'systemd',
  'init',
  'bash',
  'zsh',
  'sh',
  'dbus-daemon',
  'Xorg',
  'Xwayland',
  'gnome-shell',
  'kde',
  'plasma'
]

const PROTECTED_PROCESSES = isWin ? WIN_PROTECTED_PROCESSES : LINUX_PROTECTED_PROCESSES

const WIN_APP_ALIASES: Record<string, string> = {
  vscode: 'code',
  code: 'code',
  'visual studio code': 'code',
  terminal: 'wt',
  cmd: 'start cmd',
  git: 'start git-bash',
  mongo: 'mongodbcompass',
  mongodb: 'mongodbcompass',
  postman: 'postman',

  chrome: 'start chrome',
  'google chrome': 'start chrome',
  edge: 'start msedge',
  brave: 'start brave',
  firefox: 'start firefox',

  whatsapp: 'start whatsapp:',
  discord: 'Update.exe --processStart Discord.exe',
  spotify: 'start spotify:',
  telegram: 'start telegram:',

  tlauncher: 'TLauncher',
  minecraft: 'MinecraftLauncher',
  'cheat engine': 'Cheat Engine',
  steam: 'start steam:',
  'epic games': 'com.epicgames.launcher:',

  'live wallpaper': 'livelywpf',
  lively: 'livelywpf',
  notepad: 'notepad',
  calculator: 'calc',
  settings: 'start ms-settings:',
  explorer: 'explorer',
  files: 'explorer',
  'task manager': 'taskmgr',
  camera: 'start microsoft.windows.camera:',
  photos: 'start microsoft.windows.photos:'
}

const LINUX_APP_ALIASES: Record<string, string> = {
  vscode: 'code',
  code: 'code',
  'visual studio code': 'code',
  terminal: 'x-terminal-emulator',
  cmd: 'x-terminal-emulator',
  git: 'git',

  chrome: 'google-chrome',
  'google chrome': 'google-chrome',
  chromium: 'chromium-browser',
  edge: 'microsoft-edge',
  brave: 'brave-browser',
  firefox: 'firefox',

  discord: 'discord',
  spotify: 'spotify',
  telegram: 'telegram-desktop',

  steam: 'steam',

  notepad: 'gedit',
  gedit: 'gedit',
  nano: 'x-terminal-emulator -e nano',
  vim: 'x-terminal-emulator -e vim',
  calculator: 'gnome-calculator',
  files: 'nautilus',
  'file manager': 'nautilus',
  'task manager': 'gnome-system-monitor',
  settings: 'gnome-control-center',
  camera: 'cheese'
}

const APP_ALIASES = isWin ? WIN_APP_ALIASES : LINUX_APP_ALIASES

const WIN_PROCESS_NAMES: Record<string, string> = {
  vscode: 'code.exe',
  code: 'code.exe',
  'visual studio code': 'code.exe',
  chrome: 'chrome.exe',
  'google chrome': 'chrome.exe',
  edge: 'msedge.exe',
  brave: 'brave.exe',
  firefox: 'firefox.exe',
  notepad: 'notepad.exe',
  cmd: 'cmd.exe',
  terminal: 'WindowsTerminal.exe',
  whatsapp: 'WhatsApp.exe',
  discord: 'Discord.exe',
  spotify: 'Spotify.exe',
  telegram: 'Telegram.exe',
  steam: 'steam.exe',
  'epic games': 'EpicGamesLauncher.exe',
  camera: 'WindowsCamera.exe',
  calculator: 'CalculatorApp.exe',
  settings: 'SystemSettings.exe',
  'task manager': 'Taskmgr.exe',
  photos: 'Microsoft.Photos.exe',
  explorer: 'explorer.exe',
  files: 'explorer.exe'
}

const LINUX_PROCESS_NAMES: Record<string, string> = {
  vscode: 'code',
  code: 'code',
  'visual studio code': 'code',
  chrome: 'chrome',
  'google chrome': 'chrome',
  chromium: 'chromium-browse',
  brave: 'brave',
  firefox: 'firefox',
  discord: 'discord',
  spotify: 'spotify',
  telegram: 'telegram-desktop',
  steam: 'steam',
  nautilus: 'nautilus',
  gedit: 'gedit',
  'gnome-calculator': 'gnome-calculator'
}

const PROCESS_NAMES = isWin ? WIN_PROCESS_NAMES : LINUX_PROCESS_NAMES

type AppLauncherResult = { success: boolean; message?: string; error?: string }
type AppLauncherResolve = (result: AppLauncherResult) => void

export default function registerAppLauncher(ipcMain: IpcMain): void {
  ipcMain.removeHandler('open-app')
  ipcMain.handle('open-app', async (_event, appName: string) => {
    return new Promise((resolve) => {
      const lowerName = appName.toLowerCase().trim()
      const command = APP_ALIASES[lowerName]

      if (command) {
        executeCommand(command, appName, resolve)
      } else {
        if (isWin) {
          launchViaPowerShell(appName, resolve)
        } else {
          // On Linux/macOS, try xdg-open / open with the app name as-is
          const launchCmd = isMac
            ? `open -a "${appName}"`
            : `xdg-open "${appName}" 2>/dev/null || ${appName} &`
          exec(launchCmd, (error) => {
            if (error) {
              // Last resort: try running the name directly as a command
              exec(`${appName} &`, (err2) => {
                if (err2) {
                  resolve({ success: false, error: `Could not find '${appName}' on this system.` })
                } else {
                  resolve({ success: true, message: `Opened ${appName}` })
                }
              })
            } else {
              resolve({ success: true, message: `Opened ${appName}` })
            }
          })
        }
      }
    })
  })

  ipcMain.removeHandler('close-app')
  ipcMain.handle('close-app', async (_event, appName: string) => {
    return new Promise((resolve) => {
      const lowerName = appName.toLowerCase().trim()
      let processName = PROCESS_NAMES[lowerName]

      if (!processName) {
        if (isWin) {
          processName = appName.endsWith('.exe') ? appName : `${appName}.exe`
        } else {
          processName = appName
        }
      }

      if (PROTECTED_PROCESSES.includes(processName.toLowerCase())) {
        resolve({
          success: false,
          error: `Security Protocol: I cannot close '${appName}' (System Critical Process).`
        })
        return
      }

      let cmd: string
      if (isWin) {
        cmd = `taskkill /IM "${processName}" /F /T`
      } else {
        // Try killall first, fall back to pkill
        cmd = `killall -q "${processName}" 2>/dev/null || pkill -f "${processName}" 2>/dev/null`
      }

      exec(cmd, (error) => {
        if (error) {
          resolve({ success: false, error: `Could not close ${appName}. Is it running?` })
        } else {
          resolve({ success: true, message: `Terminated ${appName}` })
        }
      })
    })
  })
}

function executeCommand(command: string, appName: string, resolve: AppLauncherResolve): void {
  const opts =
    isLinux || isMac ? { env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' } } : {}
  exec(command, opts, (error) => {
    if (error) {
      if (isWin) {
        launchViaPowerShell(appName, resolve)
      } else {
        resolve({ success: false, error: `Could not open '${appName}': ${error.message}` })
      }
    } else {
      resolve({ success: true, message: `Opened ${appName}` })
    }
  })
}

function launchViaPowerShell(appName: string, resolve: AppLauncherResolve): void {
  const psCommand = `powershell -Command "Get-StartApps | Where-Object { $_.Name -like '*${appName}*' } | Select-Object -First 1 -ExpandProperty AppID"`

  exec(psCommand, (error, stdout) => {
    if (error) {
      resolve({
        success: false,
        error: `Could not find '${appName}' on this system. Try opening it manually once.`
      })
      return
    }

    const appId = stdout.trim()

    if (appId) {
      const launchCmd = `start explorer "shell:AppsFolder\\${appId}"`

      exec(launchCmd, (launchErr) => {
        if (launchErr) {
          resolve({ success: false, error: `Found app but could not launch: ${launchErr.message}` })
        } else {
          resolve({ success: true, message: `Opened ${appName} via System Search` })
        }
      })
    } else {
      resolve({
        success: false,
        error: `Could not find '${appName}' on this system. Try opening it manually once.`
      })
    }
  })
}

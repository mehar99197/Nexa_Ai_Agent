import { IpcMain, app, shell, clipboard, screen } from 'electron'
import { keyboard, Key, mouse, Point, Button } from '@nut-tree-fork/nut-js'
import screenshot from 'screenshot-desktop'
import loudness from 'loudness'
import path from 'path'
import { exec } from 'child_process'

keyboard.config.autoDelayMs = 20

const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const isMac = process.platform === 'darwin'

const KEY_MAP: Record<string, Key> = {
  enter: Key.Enter,
  return: Key.Enter,
  space: Key.Space,
  tab: Key.Tab,
  escape: Key.Escape,
  esc: Key.Escape,
  backspace: Key.Backspace,
  shift: Key.LeftShift,
  control: Key.LeftControl,
  ctrl: Key.LeftControl,
  alt: Key.LeftAlt,
  command: Key.LeftSuper,
  win: Key.LeftSuper,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  pageup: Key.PageUp,
  pagedown: Key.PageDown,
  home: Key.Home,
  end: Key.End,
  delete: Key.Delete,
  insert: Key.Insert,
  a: Key.A,
  b: Key.B,
  c: Key.C,
  d: Key.D,
  e: Key.E,
  f: Key.F,
  g: Key.G,
  h: Key.H,
  i: Key.I,
  j: Key.J,
  k: Key.K,
  l: Key.L,
  m: Key.M,
  n: Key.N,
  o: Key.O,
  p: Key.P,
  q: Key.Q,
  r: Key.R,
  s: Key.S,
  t: Key.T,
  u: Key.U,
  v: Key.V,
  w: Key.W,
  x: Key.X,
  y: Key.Y,
  z: Key.Z,
  f1: Key.F1,
  f2: Key.F2,
  f3: Key.F3,
  f4: Key.F4,
  f5: Key.F5,
  f6: Key.F6,
  f7: Key.F7,
  f8: Key.F8,
  f9: Key.F9,
  f10: Key.F10,
  f11: Key.F11,
  f12: Key.F12
}

function generateHumanPath(start: Point, end: Point): Point[] {
  const steps = 25
  const pathArray: Point[] = []

  const directionX = end.x > start.x ? 1 : -1
  const directionY = end.y > start.y ? 1 : -1
  const deviation = Math.random() * 80 + 20

  const controlPoint = new Point(
    start.x +
      (Math.abs(end.x - start.x) / 2) * directionX +
      (Math.random() < 0.5 ? -deviation : deviation),
    start.y +
      (Math.abs(end.y - start.y) / 2) * directionY +
      (Math.random() < 0.5 ? -deviation : deviation)
  )

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlPoint.x + t * t * end.x
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * controlPoint.y + t * t * end.y
    pathArray.push(new Point(x, y))
  }
  return pathArray
}

export default function registerGhostControl(ipcMain: IpcMain): void {
  ipcMain.handle('copy-file-to-clipboard', async (_event, filePath: string) => {
    return new Promise((resolve) => {
      let cmd: string
      if (isWin) {
        cmd = `powershell -command "Set-Clipboard -Path '${filePath}'"`
      } else if (isLinux) {
        // Copy file path text to clipboard (xclip)
        cmd = `echo -n "${filePath}" | xclip -selection clipboard`
      } else {
        cmd = `echo -n "${filePath}" | pbcopy`
      }
      exec(cmd, (error) => {
        if (error) {
          resolve(false)
        } else resolve(true)
      })
    })
  })

  ipcMain.handle('ghost-sequence', async (_event, actions: unknown[]) => {
    try {
      for (const action of actions) {
        if (isGhostPasteAction(action)) {
          clipboard.writeText(action.text)
          await new Promise((r) => setTimeout(r, 200))
          if (isMac) {
            await keyboard.pressKey(Key.LeftSuper, Key.V)
            await keyboard.releaseKey(Key.V, Key.LeftSuper)
          } else {
            await keyboard.pressKey(Key.LeftControl, Key.V)
            await keyboard.releaseKey(Key.V, Key.LeftControl)
          }
        } else if (isGhostWaitAction(action)) {
          await new Promise((r) => setTimeout(r, action.ms))
        } else if (isGhostTypeAction(action)) {
          await keyboard.type(action.text)
        } else if (isGhostPressAction(action)) {
          const k = KEY_MAP[action.key.toLowerCase()]
          if (k !== undefined) {
            if (action.modifiers) {
              const mods = action.modifiers
                .map((mod) => KEY_MAP[mod.toLowerCase()])
                .filter((value): value is Key => Boolean(value))
              for (const mod of mods) await keyboard.pressKey(mod)
              await keyboard.pressKey(k)
              await keyboard.releaseKey(k)
              for (const mod of mods.reverse()) await keyboard.releaseKey(mod)
            } else {
              await keyboard.pressKey(k)
              await keyboard.releaseKey(k)
            }
          }
        } else if (isGhostClickAction(action)) {
          await mouse.leftClick()
        }
      }
      return true
    } catch (_error) {
      return false
    }
  })

  ipcMain.handle('ghost-click-coordinate', async (_event, { x, y, doubleClick }) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor

      const logicalX = Math.round(x / scaleFactor)
      const logicalY = Math.round(y / scaleFactor)

      const startPoint = await mouse.getPosition()
      const endPoint = new Point(logicalX, logicalY)

      const pathPoints = generateHumanPath(startPoint, endPoint)
      await mouse.move(pathPoints)

      if (doubleClick) await mouse.doubleClick(Button.LEFT)
      else await mouse.leftClick()

      return true
    } catch (_error) {
      return false
    }
  })

  ipcMain.handle('ghost-scroll', async (_event, { direction, amount }) => {
    try {
      const scrollAmount = amount || 500
      if (direction === 'up') await mouse.scrollUp(scrollAmount)
      else await mouse.scrollDown(scrollAmount)
      return true
    } catch (_error) {
      return false
    }
  })

  ipcMain.handle('get-screen-size', async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    return {
      width: primaryDisplay.size.width * primaryDisplay.scaleFactor,
      height: primaryDisplay.size.height * primaryDisplay.scaleFactor
    }
  })

  ipcMain.handle('set-volume', async (_event, level: number) => {
    try {
      if (isLinux) {
        // Use pactl (PulseAudio/PipeWire) or amixer (ALSA) as fallback
        await new Promise<void>((resolve, reject) => {
          exec(`pactl set-sink-volume @DEFAULT_SINK@ ${level}%`, (err) => {
            if (err) {
              // Fallback to amixer
              exec(`amixer set Master ${level}%`, (err2) => {
                if (err2) reject(err2)
                else resolve()
              })
            } else resolve()
          })
        })
        return `Volume ${level}%`
      } else {
        await loudness.setVolume(level)
        return `Volume ${level}%`
      }
    } catch (_error) {
      return 'Error'
    }
  })

  ipcMain.handle('take-screenshot', async () => {
    try {
      const filename = `Nexa_Capture_${Date.now()}.png`
      const savePath = path.join(app.getPath('pictures'), filename)
      await screenshot({ filename: savePath })
      shell.showItemInFolder(savePath)
      return `Screenshot saved.`
    } catch (_error) {
      return 'Error'
    }
  })
}

type GhostActionBase = { type: string }
type GhostPasteAction = GhostActionBase & { type: 'paste'; text: string }
type GhostWaitAction = GhostActionBase & { type: 'wait'; ms?: number }
type GhostTypeAction = GhostActionBase & { type: 'type'; text: string }
type GhostPressAction = GhostActionBase & { type: 'press'; key: string; modifiers?: string[] }
type GhostClickAction = GhostActionBase & { type: 'click' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object')

const isGhostPasteAction = (value: unknown): value is GhostPasteAction =>
  isRecord(value) && value.type === 'paste' && typeof value.text === 'string'

const isGhostWaitAction = (value: unknown): value is GhostWaitAction =>
  isRecord(value) &&
  value.type === 'wait' &&
  (typeof value.ms === 'number' || value.ms === undefined)

const isGhostTypeAction = (value: unknown): value is GhostTypeAction =>
  isRecord(value) && value.type === 'type' && typeof value.text === 'string'

const isGhostPressAction = (value: unknown): value is GhostPressAction =>
  isRecord(value) &&
  value.type === 'press' &&
  typeof value.key === 'string' &&
  (value.modifiers === undefined || Array.isArray(value.modifiers))

const isGhostClickAction = (value: unknown): value is GhostClickAction =>
  isRecord(value) && value.type === 'click'

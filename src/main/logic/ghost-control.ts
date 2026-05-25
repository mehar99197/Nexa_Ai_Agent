import { IpcMain, app, shell, clipboard, screen } from 'electron'
import { keyboard, Key, mouse, Point, Button } from '@nut-tree-fork/nut-js'
import screenshot from 'screenshot-desktop'
import loudness from 'loudness'
import path from 'path'
import { exec } from 'child_process'

keyboard.config.autoDelayMs = 15
mouse.config.autoDelayMs = 2

const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const isMac = process.platform === 'darwin'

const KEY_MAP: Record<string, Key> = {
  // Letters
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
  // Numbers
  0: Key.Num0,
  1: Key.Num1,
  2: Key.Num2,
  3: Key.Num3,
  4: Key.Num4,
  5: Key.Num5,
  6: Key.Num6,
  7: Key.Num7,
  8: Key.Num8,
  9: Key.Num9,
  // Modifiers
  shift: Key.LeftShift,
  lshift: Key.LeftShift,
  rshift: Key.RightShift,
  control: Key.LeftControl,
  ctrl: Key.LeftControl,
  lctrl: Key.LeftControl,
  rctrl: Key.RightControl,
  alt: Key.LeftAlt,
  lalt: Key.LeftAlt,
  ralt: Key.RightAlt,
  command: Key.LeftSuper,
  cmd: Key.LeftSuper,
  win: Key.LeftSuper,
  super: Key.LeftSuper,
  lsuper: Key.LeftSuper,
  rsuper: Key.RightSuper,
  // Navigation
  enter: Key.Enter,
  return: Key.Enter,
  space: Key.Space,
  tab: Key.Tab,
  escape: Key.Escape,
  esc: Key.Escape,
  backspace: Key.Backspace,
  bs: Key.Backspace,
  delete: Key.Delete,
  del: Key.Delete,
  insert: Key.Insert,
  ins: Key.Insert,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  pageup: Key.PageUp,
  pgup: Key.PageUp,
  pagedown: Key.PageDown,
  pgdn: Key.PageDown,
  home: Key.Home,
  end: Key.End,
  // Function keys
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
  f12: Key.F12,
  f13: Key.F13,
  f14: Key.F14,
  f15: Key.F15,
  f16: Key.F16,
  f17: Key.F17,
  f18: Key.F18,
  f19: Key.F19,
  f20: Key.F20,
  f21: Key.F21,
  f22: Key.F22,
  f23: Key.F23,
  f24: Key.F24,
  // Numpad
  num0: Key.Num0,
  num1: Key.Num1,
  num2: Key.Num2,
  num3: Key.Num3,
  num4: Key.Num4,
  num5: Key.Num5,
  num6: Key.Num6,
  num7: Key.Num7,
  num8: Key.Num8,
  num9: Key.Num9,
  numlock: Key.NumLock,
  numlk: Key.NumLock,
  multiply: Key.Multiply,
  nummul: Key.Multiply,
  divide: Key.Divide,
  numdiv: Key.Divide,
  add: Key.Add,
  numadd: Key.Add,
  subtract: Key.Subtract,
  numsub: Key.Subtract,
  decimal: Key.Decimal,
  numdot: Key.Decimal,
  // Symbols (mapped via nut-js when available)
  comma: Key.Comma,
  period: Key.Period,
  dot: Key.Period,
  semicolon: Key.Semicolon,
  quote: Key.Quote,
  apostrophe: Key.Quote,
  bracket_left: Key.LeftBracket,
  '[': Key.LeftBracket,
  bracket_right: Key.RightBracket,
  ']': Key.RightBracket,
  backslash: Key.Backslash,
  '\\': Key.Backslash,
  minus: Key.Minus,
  dash: Key.Minus,
  '-': Key.Minus,
  equals: Key.Equal,
  equal: Key.Equal,
  '=': Key.Equal,
  grave: Key.Grave,
  backtick: Key.Grave,
  '`': Key.Grave,
  // Media / special
  capslock: Key.CapsLock,
  caps: Key.CapsLock,
  scrolllock: Key.ScrollLock,
  scrlk: Key.ScrollLock,
  pause: Key.Pause,
  break: Key.Pause,
  printscreen: Key.Print,
  prtsc: Key.Print,
  menu: Key.Menu,
  apps: Key.Menu
}

export { KEY_MAP }

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
        cmd = `echo -n "${filePath}" | xclip -selection clipboard`
      } else {
        cmd = `echo -n "${filePath}" | pbcopy`
      }
      exec(cmd, (error) => {
        if (error) resolve(false)
        else resolve(true)
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
              for (const mod of [...mods].reverse()) await keyboard.releaseKey(mod)
            } else {
              await keyboard.pressKey(k)
              await keyboard.releaseKey(k)
            }
          }
        } else if (isGhostKeyAction(action)) {
          const k = KEY_MAP[action.key.toLowerCase()]
          if (k !== undefined) {
            if (action.state === 'hold' || action.state === 'down') {
              await keyboard.pressKey(k)
            } else {
              await keyboard.releaseKey(k)
            }
          }
        } else if (isGhostClickAction(action)) {
          if (action.button === 'right') await mouse.rightClick()
          else if (action.button === 'middle') await mouse.click(Button.MIDDLE)
          else if (action.double) await mouse.doubleClick(Button.LEFT)
          else await mouse.leftClick()
        } else if (isGhostMoveAction(action)) {
          const primaryDisplay = screen.getPrimaryDisplay()
          const scaleFactor = primaryDisplay.scaleFactor
          const endPoint = new Point(
            Math.round(action.x / scaleFactor),
            Math.round(action.y / scaleFactor)
          )
          const startPoint = await mouse.getPosition()
          const pathPoints = generateHumanPath(startPoint, endPoint)
          await mouse.move(pathPoints)
        } else if (isGhostDragAction(action)) {
          const primaryDisplay = screen.getPrimaryDisplay()
          const scaleFactor = primaryDisplay.scaleFactor
          const endPoint = new Point(
            Math.round(action.x / scaleFactor),
            Math.round(action.y / scaleFactor)
          )
          const startPoint = await mouse.getPosition()
          const pathPoints = generateHumanPath(startPoint, endPoint)
          await mouse.pressButton(Button.LEFT)
          await mouse.move(pathPoints)
          await mouse.releaseButton(Button.LEFT)
        }
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('ghost-click-coordinate', async (_event, { x, y, doubleClick, button }) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor
      const logicalX = Math.round(x / scaleFactor)
      const logicalY = Math.round(y / scaleFactor)

      const startPoint = await mouse.getPosition()
      const endPoint = new Point(logicalX, logicalY)
      const pathPoints = generateHumanPath(startPoint, endPoint)
      await mouse.move(pathPoints)

      if (doubleClick) {
        await mouse.doubleClick(Button.LEFT)
      } else if (button === 'right') {
        await mouse.rightClick()
      } else if (button === 'middle') {
        await mouse.click(Button.MIDDLE)
      } else {
        await mouse.leftClick()
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('ghost-mouse-move', async (_event, { x, y }) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor
      const endPoint = new Point(Math.round(x / scaleFactor), Math.round(y / scaleFactor))
      const startPoint = await mouse.getPosition()
      const pathPoints = generateHumanPath(startPoint, endPoint)
      await mouse.move(pathPoints)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('ghost-drag', async (_event, { x, y, button }) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor
      const endPoint = new Point(Math.round(x / scaleFactor), Math.round(y / scaleFactor))
      const btn = button === 'right' ? Button.RIGHT : Button.LEFT
      const startPoint = await mouse.getPosition()
      const pathPoints = generateHumanPath(startPoint, endPoint)
      await mouse.pressButton(btn)
      await mouse.move(pathPoints)
      await mouse.releaseButton(btn)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('ghost-scroll', async (_event, { direction, amount }) => {
    try {
      const scrollAmount = amount || 500
      if (direction === 'up') await mouse.scrollUp(scrollAmount)
      else if (direction === 'down') await mouse.scrollDown(scrollAmount)
      else if (direction === 'left') await mouse.scrollLeft(scrollAmount)
      else if (direction === 'right') await mouse.scrollRight(scrollAmount)
      return true
    } catch {
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

  ipcMain.handle('ghost-mouse-position', async () => {
    try {
      const pos = await mouse.getPosition()
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor
      return {
        x: Math.round(pos.x * scaleFactor),
        y: Math.round(pos.y * scaleFactor)
      }
    } catch {
      return { x: 0, y: 0 }
    }
  })

  ipcMain.handle('set-volume', async (_event, level: number) => {
    try {
      if (isLinux) {
        await new Promise<void>((resolve, reject) => {
          exec(`pactl set-sink-volume @DEFAULT_SINK@ ${level}%`, (err) => {
            if (err) {
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
    } catch {
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
    } catch {
      return 'Error'
    }
  })

  ipcMain.handle('ghost-key', async (_event, { key, state }) => {
    try {
      const k = KEY_MAP[key.toLowerCase()]
      if (k === undefined) return false
      if (state === 'hold' || state === 'down') {
        await keyboard.pressKey(k)
      } else {
        await keyboard.releaseKey(k)
      }
      return true
    } catch {
      return false
    }
  })
}

// --- Action types ---

type GhostActionBase = { type: string }

interface GhostPasteAction extends GhostActionBase {
  type: 'paste'
  text: string
}
interface GhostWaitAction extends GhostActionBase {
  type: 'wait'
  ms: number
}
interface GhostTypeAction extends GhostActionBase {
  type: 'type'
  text: string
}
interface GhostPressAction extends GhostActionBase {
  type: 'press'
  key: string
  modifiers?: string[]
}
interface GhostKeyAction extends GhostActionBase {
  type: 'key'
  key: string
  state: 'hold' | 'release' | 'down' | 'up'
}
interface GhostClickAction extends GhostActionBase {
  type: 'click'
  button?: 'left' | 'right' | 'middle'
  double?: boolean
}
interface GhostMoveAction extends GhostActionBase {
  type: 'move'
  x: number
  y: number
}
interface GhostDragAction extends GhostActionBase {
  type: 'drag'
  x: number
  y: number
  button?: 'left' | 'right'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object')

const isGhostPasteAction = (value: unknown): value is GhostPasteAction =>
  isRecord(value) && value.type === 'paste' && typeof value.text === 'string'

const isGhostWaitAction = (value: unknown): value is GhostWaitAction =>
  isRecord(value) && value.type === 'wait' && typeof value.ms === 'number'

const isGhostTypeAction = (value: unknown): value is GhostTypeAction =>
  isRecord(value) && value.type === 'type' && typeof value.text === 'string'

const isGhostPressAction = (value: unknown): value is GhostPressAction =>
  isRecord(value) &&
  value.type === 'press' &&
  typeof value.key === 'string' &&
  (value.modifiers === undefined || Array.isArray(value.modifiers))

const isGhostKeyAction = (value: unknown): value is GhostKeyAction =>
  isRecord(value) &&
  value.type === 'key' &&
  typeof value.key === 'string' &&
  (value.state === 'hold' ||
    value.state === 'release' ||
    value.state === 'down' ||
    value.state === 'up')

const isGhostClickAction = (value: unknown): value is GhostClickAction =>
  isRecord(value) &&
  value.type === 'click' &&
  (value.button === undefined ||
    value.button === 'left' ||
    value.button === 'right' ||
    value.button === 'middle')

const isGhostMoveAction = (value: unknown): value is GhostMoveAction =>
  isRecord(value) &&
  value.type === 'move' &&
  typeof value.x === 'number' &&
  typeof value.y === 'number'

const isGhostDragAction = (value: unknown): value is GhostDragAction =>
  isRecord(value) &&
  value.type === 'drag' &&
  typeof value.x === 'number' &&
  typeof value.y === 'number'

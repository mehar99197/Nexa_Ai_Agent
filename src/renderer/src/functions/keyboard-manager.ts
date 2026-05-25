// Volume
const setVolume = async (level: number): Promise<string> => {
  try {
    return await window.electron.ipcRenderer.invoke('set-volume', level)
  } catch {
    return 'Failed to set volume.'
  }
}

// Screenshot
const takeScreenshot = async (): Promise<string> => {
  try {
    return await window.electron.ipcRenderer.invoke('take-screenshot')
  } catch {
    return 'Failed to capture screen.'
  }
}

// Screen size
const getScreenSize = async (): Promise<{ width: number; height: number }> => {
  return await window.electron.ipcRenderer.invoke('get-screen-size')
}

// Mouse click at coordinates
const clickOnCoordinate = async (
  x: number,
  y: number,
  doubleClick?: boolean,
  button?: 'left' | 'right' | 'middle'
): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-click-coordinate', { x, y, doubleClick, button })
  return `Clicked ${button || 'left'}${doubleClick ? ' double' : ''} at (${x}, ${y})`
}

// Mouse move to coordinates
const mouseMoveTo = async (x: number, y: number): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-mouse-move', { x, y })
  return `Moved mouse to (${x}, ${y})`
}

// Drag from current position to target
const mouseDragTo = async (
  x: number,
  y: number,
  button?: 'left' | 'right'
): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-drag', { x, y, button })
  return `Dragged to (${x}, ${y})`
}

// Get current mouse position
const getMousePosition = async (): Promise<{ x: number; y: number }> => {
  return await window.electron.ipcRenderer.invoke('ghost-mouse-position')
}

// Scroll
const scrollScreen = async (
  direction: 'up' | 'down' | 'left' | 'right',
  amount: number
): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-scroll', { direction, amount })
  return `Scrolled ${direction}.`
}

// Keyboard shortcuts
const pressShortcut = async (key: string, modifiers: string[]): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-sequence', [
    { type: 'press', key, modifiers }
  ])
  return `Pressed ${modifiers.join('+')}+${key}`
}

// Key hold/release
const keyAction = async (
  key: string,
  state: 'hold' | 'release'
): Promise<boolean> => {
  return await window.electron.ipcRenderer.invoke('ghost-key', { key, state })
}

// Type text
const ghostType = async (text: string): Promise<string> => {
  await window.electron.ipcRenderer.invoke('ghost-sequence', [{ type: 'type', text }])
  return `Typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
}

// Execute sequence of actions
const executeGhostSequence = async (actions: unknown[]): Promise<boolean> => {
  return await window.electron.ipcRenderer.invoke('ghost-sequence', actions)
}

export {
  setVolume,
  takeScreenshot,
  getScreenSize,
  clickOnCoordinate,
  mouseMoveTo,
  mouseDragTo,
  getMousePosition,
  scrollScreen,
  pressShortcut,
  keyAction,
  ghostType,
  executeGhostSequence
}

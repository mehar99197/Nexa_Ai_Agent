export type ToastKind = 'info' | 'warn' | 'error' | 'success'
export type Toast = { id: number; kind: ToastKind; title: string; detail?: string }

// Module-scoped queue + dispatcher so any code (even non-component utilities
// like tools/services) can fire a HUD by importing `showHud(...)`.
let nextId = 1
const listeners = new Set<(toasts: Toast[]) => void>()
let toasts: Toast[] = []

const publish = (): void => {
  listeners.forEach((listener) => listener(toasts))
}

export const getHudToasts = (): Toast[] => toasts

export const subscribeHudToasts = (listener: (toasts: Toast[]) => void): (() => void) => {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}

export const showHud = (
  title: string,
  detail?: string,
  kind: ToastKind = 'info',
  durationMs = 4500
): void => {
  const id = nextId++
  toasts = [...toasts, { id, kind, title, detail }]
  publish()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    publish()
  }, durationMs)
}

// Drop-in replacement for window.alert() with a themed appearance.
export const hudAlert = (msg: string, kind: ToastKind = 'warn'): void => {
  const [title, ...rest] = String(msg).split('\n')
  showHud(title, rest.join('\n') || undefined, kind, 6500)
}

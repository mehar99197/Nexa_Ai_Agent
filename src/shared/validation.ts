// Pure validation helpers used by main-process IPC handlers and by tests.
// Nothing in here imports Electron or Node-only modules, so it can be
// imported from anywhere and unit-tested in isolation.

/**
 * Returns the trimmed app name if it consists only of safe characters,
 * otherwise null. App names get interpolated into shell strings on the
 * fallback paths (PowerShell Get-StartApps, xdg-open, taskkill /IM,
 * killall/pkill). Letters, digits, spaces, dots, dashes, underscores,
 * plus, and colon are allowed (URI schemes already in the alias map).
 */
export function sanitizeAppName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) return null
  if (!/^[A-Za-z0-9 ._+\-:]+$/.test(trimmed)) return null
  return trimmed
}

/** Cheap structural JWT check — 3 dot-separated base64url segments. */
export function looksLikeJwt(token: unknown): token is string {
  return typeof token === 'string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
}

/** IPv4 dotted-quad shape check (does not range-validate octets). */
export function isIPv4(input: unknown): input is string {
  if (typeof input !== 'string') return false
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(input)
}

/** TCP port number — must be an integer in [1, 65535]. */
export function isValidPort(input: unknown): input is number {
  const n = typeof input === 'number' ? input : Number(input)
  return Number.isInteger(n) && n >= 1 && n <= 65535
}

/** Rejects non-strings, empty strings, and strings containing NUL bytes. */
export function isSafePath(p: unknown): p is string {
  return typeof p === 'string' && p.length > 0 && !p.includes('\0')
}

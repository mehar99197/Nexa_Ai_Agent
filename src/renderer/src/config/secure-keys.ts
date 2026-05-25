// Centralized accessor for API keys. Keys live in the OS keychain via
// safeStorage in the main process; we keep an in-memory cache here so the
// renderer doesn't IPC on every read. localStorage is only used as a
// transitional fallback for upgrade paths (cleared after migration).

type CachedKeys = {
  geminiKey?: string
  groqKey?: string
  hfKey?: string
  tavilyKey?: string
}

let cache: CachedKeys | null = null
let inflight: Promise<CachedKeys> | null = null

async function fetchKeys(): Promise<CachedKeys> {
  const ipc = (window as any).electron?.ipcRenderer
  if (!ipc) return {}
  try {
    const res = await ipc.invoke('secure-get-keys')
    return (res || {}) as CachedKeys
  } catch {
    return {}
  }
}

export async function loadSecureKeys(force = false): Promise<CachedKeys> {
  if (cache && !force) return cache
  if (inflight) return inflight
  inflight = fetchKeys().then((keys) => {
    cache = keys
    inflight = null
    return keys
  })
  return inflight
}

// Synchronous accessor — returns cached value, or empty string if not loaded
// yet. Callers that need a guarantee should `await loadSecureKeys()` first.
export function getCachedKey(name: keyof CachedKeys): string {
  return cache?.[name] || ''
}

export async function getSecureKey(name: keyof CachedKeys): Promise<string> {
  const keys = await loadSecureKeys()
  return keys[name] || ''
}

export async function saveSecureKeys(keys: Partial<CachedKeys>): Promise<boolean> {
  const ipc = (window as any).electron?.ipcRenderer
  if (!ipc) return false
  try {
    const res = await ipc.invoke('secure-save-keys', keys)
    if (res?.success) {
      // Invalidate cache so subsequent reads pull the new values.
      await loadSecureKeys(true)
      return true
    }
    return false
  } catch {
    return false
  }
}

// One-shot migration: if the user has keys in localStorage from a previous
// build, push them into safeStorage and wipe the plaintext copy.
export async function migrateLegacyLocalStorageKeys(): Promise<void> {
  const candidates: Array<[keyof CachedKeys, string]> = [
    ['geminiKey', 'nexa_custom_api_key'],
    ['groqKey', 'nexa_groq_api_key'],
    ['hfKey', 'nexa_hf_api_key'],
    ['tavilyKey', 'nexa_tailvy_api_key']
  ]
  const toSave: Partial<CachedKeys> = {}
  for (const [field, lsKey] of candidates) {
    const v = localStorage.getItem(lsKey)
    if (v && v.trim()) {
      toSave[field] = v.trim()
    }
  }
  if (Object.keys(toSave).length === 0) return
  const ok = await saveSecureKeys(toSave)
  if (ok) {
    for (const [, lsKey] of candidates) localStorage.removeItem(lsKey)
  }
}

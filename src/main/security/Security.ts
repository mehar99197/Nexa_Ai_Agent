import { ipcMain } from 'electron'
import Store from 'electron-store'
import bcrypt from 'bcryptjs'

const StoreClass = (Store as unknown as { default?: typeof Store }).default ?? Store
const store = new StoreClass()

export default function registerSecurityVault(): void {
  const legacyFace = store.get('nexa_vault_face') as number[] | undefined
  if (legacyFace && !store.get('nexa_vault_faces')) {
    store.set('nexa_vault_faces', [legacyFace])
    store.delete('nexa_vault_face')
  }

  ipcMain.handle('check-vault-status', () => {
    const hasPin = !!store.get('nexa_vault_hash')
    const faces = store.get('nexa_vault_faces') as number[][] | undefined
    const hasFace = faces && faces.length > 0
    return { hasPin, hasFace, faceCount: faces ? faces.length : 0 }
  })

  ipcMain.handle('get-personality', () => {
    return store.get('nexa_personality') as string | undefined
  })

  ipcMain.handle('set-personality', (_, text: string) => {
    store.set('nexa_personality', text)
    return true
  })

  ipcMain.handle('setup-vault-pin', async (_, pin: string) => {
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(pin, salt)
    store.set('nexa_vault_hash', hash)
    return true
  })

  ipcMain.handle('verify-vault-pin', async (_, pin: string) => {
    const hash = store.get('nexa_vault_hash') as string
    if (!hash) return false
    return await bcrypt.compare(pin, hash)
  })

  ipcMain.handle('setup-vault-face', (_, descriptor: number[]) => {
    const faces = (store.get('nexa_vault_faces') as number[][]) || []
    faces.push(descriptor)
    store.set('nexa_vault_faces', faces)
    return true
  })

  ipcMain.handle('verify-vault-face', (_, descriptor: number[]) => {
    // Defensive shape check — IPC payload is untrusted.
    if (!Array.isArray(descriptor) || descriptor.length !== 128) return false
    for (const v of descriptor) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return false
    }

    const faces = store.get('nexa_vault_faces') as number[][] | undefined
    if (!faces || faces.length === 0) return false

    // Tighter threshold for 128-dim face descriptors. 0.55 was too permissive
    // (false positives — a different person could unlock); 0.45 matches the
    // commonly cited face-api.js production threshold.
    const MATCH_THRESHOLD = 0.45
    for (const savedFace of faces) {
      if (savedFace.length !== 128) continue
      let distance = 0
      for (let i = 0; i < descriptor.length; i++) {
        distance += Math.pow(descriptor[i] - savedFace[i], 2)
      }
      distance = Math.sqrt(distance)

      if (distance < MATCH_THRESHOLD) return true
    }
    return false
  })
}

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

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

interface PermissionInfo {
  labels: Record<PermissionId, string>
  descriptions: Record<PermissionId, string>
  current: Record<PermissionId, PermissionState> & { isElevated: boolean }
}

interface PermissionStore {
  permissions: Record<PermissionId, PermissionState> | null
  isElevated: boolean
  info: PermissionInfo | null
  loading: boolean
  loadPermissions: () => Promise<void>
  loadInfo: () => Promise<void>
  setPermission: (id: PermissionId, state: PermissionState) => Promise<void>
  requestElevation: () => Promise<boolean>
  executeElevated: (command: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
}

export const usePermissionStore = create<PermissionStore>()(
  immer((set) => ({
    permissions: null,
    isElevated: false,
    info: null,
    loading: false,

    loadPermissions: async () => {
      set((s) => { s.loading = true })
      try {
        const result: Record<string, unknown> = await window.electron.ipcRenderer.invoke('get-permissions')
        const { isElevated, ...permRecord } = result
        set((s) => {
          s.permissions = permRecord as Record<import('./permission-store').PermissionId, import('./permission-store').PermissionState>
          s.isElevated = Boolean(isElevated)
          s.loading = false
        })
      } catch {
        set((s) => { s.loading = false })
      }
    },

    loadInfo: async () => {
      try {
        const info = await window.electron.ipcRenderer.invoke('get-permission-info')
        set((s) => { s.info = info })
      } catch { /* ignore */ }
    },

    setPermission: async (id, state) => {
      try {
        const result: Record<string, unknown> = await window.electron.ipcRenderer.invoke('set-permission', id, state)
        const { isElevated, ...permRecord } = result
        set((s) => {
          s.permissions = permRecord as Record<import('./permission-store').PermissionId, import('./permission-store').PermissionState>
          s.isElevated = Boolean(isElevated)
        })
      } catch { /* ignore */ }
    },

    requestElevation: async () => {
      try {
        const result: Record<string, unknown> = await window.electron.ipcRenderer.invoke('request-elevation')
        const elevated = Boolean(result.elevated)
        set((s) => {
          s.isElevated = elevated
          if (result.permissions) {
            const perms = result.permissions as Record<string, unknown>
            const { isElevated: _e, ...permRecord } = perms
            s.permissions = permRecord as Record<import('./permission-store').PermissionId, import('./permission-store').PermissionState>
          }
        })
        return elevated
      } catch {
        return false
      }
    },

    executeElevated: async (command) => {
      try {
        return await window.electron.ipcRenderer.invoke('execute-elevated', command)
      } catch {
        return { success: false, error: 'Failed to execute elevated command' }
      }
    }
  }))
)

export interface SystemStats {
  cpu: string
  memory: {
    total: string
    free: string
    usedPercentage: string
  }
  temperature: number
  os: {
    type: string
    uptime: string
  }
}

export interface AppItem {
  name: string
  id: string
}

export interface BatteryInfo {
  percent: number
  isCharging: boolean
  hasBattery: boolean
}

export const getBatteryInfo = async (): Promise<BatteryInfo> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-battery-info')
  } catch {
    return { percent: 100, isCharging: true, hasBattery: false }
  }
}

export const getSystemStatus = async (): Promise<SystemStats | null> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-system-stats')
  } catch (error) {
    return null
  }
}

export const getAllApps = async (): Promise<AppItem[]> => {
  try {
    const apps = await window.electron.ipcRenderer.invoke('get-installed-apps')
    return Array.isArray(apps) ? apps : []
  } catch (error) {
    return []
  }
}

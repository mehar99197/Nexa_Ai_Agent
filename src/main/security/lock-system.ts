import { ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'

export default function registerLockSystem(): void {
  ipcMain.on('trigger-lockdown', (event) => {
    if (is.dev) console.log('[lock-system] tactical lockdown initiated via AI')
    event.sender.reload()
  })
}

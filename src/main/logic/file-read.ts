import { IpcMain } from 'electron'
import fs from 'fs/promises'

export default function registerFileRead(ipcMain: IpcMain): void {
  ipcMain.handle('read-file', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath.trim() || filePath.includes('\0')) {
      return 'Error reading file: invalid path'
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content.length > 2000 ? content.slice(0, 2000) + '\n...(Truncated)' : content
    } catch (err) {
      // Don't echo the raw error object back to the renderer — it can contain
      // OS paths or other host-internal details. Send a generic message.
      const code = (err as NodeJS.ErrnoException)?.code
      return code ? `Error reading file: ${code}` : 'Error reading file.'
    }
  })
}

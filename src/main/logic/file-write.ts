import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

export default function registerFileWrite(ipcMain: IpcMain): void {
  ipcMain.handle('write-file', async (_event, payload) => {
    try {
      // Defensive shape check — IPC inputs are untrusted JSON.
      if (!payload || typeof payload !== 'object') {
        return 'Error writing file: invalid payload'
      }
      const { fileName, content } = payload as { fileName?: unknown; content?: unknown }
      if (typeof fileName !== 'string' || !fileName.trim()) {
        return 'Error writing file: fileName must be a non-empty string'
      }
      if (typeof content !== 'string') {
        return 'Error writing file: content must be a string'
      }
      // POSIX paths treat NULs as terminators; node would throw a confusing error.
      if (fileName.includes('\0')) {
        return 'Error writing file: fileName contains a null byte'
      }

      const isAbsolutePath = fileName.includes('/') || fileName.includes('\\')
      const targetPath = isAbsolutePath ? fileName : path.join(app.getPath('desktop'), fileName)

      await fs.writeFile(targetPath, content, 'utf-8')
      return `Success. File saved to: ${targetPath}`
    } catch (err) {
      return `Error writing file: ${err instanceof Error ? err.message : String(err)}`
    }
  })
}

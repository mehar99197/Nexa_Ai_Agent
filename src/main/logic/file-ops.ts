import { IpcMain } from 'electron'
import fs from 'fs/promises'

import { isSafePath } from '../../shared/validation'

export default function registerFileOps(ipcMain: IpcMain): void {
  ipcMain.handle('file-ops', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        return 'Error: invalid payload'
      }
      const { operation, sourcePath, destPath } = payload as {
        operation?: unknown
        sourcePath?: unknown
        destPath?: unknown
      }
      if (!isSafePath(sourcePath)) return 'Error: sourcePath must be a non-empty string.'

      switch (operation) {
        case 'copy':
          if (!isSafePath(destPath)) return 'Error: Destination path required for copy.'
          await fs.cp(sourcePath, destPath, { recursive: true })
          return `Success: Copied to ${destPath}`

        case 'move':
          if (!isSafePath(destPath)) return 'Error: Destination path required for move.'
          await fs.rename(sourcePath, destPath)
          return `Success: Moved to ${destPath}`

        case 'delete':
          await fs.rm(sourcePath, { recursive: true, force: true })
          return `Success: Deleted ${sourcePath}`

        default:
          return `Error: Unknown operation '${String(operation)}'`
      }
    } catch (err) {
      return `System Error: ${err instanceof Error ? err.message : String(err)}`
    }
  })
}

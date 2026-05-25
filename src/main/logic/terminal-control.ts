import { IpcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'

export default function registerSystemControl(ipcMain: IpcMain): void {
  const sanitizePath = (inputPath: string): string => {
    let clean = path.normalize(inputPath)
    if (clean.endsWith(path.sep)) clean = clean.slice(0, -1)
    return clean
  }

  ipcMain.handle('run-shell-command', async (_event, payload) => {
    return new Promise((resolve) => {
      if (!payload || typeof payload !== 'object') {
        resolve({ success: false, output: 'Invalid payload' })
        return
      }
      const { command, cwd } = payload as { command?: unknown; cwd?: unknown }
      if (typeof command !== 'string' || !command.trim()) {
        resolve({ success: false, output: 'Command must be a non-empty string.' })
        return
      }
      if (cwd !== undefined && (typeof cwd !== 'string' || cwd.includes('\0'))) {
        resolve({ success: false, output: 'Invalid cwd.' })
        return
      }
      const safeCwd = cwd ? sanitizePath(cwd as string) : undefined

      const win = BrowserWindow.getAllWindows()[0]

      const isWin = process.platform === 'win32'
      const shell = isWin ? 'powershell.exe' : '/bin/sh'
      const args = isWin ? ['-Command', command] : ['-c', command]

      const child = spawn(shell, args, {
        cwd: safeCwd,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      child.stdout.on('data', (data) => {
        const output = data.toString()
        if (win) win.webContents.send('terminal-data', output)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        if (win) win.webContents.send('terminal-data', `\x1b[31m${output}\x1b[0m`)
      })

      child.on('close', (code) => {
        const msg = `\r\n[Process exited with code ${code}]\r\n`
        if (win) win.webContents.send('terminal-data', msg)
        resolve({ success: code === 0, output: `Completed with code ${code}` })
      })

      child.on('error', (err) => {
        if (win) win.webContents.send('terminal-data', `Error: ${err.message}`)
        resolve({ success: false, output: err.message })
      })
    })
  })
}

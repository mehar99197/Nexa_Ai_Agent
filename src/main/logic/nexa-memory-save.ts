import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'

type ChatMessage = {
  role: string
  content: string
  timestamp: string
}

type StoredMessage = {
  role?: string
  content?: string
}

type HistoryEntry = {
  role: string
  parts: { text: string }[]
}

export default function registerIpcHandlers({
  ipcMain,
  app
}: {
  ipcMain: IpcMain
  app: App
}): void {
  const CHAT_DIR = path.resolve(app.getPath('userData'), 'Chat')
  const FILE_PATH = path.join(CHAT_DIR, 'nexa_memory.json')

  ipcMain.removeHandler('add-message')
  ipcMain.removeHandler('get-history')

  ipcMain.handle('add-message', async (_event, msg) => {
    try {
      if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true })

      let history: ChatMessage[] = []
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        history = data ? JSON.parse(data) : []
      }

      const newEntry: ChatMessage = {
        role: msg.role,
        content: msg.parts[0].text,
        timestamp: new Date().toISOString()
      }
      history.push(newEntry)

      if (history.length > 20) history = history.slice(-20)

      fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2))
      return true
    } catch (_error) {
      return false
    }
  })

  ipcMain.handle('get-history', async () => {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        const raw = JSON.parse(data) as StoredMessage[]

        const filtered = raw.filter((m) => {
          const text: string = m.content || ''
          if (text.includes('[System Notice]') || text.includes('Context update only')) return false
          if (
            /^context updated|^acknowledged|^noted|no reply necessary|no response necessary/i.test(
              text
            )
          )
            return false
          return true
        })

        return filtered.map(
          (m): HistoryEntry => ({
            role: m.role === 'nexa' ? 'model' : m.role || 'user',
            parts: [{ text: m.content || '' }]
          })
        )
      }
    } catch (_error) {
      void _error
    }
    return []
  })
}

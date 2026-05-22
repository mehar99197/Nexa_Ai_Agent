import { IpcMain, app, shell, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

export default function registerGalleryHandlers(ipcMain: IpcMain): void {
  const GALLERY_DIR = path.resolve(app.getPath('userData'), 'Gallery')

  if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true })
  }

  ipcMain.handle('get-gallery', async () => {
    try {
      if (!fs.existsSync(GALLERY_DIR)) return []

      const files = fs
        .readdirSync(GALLERY_DIR)
        .filter((file) => /\.(png|jpg|jpeg|webp|gif)$/i.test(file))

      return files
        .map((file) => {
          const filePath = path.join(GALLERY_DIR, file)
          const stats = fs.statSync(filePath)

          const fileUrl = pathToFileURL(filePath).href

          return {
            filename: file,
            displayName: file.replace(/_\d+_Generated_by_Nexa\.png$/, '').replace(/_/g, ' '),
            path: filePath,
            url: fileUrl,
            createdAt: stats.birthtime
          }
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch {
      return []
    }
  })

  ipcMain.handle('save-image-to-gallery', async (_event, { title, base64Data }) => {
    try {
      const safeTitle = (title || 'visual')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 50)

      const timestamp = Date.now()
      const fileName = `${safeTitle}_${timestamp}_Generated_by_Nexa.png`
      const filePath = path.join(GALLERY_DIR, fileName)

      const data = base64Data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(data, 'base64')

      fs.writeFileSync(filePath, buffer)

      return { success: true, path: filePath }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('delete-image', async (_event, filename) => {
    try {
      const filePath = path.join(GALLERY_DIR, filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return true
      }
      return false
    } catch {
      return false
    }
  })

  ipcMain.handle('open-image-location', async (_event, filePath) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('save-image-external', async (_event, sourcePath) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Save Image Copy',
        defaultPath: path.basename(sourcePath),
        filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
      })

      if (filePath) {
        fs.copyFileSync(sourcePath, filePath)
        return { success: true }
      }
      return { canceled: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  })
}

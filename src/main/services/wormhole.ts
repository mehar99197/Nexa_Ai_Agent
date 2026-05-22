import { IpcMain } from 'electron'
import { startTunnel } from 'untun'

let activeTunnel: NonNullable<Awaited<ReturnType<typeof startTunnel>>> | null = null

export default function registerWormhole({ ipcMain }: { ipcMain: IpcMain }): void {
  ipcMain.handle('open-wormhole', async (_event, port: number) => {
    try {
      if (activeTunnel) {
        await activeTunnel.close()
        activeTunnel = null
      }

      const tunnel = await startTunnel({
        port,
        acceptCloudflareNotice: true
      })

      if (!tunnel) {
        throw new Error('Failed to open wormhole tunnel.')
      }

      activeTunnel = tunnel
      const tunnelUrl = await tunnel.getURL()

      return {
        success: true,
        url: tunnelUrl,
        password: null
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('close-wormhole', async () => {
    if (activeTunnel) {
      await activeTunnel.close()
      activeTunnel = null
    }
    return { success: true }
  })
}

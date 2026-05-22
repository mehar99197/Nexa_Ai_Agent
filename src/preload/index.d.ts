import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
        send(channel: string, ...args: unknown[]): void
        on(channel: string, func: (...args: unknown[]) => void): () => void
      }
    }
    api: unknown
  }
}

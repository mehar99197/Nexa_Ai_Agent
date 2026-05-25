import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: Omit<ElectronAPI, 'ipcRenderer'> & {
      ipcRenderer: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        invoke(channel: string, ...args: unknown[]): Promise<any>
        send(channel: string, ...args: unknown[]): void
        on(
          channel: string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          listener: (event: unknown, ...args: any[]) => void
        ): () => void
        removeListener(
          channel: string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          listener: (event: unknown, ...args: any[]) => void
        ): void
        removeAllListeners(channel: string): void
      }
    }
    api: unknown
  }
}

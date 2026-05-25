import './assets/main.css'

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import IndexRoot from './IndexRoot'
import { loadSecureKeys, migrateLegacyLocalStorageKeys } from './config/secure-keys'
import HudToastHost from './components/HudToast'

;(async () => {
  await migrateLegacyLocalStorageKeys()
  await loadSecureKeys()
})()

class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: Error): { hasError: boolean; errorMsg: string } | null {
    return { hasError: true, errorMsg: error.message }
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-red-500 font-mono p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">CRITICAL SYSTEM FAILURE</h1>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 max-w-2xl wrap-break-word">
            {this.state.errorMsg}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <HashRouter>
        <IndexRoot />
        <HudToastHost />
      </HashRouter>
    </SystemErrorBoundary>
  </StrictMode>
)

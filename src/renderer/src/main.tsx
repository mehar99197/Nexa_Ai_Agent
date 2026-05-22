import './assets/main.css'

import React, { JSX, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

import LoginPage from './auth/Login'
import { useAuthStore } from './store/auth-store'
import AuthInitializer from './auth/AuthToken'
import IndexRoot from './IndexRoot'

const electronAPI = (window as any).electron?.ipcRenderer

class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.message }
  }
  render() {
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

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const accessToken =
    useAuthStore((state) => state.accessToken) || localStorage.getItem('nexa_cloud_token')
  return accessToken ? <Navigate to="/" replace /> : children
}

const AppRouter = () => {
  const navigate = useNavigate()

  useEffect(() => {
    if (electronAPI) {
      electronAPI.on('oauth-callback', (_event: any, url: string) => {
        try {
          const urlObj = new URL(url.replace('nexa://', 'http://localhost/'))

          const refreshToken = urlObj.searchParams.get('refreshToken')
          const accessToken = urlObj.searchParams.get('accessToken')

          if (refreshToken && accessToken) {
            localStorage.setItem('nexa_cloud_token', refreshToken)
            useAuthStore.getState().setAccessToken(accessToken)

            navigate('/')
          }
        } catch (e) {
        }
      })
    }
    return () => electronAPI?.removeAllListeners('oauth-callback')
  }, [navigate])

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route path="/" element={<IndexRoot />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <HashRouter>
        <AuthInitializer />
        <AppRouter />
      </HashRouter>
    </SystemErrorBoundary>
  </StrictMode>
)

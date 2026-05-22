import { useEffect, type ReactElement } from 'react'
import { useAuthStore } from '../store/auth-store'
import AxiosInstance from '../config/AxiosInstance'

export default function AuthInitializer(): ReactElement | null {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setIsAuthInitialized = useAuthStore((s) => s.setIsAuthInitialized)

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const storedRefreshToken = localStorage.getItem('nexa_cloud_token')

        if (!storedRefreshToken) {
          setAccessToken(null)
          return
        }

        const res = await AxiosInstance.post('/users/refresh-token', {
          refreshToken: storedRefreshToken
        })

        const accessToken = res.data.accessToken
        setAccessToken(accessToken)

        if (res.data.refreshToken) {
          localStorage.setItem('nexa_cloud_token', res.data.refreshToken)
        }
      } catch {
        setAccessToken(null)
        localStorage.removeItem('nexa_cloud_token')
      } finally {
        if (setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()
  }, [setAccessToken, setIsAuthInitialized])

  return null
}

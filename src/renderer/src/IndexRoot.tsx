import { lazy, Suspense, useEffect } from 'react'
import MiniOverlay from './components/MiniOverlay'
import { nexaService } from './services/Nexa-voice-ai'
import Nexa from './UI/Nexa'
import TerminalOverlay from './components/TerminalOverlay'
import TitleBar from './components/Titlebar'
import { useSystemStore } from './store/system-store'

// Re-export for legacy callers that imported the type from this module.
export type { VisionMode } from './store/system-store'

// Lazy-load all heavy widgets. They pull in three.js / leaflet / monaco /
// recharts / face-api / transformers — keeping them out of the initial chunk
// cuts first paint dramatically.
const SmartDropZonesWidget = lazy(() => import('./Widgets/SmartZoneWidget'))
const SemanticWidget = lazy(() => import('./Widgets/SemanticSearch'))
const OracleWidget = lazy(() => import('./Widgets/RagOracleWidget'))
const WormholeWidget = lazy(() => import('./Widgets/WormholeWidget'))
const LeafletMapWidget = lazy(() => import('./Widgets/MapView'))
const StockWidget = lazy(() => import('./Widgets/StockWidget'))
const WeatherWidget = lazy(() => import('./Widgets/WeatherWidget'))
const ImageWidget = lazy(() => import('./Widgets/ImageWidget'))
const EmailWidget = lazy(() => import('./Widgets/EmailWidget'))
const LiveCodingWidget = lazy(() => import('./Widgets/LiveCodingWidget'))
const ResearchWidget = lazy(() => import('./Widgets/DeepResearch'))

const IndexRoot = (): React.JSX.Element => {
  // Subscribe with selectors so each piece of state only re-renders the parts
  // of the tree that read it (zustand will bail out of renders otherwise).
  const isOverlay = useSystemStore((s) => s.isOverlay)
  const setOverlay = useSystemStore((s) => s.setOverlay)
  const isSystemActive = useSystemStore((s) => s.isSystemActive)
  const shutdown = useSystemStore((s) => s.shutdown)
  const stopVision = useSystemStore((s) => s.stopVision)

  // Listen for overlay-mode toggles from the main process.
  useEffect(() => {
    const onOverlay = (_e: unknown, mode: boolean): void => setOverlay(mode)
    window.electron.ipcRenderer.on('overlay-mode', onOverlay)
    return () => {
      window.electron.ipcRenderer.removeListener?.('overlay-mode', onOverlay) ??
        window.electron.ipcRenderer.removeAllListeners('overlay-mode')
    }
  }, [setOverlay])

  // Watchdog: if nexaService drops the websocket while the UI thinks the
  // system is active, tear everything down after a 3-second grace period.
  useEffect(() => {
    if (!isSystemActive) return
    let disconnectGrace = 0
    const watchdog = setInterval(() => {
      if (!nexaService.isConnected && !nexaService.isReconnecting) {
        disconnectGrace++
        if (disconnectGrace >= 3) {
          useSystemStore.setState((s) => {
            s.isSystemActive = false
            s.isMicMuted = true
          })
          stopVision()
          disconnectGrace = 0
        }
      } else {
        disconnectGrace = 0
      }
    }, 1000)
    return () => clearInterval(watchdog)
  }, [isSystemActive, stopVision])

  // Tear down media + service if the root unmounts unexpectedly.
  useEffect(() => {
    return () => {
      shutdown()
    }
  }, [shutdown])

  if (isOverlay) {
    return (
      <div className="w-screen h-screen overflow-hidden flex items-center justify-center bg-transparent">
        <MiniOverlay />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative border border-emerald-500/20 rounded-xl">
      <TitleBar />
      <div className="flex-1 relative">
        <Nexa />
      </div>
      {/* TerminalOverlay is small and tied to AI tool output — keep it eager. */}
      <TerminalOverlay />
      {/* Each lazy widget gets its own Suspense boundary so a slow chunk for
          one widget doesn't block the others. */}
      <Suspense fallback={null}>
        <SmartDropZonesWidget />
      </Suspense>
      <Suspense fallback={null}>
        <SemanticWidget />
      </Suspense>
      <Suspense fallback={null}>
        <OracleWidget />
      </Suspense>
      <Suspense fallback={null}>
        <WormholeWidget />
      </Suspense>
      <Suspense fallback={null}>
        <LeafletMapWidget />
      </Suspense>
      <Suspense fallback={null}>
        <StockWidget />
      </Suspense>
      <Suspense fallback={null}>
        <WeatherWidget />
      </Suspense>
      <Suspense fallback={null}>
        <ImageWidget />
      </Suspense>
      <Suspense fallback={null}>
        <EmailWidget />
      </Suspense>
      <Suspense fallback={null}>
        <LiveCodingWidget />
      </Suspense>
      <Suspense fallback={null}>
        <ResearchWidget />
      </Suspense>
    </div>
  )
}

export default IndexRoot

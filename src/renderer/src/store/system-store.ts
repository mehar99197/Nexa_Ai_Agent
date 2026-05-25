import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { nexaService } from '../services/Nexa-voice-ai'
import { hudAlert } from '../components/hudToastStore'
import { getScreenSourceId } from '../hooks/CaptureDesktop'
import {
  bandwidthDetector,
  TIER_CONFIGS,
  type QualityTier,
  type BandwidthSnapshot
} from '../services/bandwidth-detector'

export type VisionMode = 'camera' | 'screen' | 'none'

interface SystemState {
  // UI / window state
  isOverlay: boolean
  setOverlay: (v: boolean) => void

  // Voice / vision pipeline state
  isSystemActive: boolean
  isMicMuted: boolean
  isVideoOn: boolean
  visionMode: VisionMode

  // Quality / bandwidth state
  qualityTier: QualityTier
  bandwidthSnapshot: BandwidthSnapshot | null

  // Vision plumbing — owned by the store so multiple components can subscribe
  // without prop-drilling. activeStream is exposed for components that need to
  // render a <video> preview of the current capture.
  activeStream: MediaStream | null

  // Actions — orchestrate nexaService + media tracks in one place so the UI
  // can stay declarative.
  toggleSystem: () => Promise<void>
  toggleMic: () => void
  startVision: (mode: 'camera' | 'screen') => Promise<void>
  stopVision: () => void
  setQualityTier: (tier: QualityTier) => void
  // Used by the unmount cleanup in IndexRoot to fully tear down the pipeline.
  shutdown: () => void
}

let _currentQualityTier: QualityTier = 'high'
let _restartingAI = false

const internals: {
  processingVideo: HTMLVideoElement | null
  processingCanvas: HTMLCanvasElement | null
  aiInterval: ReturnType<typeof setInterval> | null
  bandwidthUnsub: (() => void) | null
} = {
  processingVideo: null,
  processingCanvas: null,
  aiInterval: null,
  bandwidthUnsub: null
}

const ensureProcessingVideo = (): HTMLVideoElement => {
  if (!internals.processingVideo) {
    internals.processingVideo = document.createElement('video')
  }
  return internals.processingVideo
}

const ensureProcessingCanvas = (tier?: QualityTier): HTMLCanvasElement => {
  const cfg = TIER_CONFIGS[tier || _currentQualityTier]
  if (!internals.processingCanvas) {
    const c = document.createElement('canvas')
    c.width = cfg.width
    c.height = cfg.height
    internals.processingCanvas = c
  } else {
    internals.processingCanvas.width = cfg.width
    internals.processingCanvas.height = cfg.height
  }
  return internals.processingCanvas
}

const startAIProcessing = (): void => {
  if (internals.aiInterval) clearInterval(internals.aiInterval)
  const cfg = TIER_CONFIGS[_currentQualityTier]
  const canvas = ensureProcessingCanvas()
  const vid = ensureProcessingVideo()
  internals.aiInterval = setInterval(() => {
    if (
      vid.readyState === 4 &&
      nexaService.socket &&
      nexaService.socket.readyState === WebSocket.OPEN
    ) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', cfg.jpegQuality).split(',')[1]
        nexaService.sendVideoFrame(base64)
      }
    }
  }, cfg.intervalMs)
}

const restartAIProcessing = (): void => {
  if (_restartingAI) return
  if (!internals.aiInterval) return
  _restartingAI = true
  const cfg = TIER_CONFIGS[_currentQualityTier]
  ensureProcessingCanvas()
  clearInterval(internals.aiInterval)
  const canvas = internals.processingCanvas
  const vid = internals.processingVideo
  internals.aiInterval = setInterval(() => {
    if (
      vid?.readyState === 4 &&
      nexaService.socket &&
      nexaService.socket.readyState === WebSocket.OPEN
    ) {
      const ctx = canvas?.getContext('2d')
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', cfg.jpegQuality).split(',')[1]
        nexaService.sendVideoFrame(base64)
      }
    }
  }, cfg.intervalMs)
  _restartingAI = false
}

export const useSystemStore = create<SystemState>()(
  immer((set, get) => ({
    isOverlay: false,
    isSystemActive: false,
    isMicMuted: true,
    isVideoOn: false,
    visionMode: 'none',
    qualityTier: 'high',
    bandwidthSnapshot: null,
    activeStream: null,

    setOverlay: (v) =>
      set((state) => {
        state.isOverlay = v
      }),

    setQualityTier: (tier) => {
      _currentQualityTier = tier
      set((state) => {
        state.qualityTier = tier
      })
      if (get().isVideoOn && internals.aiInterval) {
        restartAIProcessing()
      }
    },

    toggleSystem: async () => {
      const { isSystemActive } = get()
      if (!isSystemActive) {
        try {
          await nexaService.connect()

          bandwidthDetector.start()
          internals.bandwidthUnsub = bandwidthDetector.subscribe((snap) => {
            _currentQualityTier = snap.qualityTier
            set((state) => {
              state.qualityTier = snap.qualityTier
              state.bandwidthSnapshot = snap
            })
            if (get().isVideoOn && internals.aiInterval) {
              restartAIProcessing()
            }
          })

          set((state) => {
            state.isSystemActive = true
            state.isMicMuted = false
          })
          nexaService.setMute(false)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (message === 'NO_API_KEY') {
            hudAlert(
              'Gemini API Key missing\nOpen Settings → Command Center Vault to set it.',
              'error'
            )
          } else if (message === 'NO_MICROPHONE') {
            hudAlert(
              'No microphone detected\nConnect an input device to initialize the voice pipeline.',
              'error'
            )
          } else {
            hudAlert(`Connection failed\n${message}`, 'error')
          }
          set((state) => {
            state.isSystemActive = false
          })
        }
      } else {
        if (internals.bandwidthUnsub) {
          internals.bandwidthUnsub()
          internals.bandwidthUnsub = null
        }
        bandwidthDetector.stop()
        nexaService.disconnect()
        nexaService.setMute(true)
        set((state) => {
          state.isSystemActive = false
          state.isMicMuted = true
          state.qualityTier = 'high'
          state.bandwidthSnapshot = null
        })
        get().stopVision()
      }
    },

    toggleMic: () => {
      const next = !get().isMicMuted
      set((state) => {
        state.isMicMuted = next
      })
      nexaService.setMute(next)
    },

    startVision: async (mode) => {
      if (!get().isSystemActive) return
      try {
        // Tear down any previous stream before opening a new one.
        const existing = get().activeStream
        if (existing) existing.getTracks().forEach((t) => t.stop())

        let stream: MediaStream
        if (mode === 'camera') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
          })
        } else {
          const sourceId = await getScreenSourceId()
          if (!sourceId) return
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              // @ts-expect-error chromeMediaSource is Chromium-only and not in the lib types
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                maxWidth: 1280,
                maxHeight: 720
              }
            }
          })
        }

        const vid = ensureProcessingVideo()
        vid.srcObject = stream
        await vid.play()

        set((state) => {
          state.activeStream = stream as unknown as MediaStream
          state.visionMode = mode
          state.isVideoOn = true
        })

        startAIProcessing()
        stream.getVideoTracks()[0].onended = () => get().stopVision()
      } catch {
        get().stopVision()
      }
    },

    stopVision: () => {
      const existing = get().activeStream
      if (existing) existing.getTracks().forEach((t) => t.stop())
      if (internals.processingVideo) internals.processingVideo.srcObject = null
      if (internals.aiInterval) {
        clearInterval(internals.aiInterval)
        internals.aiInterval = null
      }
      set((state) => {
        state.activeStream = null
        state.isVideoOn = false
        state.visionMode = 'none'
      })
    },

    shutdown: () => {
      get().stopVision()
      if (internals.bandwidthUnsub) {
        internals.bandwidthUnsub()
        internals.bandwidthUnsub = null
      }
      bandwidthDetector.stop()
      if (nexaService.isConnected) nexaService.disconnect()
    }
  }))
)

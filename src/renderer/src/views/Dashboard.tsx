import { useEffect, useCallback, useRef, useState } from 'react'
import Sphere from '@renderer/components/Sphere'
import {
  RiCpuLine,
  RiCameraLine,
  RiTerminalBoxLine,
  RiSwapBoxLine,
  RiLayoutGridLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneFill,
  RiHistoryLine,
  RiPulseLine,
  RiWifiLine,
  RiServerLine,
  RiEarthLine,
  RiSendPlaneLine,
  RiErrorWarningLine,
  RiExpandDiagonalLine,
  RiTimeLine
} from 'react-icons/ri'
import { FaMemory } from 'react-icons/fa6'
import { GiTinker } from 'react-icons/gi'
import { HiComputerDesktop } from 'react-icons/hi2'
import * as faceapi from 'face-api.js'
import gsap from 'gsap'
import { useSystemStore } from '@renderer/store/system-store'
import { useBandwidthQuality } from '@renderer/hooks/useBandwidthQuality'
import { TIER_CONFIGS } from '@renderer/services/bandwidth-detector'
import { nexaService } from '@renderer/services/Nexa-voice-ai'
import { saveMessage } from '@renderer/services/nexa-ai-brain'
import { hudAlert } from '@renderer/components/hudToastStore'

interface DashboardViewProps {
  stats: any
  chatHistory: any[]
  onVisionClick: () => void
}

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'

export default function DashboardView({
  stats,
  chatHistory,
  onVisionClick
}: DashboardViewProps): React.JSX.Element {
  // Pull each slice individually so we don't re-render when an unrelated
  // store field changes.
  const isSystemActive = useSystemStore((s) => s.isSystemActive)
  const isVideoOn = useSystemStore((s) => s.isVideoOn)
  const visionMode = useSystemStore((s) => s.visionMode)
  const startVision = useSystemStore((s) => s.startVision)
  const activeStream = useSystemStore((s) => s.activeStream)
  const toggleMic = useSystemStore((s) => s.toggleMic)
  const toggleSystem = useSystemStore((s) => s.toggleSystem)
  const isMicMuted = useSystemStore((s) => s.isMicMuted)

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceScanInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const { snapshot: bwSnapshot, tierLabel } = useBandwidthQuality()

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)
  const metricRefs = useRef<(HTMLDivElement | null)[]>([])
  const isMicActive = !isMicMuted

  const [sparklines] = useState<number[][]>(() =>
    Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => Math.floor(Math.random() * 60 + 20))
    )
  )

  useEffect(() => {
    if (!isVideoOn) return
    const start = Date.now()
    const t = setInterval(() => setRecordingElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => {
      clearInterval(t)
      setRecordingElapsed(0)
    }
  }, [isVideoOn])

  useEffect(() => {
    const t = setTimeout(() => {
      hudAlert('RAM usage at 84.5% — Performance may degrade')
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (feedRef.current) {
      gsap.fromTo(feedRef.current, { scale: 1 }, { scale: 1.05, duration: 0.2, paused: true })
    }
  }, [])

  const handleFeedHover = (enter: boolean): void => {
    if (feedRef.current) {
      gsap.to(feedRef.current, { scale: enter ? 1.02 : 1, duration: 0.2, ease: 'power2.out' })
    }
  }

  const handleMetricHover = (index: number, enter: boolean): void => {
    const el = metricRefs.current[index]
    if (el) {
      gsap.to(el, {
        borderColor: enter ? 'rgba(0,255,157,0.2)' : 'rgba(255,255,255,0.05)',
        duration: 0.2,
        ease: 'power2.out'
      })
    }
  }

  const formatElapsed = (sec: number): string => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    setIsAiSpeaking(true)
    await saveMessage('user', text)
    nexaService.sendText(text)
  }, [textInput])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatHistory])

  useEffect(() => {
    if (!chatHistory.length) return
    const lastRole = chatHistory[chatHistory.length - 1]?.role
    if (lastRole === 'user') {
      setIsAiSpeaking(true)
    } else if (lastRole === 'model') {
      setIsAiSpeaking(false)
    }
  }, [chatHistory])

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = './models'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
      } catch (e) {}
    }
    loadModels()
  }, [])

  useEffect(() => {
    if (
      isVideoOn &&
      visionMode === 'camera' &&
      modelsLoaded &&
      videoElementRef.current &&
      canvasRef.current
    ) {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)

      faceScanInterval.current = setInterval(async () => {
        const video = videoElementRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) return

        try {
          const vw = video.videoWidth
          const vh = video.videoHeight

          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw
            canvas.height = vh
          }

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
          const detection = await faceapi
            .detectSingleFace(video, options)
            .withFaceExpressions()
            .withAgeAndGender()

          ctx.clearRect(0, 0, vw, vh)

          if (detection) {
            const { x, y, width, height } = detection.detection.box

            const mirroredX = vw - x - width

            ctx.strokeStyle = '#34d399'
            ctx.lineWidth = 4
            const l = 25

            ctx.beginPath()
            ctx.moveTo(mirroredX, y + l)
            ctx.lineTo(mirroredX, y)
            ctx.lineTo(mirroredX + l, y)
            ctx.moveTo(mirroredX + width - l, y)
            ctx.lineTo(mirroredX + width, y)
            ctx.lineTo(mirroredX + width, y + l)
            ctx.moveTo(mirroredX, y + height - l)
            ctx.lineTo(mirroredX, y + height)
            ctx.lineTo(mirroredX + l, y + height)
            ctx.moveTo(mirroredX + width - l, y + height)
            ctx.lineTo(mirroredX + width, y + height)
            ctx.lineTo(mirroredX + width, y + height - l)
            ctx.stroke()

            const expressions = detection.expressions
            const expKeys = Object.keys(expressions) as (keyof typeof expressions)[]
            const domExp = expKeys.reduce((a, b) =>
              expressions[a] > expressions[b] ? a : b
            )
            const gender = detection.gender === 'male' ? 'M' : 'F'
            const age = Math.round(detection.age)
            const labelText = ` ID:${gender} | AGE:${age} | ${domExp.toUpperCase()} `

            ctx.fillStyle = 'rgba(10, 10, 10, 0.85)'
            ctx.fillRect(mirroredX, y - 32, width, 26)

            ctx.fillStyle = '#34d399'
            ctx.font = 'bold 16px monospace'
            ctx.fillText(labelText, mirroredX + 5, y - 14)
          } else {
            ctx.fillStyle = 'rgba(52, 211, 153, 0.8)'
            ctx.font = 'bold 14px monospace'
            ctx.fillText('SCANNING OPTICS...', 20, 30)
          }
        } catch (e) {}
      }, 250)
    } else {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }

    return () => {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
    }
  }, [isVideoOn, visionMode, modelsLoaded])

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn, visionMode]
  )

  const setMobileVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn, visionMode]
  )

  const toggleSource = () => {
    if (!isSystemActive) return
    const nextMode = visionMode === 'camera' ? 'screen' : 'camera'
    startVision(nextMode)
  }

  const systemMetrics = [
    {
      icon: <RiCpuLine />,
      bgIcon: <RiCpuLine size={140} />,
      label: 'CPU LOAD',
      val: stats ? `${stats.cpu}%` : '--',
      raw: stats ? stats.cpu : 0,
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500',
      glowClass: 'via-emerald-500/50',
      shadowClass: 'shadow-[0_0_8px_#10b981]',
      bgGradient: 'from-emerald-950/30 to-black/60',
      pattern:
        'bg-[linear-linear(to_right,#10b98108_1px,transparent_1px),linear-linear(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:12px_12px]'
    },
    {
      icon: <FaMemory />,
      bgIcon: <FaMemory size={140} />,
      label: 'RAM USAGE',
      val: stats ? `${stats.memory.usedPercentage}%` : '--',
      raw: stats ? stats.memory.usedPercentage : 0,
      colorClass: 'text-cyan-400',
      bgClass: 'bg-cyan-500',
      glowClass: 'via-cyan-500/50',
      shadowClass: 'shadow-[0_0_8px_#06b6d4]',
      bgGradient: 'from-cyan-950/30 to-black/60',
      pattern: 'bg-[radial-linear(#06b6d415_1px,transparent_1px)] bg-[size:10px_10px]'
    },
    {
      icon: <GiTinker />,
      bgIcon: <GiTinker size={140} />,
      label: 'TEMP',
      val: stats ? `${stats.temperature}°C` : '--',
      raw: stats ? Math.min((stats.temperature / 90) * 100, 100) : 0,
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500',
      glowClass: 'via-orange-500/50',
      shadowClass: 'shadow-[0_0_8px_#f97316]',
      bgGradient: 'from-orange-950/30 to-black/60',
      pattern:
        'bg-[radial-linear(ellipse_at_top_right,_var(--tw-linear-stops))] from-orange-900/20 via-transparent to-transparent'
    },
    {
      icon: <HiComputerDesktop />,
      bgIcon: <HiComputerDesktop size={140} />,
      label: 'OS',
      val: stats ? `${stats.os.type}` : '--',
      raw: 0,
      colorClass: 'text-purple-400',
      bgClass: 'bg-purple-500',
      glowClass: 'via-purple-500/50',
      shadowClass: '',
      bgGradient: 'from-purple-950/30 to-black/60',
      pattern:
        'bg-[linear-linear(45deg,#a855f708_25%,transparent_25%,transparent_50%,#a855f708_50%,#a855f708_75%,transparent_75%,transparent)] bg-[size:24px_24px]',
      hideBar: true
    }
  ]

  return (
    <div className="flex-1 p-4 bg-white/2 grid grid-cols-12 gap-4 h-full overflow-hidden relative animate-in fade-in zoom-in duration-300 w-full">
      <div className="hidden lg:flex col-span-3 flex-col gap-4 h-full z-40">
        <div
          ref={feedRef}
          className={`${glassPanel} h-70 shrink-0 flex flex-col p-1 overflow-hidden relative group cursor-pointer`}
          onMouseEnter={() => handleFeedHover(true)}
          onMouseLeave={() => handleFeedHover(false)}
        >
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isVideoOn ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 'bg-zinc-600'}`}
            />
            <span
              className={`text-[9px] font-bold tracking-widest ${isVideoOn ? 'text-red-400/80' : 'text-zinc-600'}`}
            >
              {isVideoOn
                ? visionMode === 'screen'
                  ? 'SCREEN FEED'
                  : 'OPTICAL FEED'
                : 'OPTICS OFFLINE'}
            </span>
          </div>

          {isVideoOn && (
            <>
              <button
                onClick={toggleSource}
                className="absolute top-2 right-2 z-30 p-1.5 rounded-md bg-black/50 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all"
              >
                <RiSwapBoxLine size={14} />
              </button>
              <button
                className="absolute bottom-2 right-2 z-30 p-1 rounded-md bg-black/60 text-white/70 border border-white/10 hover:bg-emerald-500 hover:text-black transition-all opacity-0 group-hover:opacity-100 text-[9px] font-mono flex items-center gap-1"
              >
                <RiExpandDiagonalLine size={12} /> EXPAND
              </button>
            </>
          )}

          <div
            className={`w-full h-full rounded-xl overflow-hidden bg-black/20 relative border border-white/5 transition-all ${isVideoOn ? 'opacity-100' : 'opacity-30'}`}
          >
            <video
              key={visionMode}
              ref={setVideoRef}
              className={`absolute inset-0 w-full h-full object-cover ${visionMode === 'camera' ? '-scale-x-100' : ''}`}
              autoPlay
              playsInline
              muted
            />

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20"
            />

            {!isVideoOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-50 px-4">
                <div className="w-full space-y-1 font-mono text-[8px] text-emerald-500/40 leading-relaxed">
                  <span className="block">$ nexa-scan init —source=optical</span>
                  <span className="block text-zinc-600">[device] opening /dev/video0 ...</span>
                  <span className="block text-zinc-600">[capture] negotiating format ...</span>
                  <span className="block animate-pulse text-zinc-700">_ Waiting for source ...</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-600 mt-2">PAUSED</span>
              </div>
            ) : (
              <div className="absolute bottom-2 left-2 z-30 flex items-center gap-2">
                <span className="text-[8px] font-mono text-red-400/70 flex items-center gap-1">
                  <RiTimeLine size={10} /> REC {formatElapsed(recordingElapsed)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-2 py-1 text-[8px] font-mono text-zinc-500">
              <span>FPS: 24</span>
              <span>RES: 1456x816</span>
              <span>CODEC: H264</span>
            </div>
        </div>

        <div
          className={`${glassPanel} h-32 shrink-0 p-4 flex flex-col justify-between relative overflow-hidden`}
        >
          <div
            className={`absolute inset-0 bg-linear-to-r from-emerald-500/5 to-transparent transition-opacity duration-1000 ${isSystemActive ? 'opacity-100' : 'opacity-0'}`}
          />

          <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-10">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400 flex items-center gap-1">
              <RiPulseLine className={isSystemActive ? 'text-emerald-500 animate-pulse' : ''} />{' '}
              NETWORK TELEMETRY
            </span>
            <span
              className={`text-[8px] px-2 py-0.5 rounded-full font-mono font-bold border ${isSystemActive ? (tierLabel === 'LOW' ? 'text-[#ff6b35] border-[#ff6b35]/30 bg-[#ff6b35]/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10') : 'text-zinc-600 border-zinc-800 bg-zinc-900'}`}
            >
              {isSystemActive ? `TIER: ${tierLabel}` : 'STANDBY'}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2 relative z-10">
            <div className="flex flex-col">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest flex items-center gap-1">
                WSS LATENCY
              </span>
              <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5 transition-all">
                <RiWifiLine className={isSystemActive ? 'text-emerald-400' : 'text-zinc-600'} />
                {isSystemActive && bwSnapshot ? `${bwSnapshot.rttMs}ms` : '--'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest">
                DOWNLINK
              </span>
              <span className="text-xs font-bold text-emerald-50 font-mono transition-all">
                {isSystemActive && bwSnapshot ? `${bwSnapshot.downlinkMbps.toFixed(1)} Mbps` : '--'}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest">NET TYPE</span>
              <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5">
                {isSystemActive && bwSnapshot ? bwSnapshot.effectiveType.toUpperCase() : '--'}
                {isSystemActive && bwSnapshot ? (
                  <RiEarthLine className="text-cyan-400" />
                ) : (
                  <RiServerLine className="text-zinc-500" />
                )}
              </span>
            </div>
          </div>

          <div className="w-full flex flex-col gap-1 mt-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-3">BW</span>
              <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out ${bwSnapshot && bwSnapshot.qualityTier === 'minimal' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : bwSnapshot && (bwSnapshot.qualityTier === 'low' || bwSnapshot.qualityTier === 'medium') ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}
                  style={{ width: `${isSystemActive && bwSnapshot ? Math.min(bwSnapshot.downlinkMbps * 4, 100) : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-3">QL</span>
              <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out delay-75 ${bwSnapshot && bwSnapshot.qualityTier === 'minimal' ? 'bg-red-500' : bwSnapshot && (bwSnapshot.qualityTier === 'low' || bwSnapshot.qualityTier === 'medium') ? 'bg-amber-500' : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]'}`}
                  style={{ width: `${isSystemActive && bwSnapshot ? (Object.keys(TIER_CONFIGS).indexOf(bwSnapshot.qualityTier) + 1) * 20 : 0}%` }}
                />
              </div>
              <span className="text-[7px] font-mono text-zinc-500 w-5 text-right">{tierLabel}</span>
            </div>
          </div>
        </div>

        <div className={`${glassPanel} flex-1 p-4 flex flex-col gap-3`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              <RiLayoutGridLine className="inline mr-1" /> CORE METRICS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 h-full pb-1">
            {systemMetrics.map((m, i) => {
              const isWarning =
                (m.label === 'RAM USAGE' && m.raw > 80) ||
                (m.label === 'TEMP' && m.raw > 70) ||
                (m.label === 'CPU LOAD' && m.raw > 85)
              const warnColor = isWarning ? '#ff6b35' : '#00ff9d'
              return (
                <div
                  key={i}
                  ref={(el) => { metricRefs.current[i] = el }}
                  onMouseEnter={() => handleMetricHover(i, true)}
                  onMouseLeave={() => handleMetricHover(i, false)}
                  className={`cursor-pointer relative rounded-xl p-3 flex flex-col justify-between border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300 bg-linear-to-br ${m.bgGradient}`}
                >
                  <div
                    className={`absolute inset-0 ${m.pattern} opacity-30 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none`}
                  />

                  <div
                    className={`absolute -bottom-8 -right-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 transform group-hover:scale-110 pointer-events-none ${m.colorClass}`}
                  >
                    {m.bgIcon}
                  </div>

                  <div
                    className={`absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent ${m.glowClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  />

                  <div className="relative z-10 flex justify-between items-start text-zinc-500">
                    <span
                      className={`text-base ${isWarning ? 'text-orange-500' : m.colorClass} opacity-70 group-hover:opacity-100 transition-opacity`}
                    >
                      {m.icon}
                    </span>
                    <span className="text-[8px] font-mono tracking-widest uppercase opacity-70 group-hover:opacity-100 transition-opacity text-zinc-300 flex items-center gap-1">
                      {isWarning && <RiErrorWarningLine className="text-orange-500" size={10} />}
                      {m.label}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col gap-1.5 mt-2">
                    <span className={`text-sm font-bold text-right font-mono tracking-wider drop-shadow-md ${isWarning ? 'text-[#ff6b35]' : 'text-white'}`}>
                      {m.val}
                    </span>

                    {!m.hideBar && (
                      <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                        <div
                          className={`h-full transition-all duration-700 ease-out rounded-full ${isWarning ? 'bg-[#ff6b35] shadow-[0_0_8px_#ff6b35]' : `${m.bgClass} ${m.shadowClass}`}`}
                          style={{ width: stats ? `${m.raw}%` : '0%' }}
                        />
                      </div>
                    )}

                    <svg
                      viewBox="0 0 60 20"
                      className="w-full h-4 mt-1"
                    >
                      <polyline
                        points={sparklines[i].map((v, idx) => `${idx * 10},${20 - (v / 100) * 18}`).join(' ')}
                        fill="none"
                        stroke={warnColor}
                        strokeWidth="1.5"
                        strokeOpacity="0.6"
                      />
                    </svg>

                    {m.label === 'TEMP' && (
                      <div className="w-full h-[3px] bg-black/40 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full bg-[#ff6b35] shadow-[0_0_6px_#ff6b35]"
                          style={{ width: stats ? `${Math.min((parseFloat(String(stats.temperature)) / 90) * 100, 100)}%` : '0%' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-6 relative flex flex-col items-center justify-start">
        <div
          className={`w-[50vh] h-[50vh] max-w-full transition-all duration-1000 ${isSystemActive ? 'opacity-100 scale-100' : 'opacity-85 scale-90 grayscale'}`}
        >
          <Sphere isMicActive={isMicActive} isAiSpeaking={isAiSpeaking} />
        </div>

        <div className="absolute bottom-44 z-50 flex justify-center w-full px-6">
          <div className={`${glassPanel} px-3 py-2 rounded-xl flex items-center gap-2 border ${isSystemActive ? 'border-emerald-500/10' : 'border-white/5'} w-full max-w-lg`}>
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend() }}
              placeholder="Ask Nexa anything..."
              disabled={!isSystemActive}
              className="flex-1 bg-transparent text-xs font-mono text-zinc-300 placeholder-zinc-600 outline-none border-none disabled:opacity-40"
            />
            <button
              onClick={handleTextSend}
              disabled={!textInput.trim() || !isSystemActive}
              className={`p-2 rounded-lg transition-all ${textInput.trim() && isSystemActive ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-zinc-600 cursor-not-allowed'}`}
            >
              <RiSendPlaneLine size={16} />
            </button>
          </div>
        </div>
        <div className="absolute bottom-10 z-50 flex justify-center w-full">
          <div
            className={`${glassPanel} px-6 py-3 rounded-full flex items-center gap-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
          >
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onVisionClick}
                title={isVideoOn ? 'Switch source' : 'Enable camera'}
                className={`cursor-pointer p-3 rounded-full transition-all ${isVideoOn ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/10 text-zinc-400'}`}
              >
                {isVideoOn ? <RiSwapBoxLine size={20} /> : <RiCameraLine size={20} />}
              </button>
              <span className={`text-[7px] font-mono tracking-widest ${isVideoOn ? 'text-red-400/60' : 'text-zinc-600'}`}>SCREEN</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button onClick={toggleSystem} className="relative group mx-2" title={isSystemActive ? 'Deactivate' : 'Activate system'}>
                <div
                  className={`cursor-pointer p-4 rounded-full border-2 transition-all duration-500 ${isSystemActive ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_#10b981]' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}
                >
                  <RiPhoneFill size={24} className={isSystemActive ? 'animate-pulse' : ''} />
                </div>
              </button>
              <span className={`text-[7px] font-mono tracking-widest ${isSystemActive ? 'text-emerald-400/60' : 'text-zinc-600'}`}>CALL</span>
            </div>
            <div className="flex flex-col items-center gap-1 relative">
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!isMicMuted && isSystemActive && (
                  <>
                    <span
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '2px solid #00ff9d',
                        animation: 'nexaRipple 1.2s ease-out infinite',
                        animationDelay: '0s',
                        pointerEvents: 'none',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '2px solid #00ff9d',
                        animation: 'nexaRipple 1.2s ease-out infinite',
                        animationDelay: '0.4s',
                        pointerEvents: 'none',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '1px solid #00ff9d',
                        animation: 'nexaRipple 1.2s ease-out infinite',
                        animationDelay: '0.8s',
                        pointerEvents: 'none',
                      }}
                    />
                  </>
                )}
                <button
                  onClick={toggleMic}
                  title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`cursor-pointer p-3 rounded-full transition-all ${isMicMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                >
                  {isMicMuted ? <RiMicOffLine size={20} /> : <RiMicLine size={20} />}
                </button>
              </div>
              <span className={`text-[7px] font-mono tracking-widest ${!isMicMuted && isSystemActive ? 'text-emerald-400/60' : 'text-zinc-600'}`}>MIC</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex col-span-3 flex-col overflow-hidden h-full z-40">
        <div className={`${glassPanel} h-full p-4 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              <RiTerminalBoxLine className="inline mr-1" /> TRANSCRIPT
            </span>
            <span className="text-[8px] font-mono text-emerald-500/50 border border-[#00ff9d] px-1.5 py-0.5 rounded animate-pulse">
              LIVE-LOG
            </span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 transcript-scroll">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2 opacity-50">
                <RiHistoryLine size={24} />
                <span className="text-[9px] tracking-widest uppercase font-mono">
                  No Data Stream
                </span>
              </div>
            ) : (
              chatHistory.map((msg, idx) => {
                const text = msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content || ''
                const cleanText = text.replace(/<noise>/gi, '[inaudible]')
                const isUrdu = /[\u0600-\u06FF]/.test(cleanText)
                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {msg.role === 'nexa' && (
                      <span className="text-[10px] text-zinc-600 font-mono mb-0.5">{timestamp}</span>
                    )}
                    <div
                      className={`max-w-[95%] py-2 px-3 rounded-lg text-[11px] leading-relaxed border font-mono font-semibold ${
                        msg.role === 'user'
                          ? 'bg-[rgba(0,255,157,0.06)] border-[rgba(0,255,157,0.25)] text-[#00ff9d] rounded-[8px_8px_2px_8px]'
                          : 'bg-transparent border-transparent text-[#c8c8c8]'
                      } ${isUrdu ? 'direction-rtl text-right' : ''}`}
                      style={isUrdu ? { direction: 'rtl', fontFamily: "'Noto Nastaliq Urdu', serif" } : {}}
                    >
                      {cleanText}
                    </div>
                    {msg.role === 'user' && (
                      <span className="text-[10px] text-zinc-600 font-mono mt-0.5">{timestamp}</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

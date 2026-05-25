export type QualityTier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal'

export interface QualityConfig {
  width: number
  height: number
  jpegQuality: number
  intervalMs: number
  label: string
}

export const TIER_CONFIGS: Record<QualityTier, QualityConfig> = {
  ultra: { width: 1280, height: 720, jpegQuality: 0.85, intervalMs: 1500, label: 'ULTRA' },
  high: { width: 960, height: 540, jpegQuality: 0.6, intervalMs: 2000, label: 'HIGH' },
  medium: { width: 640, height: 360, jpegQuality: 0.4, intervalMs: 3000, label: 'MEDIUM' },
  low: { width: 480, height: 270, jpegQuality: 0.25, intervalMs: 5000, label: 'LOW' },
  minimal: { width: 320, height: 180, jpegQuality: 0.1, intervalMs: 8000, label: 'MINIMAL' }
}

export interface BandwidthSnapshot {
  downlinkMbps: number
  rttMs: number
  effectiveType: string
  qualityTier: QualityTier
  isStable: boolean
}

type BandwidthListener = (snapshot: BandwidthSnapshot) => void

interface NavigatorConnection {
  downlink: number
  rtt: number
  effectiveType: string
  addEventListener: (event: string, handler: () => void) => void
  removeEventListener: (event: string, handler: () => void) => void
}

const PING_URL = 'https://www.google.com/generate_204'
const POLL_INTERVAL_MS = 8000
const HYSTERESIS_SAMPLES = 3

class BandwidthDetector {
  private listeners: Set<BandwidthListener> = new Set()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private connectionRef: EventTarget | null = null
  private _currentTier: QualityTier = 'high'
  private history: QualityTier[] = []
  private _lastSnapshot: BandwidthSnapshot = {
    downlinkMbps: 10,
    rttMs: 30,
    effectiveType: '4g',
    qualityTier: 'high',
    isStable: true
  }
  private _isRunning = false

  get isRunning(): boolean {
    return this._isRunning
  }

  get currentTier(): QualityTier {
    return this._currentTier
  }

  get lastSnapshot(): BandwidthSnapshot {
    return this._lastSnapshot
  }

  private getConnection(): NavigatorConnection | null {
    const nav = navigator as unknown as { connection?: NavigatorConnection }
    return nav.connection ?? null
  }

  start(): void {
    if (this._isRunning) return
    this._isRunning = true

    const conn = this.getConnection()
    if (conn) {
      this.connectionRef = conn as unknown as EventTarget
      this.connectionRef.addEventListener('change', this.onConnectionChange)
      this.readConnectionAPI()
    }

    this.measure()
    this.pollTimer = setInterval(() => this.measure(), POLL_INTERVAL_MS)
  }

  stop(): void {
    this._isRunning = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.connectionRef) {
      this.connectionRef.removeEventListener('change', this.onConnectionChange)
      this.connectionRef = null
    }
    this.history = []
  }

  private onConnectionChange = (): void => {
    this.readConnectionAPI()
    this.measure()
  }

  private readConnectionAPI(): void {
    const conn = this.getConnection()
    if (!conn) return
    if (typeof conn.downlink === 'number' && conn.downlink > 0) {
      this._lastSnapshot.downlinkMbps = conn.downlink
      this._lastSnapshot.effectiveType = conn.effectiveType || 'unknown'
    }
    if (typeof conn.rtt === 'number' && conn.rtt > 0) {
      this._lastSnapshot.rttMs = conn.rtt
    }
  }

  private async measure(): Promise<void> {
    const rtt = await this.measureRTT()
    if (rtt > 0) {
      this._lastSnapshot.rttMs = rtt
    }
    this.readConnectionAPI()
    this.evaluateTier()
  }

  private async measureRTT(): Promise<number> {
    const start = performance.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch(PING_URL, { mode: 'no-cors', signal: controller.signal })
      clearTimeout(timeout)
      return Math.round(performance.now() - start)
    } catch {
      return 0
    }
  }

  private tierForMetrics(downlinkMbps: number, rttMs: number): QualityTier {
    if (downlinkMbps >= 20 && rttMs < 60) return 'ultra'
    if (downlinkMbps >= 8 && rttMs < 120) return 'high'
    if (downlinkMbps >= 3 && rttMs < 250) return 'medium'
    if (downlinkMbps >= 1) return 'low'
    return 'minimal'
  }

  private evaluateTier(): void {
    const target = this.tierForMetrics(this._lastSnapshot.downlinkMbps, this._lastSnapshot.rttMs)

    this.history.push(target)
    if (this.history.length > HYSTERESIS_SAMPLES) this.history.shift()

    const counts: Partial<Record<QualityTier, number>> = {}
    for (const t of this.history) counts[t] = (counts[t] || 0) + 1

    let modeTier: QualityTier = target
    let maxCount = 0
    for (const [tier, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count
        modeTier = tier as QualityTier
      }
    }

    const isStable = maxCount >= Math.ceil(HYSTERESIS_SAMPLES / 2)

    if (modeTier !== this._currentTier && isStable) {
      this._currentTier = modeTier
      this._lastSnapshot.qualityTier = modeTier
      this._lastSnapshot.isStable = isStable
      this.notify()
    } else {
      this._lastSnapshot.isStable = isStable
    }
  }

  private notify(): void {
    const snapshot: BandwidthSnapshot = { ...this._lastSnapshot }
    for (const fn of this.listeners) {
      try {
        fn(snapshot)
      } catch {
        /* consume */
      }
    }
  }

  subscribe(fn: BandwidthListener): () => void {
    this.listeners.add(fn)
    fn({ ...this._lastSnapshot })
    return () => {
      this.listeners.delete(fn)
    }
  }
}

export const bandwidthDetector = new BandwidthDetector()

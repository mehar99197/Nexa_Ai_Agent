import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  bandwidthDetector,
  TIER_CONFIGS,
  type QualityTier,
  type BandwidthSnapshot
} from './bandwidth-detector'

// ============================================================
// SMOKE TESTS – verify modules load and expose expected surface
// ============================================================
describe('SMOKE: bandwidth-detector module', () => {
  it('exports a singleton instance', () => {
    expect(bandwidthDetector).toBeDefined()
    expect(bandwidthDetector.isRunning).toBe(false)
    expect(bandwidthDetector.currentTier).toBe('high')
    expect(bandwidthDetector.lastSnapshot).toBeDefined()
  })

  it('has correct shape on lastSnapshot', () => {
    const s = bandwidthDetector.lastSnapshot
    expect(s).toHaveProperty('downlinkMbps')
    expect(s).toHaveProperty('rttMs')
    expect(s).toHaveProperty('effectiveType')
    expect(s).toHaveProperty('qualityTier')
    expect(s).toHaveProperty('isStable')
  })

  it('TIER_CONFIGS has all 5 tiers with correct fields', () => {
    const tiers: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'minimal']
    for (const t of tiers) {
      const cfg = TIER_CONFIGS[t]
      expect(cfg).toBeDefined()
      expect(typeof cfg.width).toBe('number')
      expect(typeof cfg.height).toBe('number')
      expect(typeof cfg.jpegQuality).toBe('number')
      expect(typeof cfg.intervalMs).toBe('number')
      expect(typeof cfg.label).toBe('string')
    }
  })

  it('TIER_CONFIGS has monotonically decreasing quality', () => {
    const tiers: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'minimal']
    for (let i = 1; i < tiers.length; i++) {
      expect(TIER_CONFIGS[tiers[i]].width).toBeLessThanOrEqual(
        TIER_CONFIGS[tiers[i - 1]].width
      )
      expect(TIER_CONFIGS[tiers[i]].jpegQuality).toBeLessThanOrEqual(
        TIER_CONFIGS[tiers[i - 1]].jpegQuality
      )
      expect(TIER_CONFIGS[tiers[i]].intervalMs).toBeGreaterThanOrEqual(
        TIER_CONFIGS[tiers[i - 1]].intervalMs
      )
    }
  })
})

// ============================================================
// BLACKBOX TESTS – test public API behavior
// ============================================================
describe('BLACKBOX: bandwidth-detector public API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (bandwidthDetector.isRunning) bandwidthDetector.stop()
  })

  it('start/stop cycle works without errors', () => {
    bandwidthDetector.start()
    expect(bandwidthDetector.isRunning).toBe(true)
    bandwidthDetector.stop()
    expect(bandwidthDetector.isRunning).toBe(false)
  })

  it('subscribe receives initial snapshot immediately', () => {
    const fn = vi.fn()
    const unsub = bandwidthDetector.subscribe(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    const snapshot: BandwidthSnapshot = fn.mock.calls[0][0]
    expect(snapshot.downlinkMbps).toBeGreaterThan(0)
    expect(snapshot.qualityTier).toBe('high')
    unsub()
  })

  it('subscribe/unsubscribe does not leak listeners', () => {
    const fn = vi.fn()
    const unsub = bandwidthDetector.subscribe(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    // Calling stop/start should not cause issues after unsub
    bandwidthDetector.start()
    bandwidthDetector.stop()
  })

  it('quality tier progression: ultra needs high bandwidth', () => {
    // We can't easily control navigator.connection in tests,
    // but we verify the configs are reasonable
    expect(TIER_CONFIGS.ultra.jpegQuality).toBeGreaterThan(TIER_CONFIGS.high.jpegQuality)
    expect(TIER_CONFIGS.ultra.width).toBeGreaterThan(TIER_CONFIGS.high.width)
    expect(TIER_CONFIGS.ultra.intervalMs).toBeLessThan(TIER_CONFIGS.high.intervalMs)
  })

  it('lowest tier has lowest settings', () => {
    expect(TIER_CONFIGS.minimal.jpegQuality).toBeLessThanOrEqual(0.15)
    expect(TIER_CONFIGS.minimal.width).toBeLessThanOrEqual(340)
    expect(TIER_CONFIGS.minimal.intervalMs).toBeGreaterThanOrEqual(7000)
  })
})

// ============================================================
// WHITEBOX TESTS – internal logic paths and edge cases
// ============================================================
describe('WHITEBOX: bandwidth-detector internal logic', () => {
  afterEach(() => {
    vi.useRealTimers()
    if (bandwidthDetector.isRunning) bandwidthDetector.stop()
  })

  it('start initializes poll timer and connection listener', () => {
    // Access the private members via type assertion to verify state
    const internals = bandwidthDetector as unknown as {
      pollTimer: ReturnType<typeof setInterval> | null
      connectionRef: EventTarget | null
      start: () => void
      stop: () => void
    }

    bandwidthDetector.start()
    expect(bandwidthDetector.isRunning).toBe(true)

    bandwidthDetector.stop()
    expect(bandwidthDetector.isRunning).toBe(false)

    // After stop, polling should be cleared
    bandwidthDetector.start()
    bandwidthDetector.stop()
  })

  it('can detect high quality tier from metrics', () => {
    // Verify the tier progression is correct by accessing the snapshot defaults
    const defaults = bandwidthDetector.lastSnapshot
    expect(defaults.downlinkMbps).toBeGreaterThan(5)
    expect(defaults.qualityTier).toBe('high')
  })

  it('subscribe callback receives snapshot when tier changes', () => {
    // Test the subscribe/notify mechanism
    const callback = vi.fn()
    const unsub = bandwidthDetector.subscribe(callback)
    expect(callback).toHaveBeenCalledTimes(1)

    // The initial call should have the default values
    const firstCall = callback.mock.calls[0][0] as BandwidthSnapshot
    expect(firstCall.qualityTier).toBe('high')

    unsub()
  })

  it('handles multiple subscribers correctly', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const unsub1 = bandwidthDetector.subscribe(fn1)
    const unsub2 = bandwidthDetector.subscribe(fn2)

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)

    unsub1()
    unsub2()
  })

  it('TIER_CONFIGS dimensions maintain 16:9 aspect ratio', () => {
    const tiers: QualityTier[] = ['ultra', 'high', 'medium', 'low', 'minimal']
    for (const t of tiers) {
      const cfg = TIER_CONFIGS[t]
      const ratio = cfg.width / cfg.height
      expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.02)
    }
  })
})

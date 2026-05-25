import { useState, useEffect } from 'react'
import {
  bandwidthDetector,
  type QualityTier,
  type BandwidthSnapshot
} from '../services/bandwidth-detector'

export function useBandwidthQuality(): {
  qualityTier: QualityTier
  snapshot: BandwidthSnapshot | null
  tierLabel: string
} {
  const [qualityTier, setQualityTier] = useState<QualityTier>(bandwidthDetector.currentTier)
  const [snapshot, setSnapshot] = useState<BandwidthSnapshot | null>(
    bandwidthDetector.isRunning ? bandwidthDetector.lastSnapshot : null
  )

  useEffect(() => {
    return bandwidthDetector.subscribe((s) => {
      setQualityTier(s.qualityTier)
      setSnapshot(s)
    })
  }, [])

  const labels: Record<QualityTier, string> = {
    ultra: 'ULTRA',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    minimal: 'MINIMAL'
  }

  return { qualityTier, snapshot, tierLabel: labels[qualityTier] }
}

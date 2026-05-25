import { useEffect, useRef, type ReactElement } from 'react'
import gsap from 'gsap'
import { useSystemStore } from '@renderer/store/system-store'

interface SphereProps {
  isAiSpeaking: boolean
  isMicActive?: boolean
}

const Sphere = ({ isAiSpeaking, isMicActive: isMicActiveProp }: SphereProps): ReactElement => {
  const isMicMuted = useSystemStore((s) => s.isMicMuted)
  const glowRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const tRef = useRef(0)
  const isMicActive = isMicActiveProp ?? !isMicMuted

  const prevModeRef = useRef<'idle' | 'active' | 'speaking'>('idle')
  const transitionProgressRef = useRef<number>(1)
  const transitionFromRef = useRef<'idle' | 'active' | 'speaking'>('idle')

  useEffect(() => {
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: isMicActive ? 0.6 : 0,
        scale: isMicActive ? 1 : 0.85,
        duration: 0.3,
        ease: 'power2.out'
      })
    }
  }, [isMicActive, isAiSpeaking])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const PHI = (1 + Math.sqrt(5)) / 2
    const OUTER_R = 110
    const INNER_R = 50

    const rawVerts: [number, number, number][] = [
      [0, 1, PHI],
      [0, -1, PHI],
      [0, 1, -PHI],
      [0, -1, -PHI],
      [1, PHI, 0],
      [-1, PHI, 0],
      [1, -PHI, 0],
      [-1, -PHI, 0],
      [PHI, 0, 1],
      [PHI, 0, -1],
      [-PHI, 0, 1],
      [-PHI, 0, -1]
    ]

    const normalize = (v: [number, number, number], r: number): [number, number, number] => {
      const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
      return [(v[0] / len) * r, (v[1] / len) * r, (v[2] / len) * r]
    }

    const outerVerts = rawVerts.map((v) => normalize(v, OUTER_R))
    const innerVerts = rawVerts.map((v) => normalize(v, INNER_R))

    const buildEdges = (
      verts: [number, number, number][],
      threshold: number
    ): [number, number][] => {
      const edges: [number, number][] = []
      for (let i = 0; i < verts.length; i++) {
        for (let j = i + 1; j < verts.length; j++) {
          const dx = verts[i][0] - verts[j][0]
          const dy = verts[i][1] - verts[j][1]
          const dz = verts[i][2] - verts[j][2]
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < threshold) edges.push([i, j])
        }
      }
      return edges
    }

    const outerEdges = buildEdges(outerVerts, OUTER_R * 1.28)
    const innerEdges = buildEdges(innerVerts, INNER_R * 1.28)

    const rotate3D = (
      x: number,
      y: number,
      z: number,
      rotX: number,
      rotY: number
    ): [number, number, number] => {
      const y1 = y * Math.cos(rotX) - z * Math.sin(rotX)
      const z1 = y * Math.sin(rotX) + z * Math.cos(rotX)
      const x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY)
      const z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY)
      return [x2, y1, z2]
    }

    const project = (
      x: number,
      y: number,
      z: number,
      cx: number,
      cy: number
    ): { x: number; y: number; z: number; p: number } => {
      const p = 500 / (500 + z)
      return { x: cx + x * p, y: cy + y * p, z, p }
    }

    const syncCanvasSize = (): { width: number; height: number; cx: number; cy: number } => {
      const rect = canvas.getBoundingClientRect()
      const size = Math.max(360, Math.min(rect.width || 0, rect.height || 0))
      const width = size || 360
      const height = size || 360
      const dpr = window.devicePixelRatio || 1
      const nextWidth = Math.max(1, Math.round(width * dpr))
      const nextHeight = Math.max(1, Math.round(height * dpr))
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth
        canvas.height = nextHeight
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { width, height, cx: width / 2, cy: height / 2 }
    }

    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
    const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

    const stateColors = {
      idle: {
        outerEdgeR: 140,
        outerEdgeG: 160,
        outerEdgeB: 180,
        outerNodeR: 160,
        outerNodeG: 180,
        outerNodeB: 200,
        innerEdgeR: 80,
        innerEdgeG: 60,
        innerEdgeB: 120,
        innerNodeR: 120,
        innerNodeG: 80,
        innerNodeB: 180,
        rotSpeedX: 0.3,
        rotSpeedY: 0.5,
        outerEdgeWidth: 0.8
      },
      active: {
        outerEdgeR: 0,
        outerEdgeG: 200,
        outerEdgeB: 255,
        outerNodeR: 0,
        outerNodeG: 220,
        outerNodeB: 255,
        innerEdgeR: 0,
        innerEdgeG: 255,
        innerEdgeB: 157,
        innerNodeR: 0,
        innerNodeG: 255,
        innerNodeB: 200,
        rotSpeedX: 0.6,
        rotSpeedY: 1.0,
        outerEdgeWidth: 0.8
      },
      speaking: {
        outerEdgeR: 0,
        outerEdgeG: 230,
        outerEdgeB: 220,
        outerNodeR: 0,
        outerNodeG: 255,
        outerNodeB: 210,
        innerEdgeR: 0,
        innerEdgeG: 255,
        innerEdgeB: 157,
        innerNodeR: 0,
        innerNodeG: 255,
        innerNodeB: 200,
        rotSpeedX: 0.8,
        rotSpeedY: 1.3,
        outerEdgeWidth: 1.2
      }
    }

    const animate = (): void => {
      const { width, height, cx, cy } = syncCanvasSize()
      const t = tRef.current

      const currentMode: 'idle' | 'active' | 'speaking' = isAiSpeaking
        ? 'speaking'
        : isMicActive
          ? 'active'
          : 'idle'

      if (prevModeRef.current !== currentMode) {
        transitionFromRef.current = prevModeRef.current
        prevModeRef.current = currentMode
        transitionProgressRef.current = 0
      }

      if (transitionProgressRef.current < 1) {
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + 0.025)
      }

      const progress = transitionProgressRef.current
      const easedProgress = easeInOut(progress)

      const fromColors = stateColors[transitionFromRef.current]
      const toColors = stateColors[currentMode]

      const currentColors = {
        outerEdgeR: lerp(fromColors.outerEdgeR, toColors.outerEdgeR, easedProgress),
        outerEdgeG: lerp(fromColors.outerEdgeG, toColors.outerEdgeG, easedProgress),
        outerEdgeB: lerp(fromColors.outerEdgeB, toColors.outerEdgeB, easedProgress),
        outerNodeR: lerp(fromColors.outerNodeR, toColors.outerNodeR, easedProgress),
        outerNodeG: lerp(fromColors.outerNodeG, toColors.outerNodeG, easedProgress),
        outerNodeB: lerp(fromColors.outerNodeB, toColors.outerNodeB, easedProgress),
        innerEdgeR: lerp(fromColors.innerEdgeR, toColors.innerEdgeR, easedProgress),
        innerEdgeG: lerp(fromColors.innerEdgeG, toColors.innerEdgeG, easedProgress),
        innerEdgeB: lerp(fromColors.innerEdgeB, toColors.innerEdgeB, easedProgress),
        innerNodeR: lerp(fromColors.innerNodeR, toColors.innerNodeR, easedProgress),
        innerNodeG: lerp(fromColors.innerNodeG, toColors.innerNodeG, easedProgress),
        innerNodeB: lerp(fromColors.innerNodeB, toColors.innerNodeB, easedProgress),
        rotSpeedX: lerp(fromColors.rotSpeedX, toColors.rotSpeedX, easedProgress),
        rotSpeedY: lerp(fromColors.rotSpeedY, toColors.rotSpeedY, easedProgress),
        outerEdgeWidth: lerp(fromColors.outerEdgeWidth, toColors.outerEdgeWidth, easedProgress)
      }

      const rotX = t * currentColors.rotSpeedX
      const rotY = t * currentColors.rotSpeedY

      ctx.clearRect(0, 0, width, height)

      const outerProjected = outerVerts.map((v) => {
        const [rx, ry, rz] = rotate3D(v[0], v[1], v[2], rotX, rotY)
        return project(rx, ry, rz, cx, cy)
      })

      const innerProjected = innerVerts.map((v) => {
        const [rx, ry, rz] = rotate3D(v[0], v[1], v[2], rotX, rotY)
        return project(rx, ry, rz, cx, cy)
      })

      if (currentMode === 'speaking') {
        const hue = 160 + Math.sin(t * 0.5) * 40
        const grd = ctx.createRadialGradient(cx, cy, 60, cx, cy, OUTER_R * 1.4)
        grd.addColorStop(0, `hsla(${hue}, 100%, 40%, 0.12)`)
        grd.addColorStop(1, `hsla(${hue}, 80%, 30%, 0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, OUTER_R * 1.4, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      } else {
        const glowGrd = ctx.createRadialGradient(cx, cy, 80, cx, cy, OUTER_R)
        glowGrd.addColorStop(
          0,
          currentMode === 'active' ? 'rgba(100, 50, 255, 0.15)' : 'rgba(100, 50, 255, 0.05)'
        )
        glowGrd.addColorStop(
          1,
          currentMode === 'active' ? 'rgba(80, 30, 200, 0.04)' : 'rgba(80, 30, 200, 0)'
        )
        ctx.beginPath()
        ctx.arc(cx, cy, OUTER_R, 0, Math.PI * 2)
        ctx.fillStyle = glowGrd
        ctx.fill()
      }

      for (const [i, j] of innerEdges) {
        const pulse = Math.sin(t * 3 + i) * 0.5 + 0.5
        ctx.beginPath()
        ctx.moveTo(innerProjected[i].x, innerProjected[i].y)
        ctx.lineTo(innerProjected[j].x, innerProjected[j].y)
        ctx.strokeStyle = `rgba(
          ${Math.round(currentColors.innerEdgeR)},
          ${Math.round(currentColors.innerEdgeG)},
          ${Math.round(currentColors.innerEdgeB)},
          ${0.2 + pulse * 0.4}
        )`
        ctx.lineWidth = currentMode === 'speaking' ? 1 + pulse : 0.5 + pulse
        ctx.stroke()
      }

      innerProjected.forEach((node, i) => {
        const pulse = (Math.sin(t * 4 + i * 0.8) + 1) * 0.5
        const audioPulse = currentMode === 'speaking' ? Math.abs(Math.sin(t * 8 + i * 0.6)) : 0

        if (currentMode === 'speaking') {
          const r = (8 + audioPulse * 6) * node.p
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r)
          grd.addColorStop(
            0,
            `rgba(
            ${Math.round(currentColors.innerNodeR)},
            ${Math.round(currentColors.innerNodeG)},
            ${Math.round(currentColors.innerNodeB)},
            0.9
          )`
          )
          grd.addColorStop(1, 'rgba(0, 100, 150, 0)')
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        } else {
          const r = 6 * node.p
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r)
          grd.addColorStop(
            0,
            `rgba(
            ${Math.round(currentColors.innerNodeR)},
            ${Math.round(currentColors.innerNodeG)},
            ${Math.round(currentColors.innerNodeB)},
            ${0.8 + pulse * 0.2}
          )`
          )
          grd.addColorStop(1, 'rgba(60, 30, 100, 0)')
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }
      })

      for (const [i, j] of outerEdges) {
        const avgZ = (outerProjected[i].z + outerProjected[j].z) / 2
        const alpha = 0.15 + 0.5 * ((avgZ + OUTER_R) / (OUTER_R * 2))
        ctx.beginPath()
        ctx.moveTo(outerProjected[i].x, outerProjected[i].y)
        ctx.lineTo(outerProjected[j].x, outerProjected[j].y)
        ctx.strokeStyle = `rgba(
          ${Math.round(currentColors.outerEdgeR)},
          ${Math.round(currentColors.outerEdgeG)},
          ${Math.round(currentColors.outerEdgeB)},
          ${alpha}
        )`
        ctx.lineWidth = currentColors.outerEdgeWidth
        ctx.stroke()
      }

      outerProjected.forEach((node, i) => {
        const pulse = (Math.sin(t * 2 + i) + 1) * 0.5
        const audioPulse = currentMode === 'speaking' ? Math.abs(Math.sin(t * 8 + i * 0.6)) : 0

        if (currentMode === 'speaking') {
          ctx.beginPath()
          ctx.arc(node.x, node.y, (3.5 + audioPulse * 4) * node.p, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(
            ${Math.round(currentColors.outerNodeR)},
            ${Math.round(currentColors.outerNodeG)},
            ${Math.round(currentColors.outerNodeB)},
            0.9
          )`
          ctx.fill()
          const glowR = (12 + audioPulse * 18) * node.p
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
          grd.addColorStop(
            0,
            `rgba(
            ${Math.round(currentColors.outerNodeR)},
            ${Math.round(currentColors.outerNodeG)},
            ${Math.round(currentColors.outerNodeB)},
            0.25
          )`
          )
          grd.addColorStop(
            1,
            `rgba(
            ${Math.round(currentColors.outerNodeR * 0.6)},
            ${Math.round(currentColors.outerNodeG * 0.6)},
            ${Math.round(currentColors.outerNodeB * 0.6)},
            0
          )`
          )
          ctx.beginPath()
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        } else {
          const dotAlpha = currentMode === 'active' ? 0.9 + pulse * 0.1 : 0.7
          ctx.beginPath()
          ctx.arc(node.x, node.y, 3.5 * node.p, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(
            ${Math.round(currentColors.outerNodeR)},
            ${Math.round(currentColors.outerNodeG)},
            ${Math.round(currentColors.outerNodeB)},
            ${dotAlpha}
          )`
          ctx.fill()
          const glowR = 12 * node.p
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
          grd.addColorStop(
            0,
            `rgba(
            ${Math.round(currentColors.outerNodeR)},
            ${Math.round(currentColors.outerNodeG)},
            ${Math.round(currentColors.outerNodeB)},
            0.12
          )`
          )
          grd.addColorStop(1, 'rgba(0, 100, 255, 0)')
          ctx.beginPath()
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }
      })

      if (currentMode === 'speaking' || transitionFromRef.current === 'speaking') {
        const ringEased = currentMode === 'speaking' ? easedProgress : 1 - easedProgress
        const hue = 160 + Math.sin(t * 0.5) * 40
        for (let ring = 0; ring < 3; ring++) {
          const ringPhase = t * 2 - ring * 0.8
          const ringScale = (ringPhase % (Math.PI * 2)) / (Math.PI * 2)
          const ringR = OUTER_R * (1.1 + ringScale * 0.6)
          const ringAlpha = (1 - ringScale) * 0.35 * ringEased
          if (ringAlpha <= 0) continue
          ctx.beginPath()
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${ringAlpha})`
          ctx.lineWidth = 1.5 - ringScale
          ctx.stroke()
        }
      }

      if (
        currentMode === 'active' ||
        (transitionFromRef.current === 'active' && currentMode === 'idle')
      ) {
        const ringEased = currentMode === 'active' ? easedProgress : 1 - easedProgress
        const r1 = OUTER_R * 1.15 + Math.sin(t * 3) * 8
        ctx.beginPath()
        ctx.arc(cx, cy, r1, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 255, 157, ${0.2 * ringEased})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        const r2 = OUTER_R * 1.28 + Math.sin(t * 2) * 5
        ctx.beginPath()
        ctx.arc(cx, cy, r2, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 255, 157, ${0.2 * ringEased})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      const frameSpeed = lerp(fromColors.rotSpeedX * 0.02, toColors.rotSpeedX * 0.02, easedProgress)
      tRef.current += frameSpeed
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isMicActive, isAiSpeaking])

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div
        ref={glowRef}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '90%',
          height: '90%',
          opacity: 0,
          boxShadow: 'none'
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          minWidth: '360px',
          minHeight: '360px',
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          boxShadow: 'none',
          border: 'none',
          borderRadius: 0
        }}
      />
    </div>
  )
}

export default Sphere

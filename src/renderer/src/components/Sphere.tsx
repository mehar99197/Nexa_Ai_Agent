/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, type ReactElement } from 'react'
import * as THREE from 'three'
import { nexaService } from '@renderer/services/Nexa-voice-ai'

interface CustomParticleSphereProps {
  count?: number
}

interface ParticleData {
  positions: Float32Array
  originalPositions: Float32Array
  spreadFactors: Float32Array
}

const seededRandom = (seed: number): number => {
  const value = Math.sin(seed) * 10000
  return value - Math.floor(value)
}

const CustomParticleSphere = ({ count = 3000 }: CustomParticleSphereProps): ReactElement => {
  const mesh = useRef<THREE.Points>(null)

  const dataArray = useMemo<Uint8Array<ArrayBuffer>>(() => new Uint8Array(128), [])

  const colorStart = useMemo(() => new THREE.Color('#33db12'), [])
  const colorEnd = useMemo(() => new THREE.Color('#FFFFFF'), [])
  const colorTarget = useMemo(() => new THREE.Color(), [])

  const { positions, originalPositions, spreadFactors } = useMemo<ParticleData>(() => {
    const pos = new Float32Array(count * 3)
    const orig = new Float32Array(count * 3)
    const spread = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const x = seededRandom(i * 3 + 1) * 2 - 1
      const y = seededRandom(i * 3 + 2) * 2 - 1
      const z = seededRandom(i * 3 + 3) * 2 - 1

      const vector = new THREE.Vector3(x, y, z)
      vector.normalize().multiplyScalar(2)

      pos[i * 3] = vector.x
      pos[i * 3 + 1] = vector.y
      pos[i * 3 + 2] = vector.z

      orig[i * 3] = vector.x
      orig[i * 3 + 1] = vector.y
      orig[i * 3 + 2] = vector.z

      spread[i] = seededRandom(i + 1000)
    }
    return { positions: pos, originalPositions: orig, spreadFactors: spread }
  }, [count])

  useFrame((state, delta) => {
    if (!state.clock.running || !mesh.current) return

    mesh.current.rotation.y += delta * 0.05
    mesh.current.rotation.z += delta * 0.05

    let volume = 0
    if (nexaService.analyser) {
      nexaService.analyser.getByteFrequencyData(dataArray)

      let sum = 0
      const len = dataArray.length
      for (let i = 0; i < len; i++) {
        sum += dataArray[i]
      }
      volume = sum / len / 128
    }

    colorTarget.lerpColors(colorStart, colorEnd, volume)
    ;(mesh.current.material as THREE.PointsMaterial).color.copy(colorTarget)

    const currentPos = mesh.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2

      const expansion = 1 + volume * spreadFactors[i] * 0.4

      currentPos[ix] = originalPositions[ix] * expansion
      currentPos[iy] = originalPositions[iy] * expansion
      currentPos[iz] = originalPositions[iz] * expansion
    }

    mesh.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#00F0FF"
        size={0.012}
        transparent={true}
        opacity={0.9}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

const Sphere = (): ReactElement => {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5] }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.6} />
      <CustomParticleSphere />
    </Canvas>
  )
}

export default Sphere

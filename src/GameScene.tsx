import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CubeState } from './CubeState'
import {
  FACE_BASES,
  getHitSurfacePoint,
  getOutwardNormal,
  type FaceId,
  type SurfaceCell,
} from './surfaceGraph'

const NEON = '#38bdf8'

type CellMeshesProps = {
  n: number
  onCellPointerDown: (cell: SurfaceCell, event: PointerEvent | MouseEvent) => void
}

function CellMeshes({ n, onCellPointerDown }: CellMeshesProps) {
  const size = (2 / n) * 0.96

  return (
    <group>
      {FACE_BASES.map((basis) => (
        <group key={basis.id}>
          {Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => {
              const pos = getHitSurfacePoint(basis, i, j, n, 0.018)
              const normal = getOutwardNormal(basis.id)
              const quat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                normal,
              )
              const cell: SurfaceCell = { face: basis.id as FaceId, i, j }
              return (
                <mesh
                  key={`${basis.id}-${i}-${j}`}
                  position={pos}
                  quaternion={quat}
                  userData={{ cell }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onCellPointerDown(cell, e.nativeEvent as PointerEvent)
                  }}
                >
                  <planeGeometry args={[size, size]} />
                  <meshStandardMaterial
                    color="#243548"
                    transparent
                    opacity={0.72}
                    depthWrite={true}
                    side={THREE.DoubleSide}
                    polygonOffset
                    polygonOffsetFactor={1}
                    polygonOffsetUnits={1}
                    emissive="#0c4a6e"
                    emissiveIntensity={0.18}
                  />
                </mesh>
              )
            }),
          ).flat()}
        </group>
      ))}
    </group>
  )
}

function ShellOutline() {
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(2.008, 2.008, 2.008)
    const edges = new THREE.EdgesGeometry(box, 50)
    box.dispose()
    return edges
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <lineSegments geometry={geometry} renderOrder={2}>
      <lineBasicMaterial color="#22d3ee" transparent opacity={0.95} depthTest depthWrite={false} />
    </lineSegments>
  )
}

function FaceGridLines({ n }: { n: number }) {
  const segments = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const addLine = (a: THREE.Vector3, b: THREE.Vector3) => {
      pts.push(a.clone(), b.clone())
    }

    const half = 1
    const step = (2 * half) / n

    for (const basis of FACE_BASES) {
      const nrm = basis.center.clone().normalize()
      const eps = nrm.clone().multiplyScalar(0.004)

      for (let a = 0; a <= n; a++) {
        const u = -half + a * step
        const p1 = basis.center
          .clone()
          .addScaledVector(basis.u, u)
          .addScaledVector(basis.v, -half)
          .add(eps)
        const p2 = basis.center
          .clone()
          .addScaledVector(basis.u, u)
          .addScaledVector(basis.v, half)
          .add(eps)
        addLine(p1, p2)
      }

      for (let b = 0; b <= n; b++) {
        const v = -half + b * step
        const p1 = basis.center
          .clone()
          .addScaledVector(basis.u, -half)
          .addScaledVector(basis.v, v)
          .add(eps)
        const p2 = basis.center
          .clone()
          .addScaledVector(basis.u, half)
          .addScaledVector(basis.v, v)
          .add(eps)
        addLine(p1, p2)
      }
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    return geo
  }, [n])

  useEffect(() => {
    return () => segments.dispose()
  }, [segments])

  return (
    <lineSegments geometry={segments} renderOrder={1}>
      <lineBasicMaterial color="#cbd5e1" transparent opacity={1} depthTest depthWrite={false} />
    </lineSegments>
  )
}

function StrokeTube({
  points,
  color,
  radius,
}: {
  points: THREE.Vector3[]
  color: string
  radius: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    if (points.length < 2) return null
    let path = [...points]
    if (path.length === 2) {
      const mid = path[0]!.clone().lerp(path[1]!, 0.5)
      path = [path[0]!, mid, path[1]!]
    }
    const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.35)
    const tubularSegments = Math.max(16, (points.length - 1) * 10)
    return new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false)
  }, [points, radius])

  useEffect(() => {
    return () => {
      geometry?.dispose()
    }
  }, [geometry])

  useFrame(() => {
    const m = meshRef.current?.material
    if (m && !Array.isArray(m) && m instanceof THREE.MeshStandardMaterial) {
      m.emissiveIntensity = 0.85 + Math.sin(performance.now() * 0.004) * 0.08
    }
  })

  if (!geometry) return null

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.9}
        toneMapped={false}
        roughness={0.35}
        metalness={0.15}
      />
    </mesh>
  )
}

function SceneContent({
  n,
  cubeState,
  onPathsChange,
  renderSeq,
}: {
  n: number
  cubeState: CubeState
  onPathsChange: () => void
  renderSeq: number
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const { camera, gl, scene } = useThree()
  const draggingRef = useRef(false)
  const lastTapRef = useRef<{ t: number; key: string } | null>(null)
  const scratch = useRef<THREE.Vector3[]>([])

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])

  const pickCellFromClient = useCallback(
    (clientX: number, clientY: number): SurfaceCell | null => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      for (const h of hits) {
        const c = h.object.userData.cell as SurfaceCell | undefined
        if (c) return c
      }
      return null
    },
    [camera, gl.domElement, pointer, raycaster, scene],
  )

  const vibrateShort = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20)
    }
  }

  const endDrag = useCallback(() => {
    draggingRef.current = false
    const ctrl = controlsRef.current
    if (ctrl) ctrl.enabled = true
    cubeState.commitActiveStroke()
    onPathsChange()
  }, [cubeState, onPathsChange])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const cell = pickCellFromClient(e.clientX, e.clientY)
      if (!cell) return
      const prevLen = cubeState.getActiveStroke().length
      const changed = cubeState.extendStroke(cell)
      if (changed && cubeState.getActiveStroke().length !== prevLen) {
        vibrateShort()
        onPathsChange()
      }
    }
    const onUp = () => {
      if (draggingRef.current) endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [cubeState, endDrag, onPathsChange, pickCellFromClient])

  const handleCellPointerDown = useCallback(
    (cell: SurfaceCell, native: PointerEvent | MouseEvent) => {
      const key = `${cell.face}:${cell.i},${cell.j}`
      const now = performance.now()
      const last = lastTapRef.current
      if (last && last.key === key && now - last.t < 320) {
        cubeState.resetAll()
        lastTapRef.current = null
        onPathsChange()
        return
      }
      lastTapRef.current = { t: now, key }

      draggingRef.current = true
      const ctrl = controlsRef.current
      if (ctrl) ctrl.enabled = false
      cubeState.cancelActiveStroke()
      cubeState.beginStroke(cell)
      onPathsChange()
      if (native instanceof PointerEvent) {
        ;(native.target as HTMLElement | undefined)?.setPointerCapture?.(native.pointerId)
      }
    },
    [cubeState, onPathsChange],
  )

  const tubes = useMemo(() => {
    const rows: { id: string; pts: THREE.Vector3[]; color: string }[] = []
    let idx = 0
    for (const s of cubeState.getStrokes()) {
      const pts = cubeState.worldPointsForStroke(s.cells, scratch.current)
      rows.push({ id: `s-${idx++}`, pts: [...pts], color: s.color })
    }
    const active = cubeState.getActiveStroke()
    if (active.length >= 2) {
      const pts = cubeState.worldPointsForStroke(active, scratch.current)
      rows.push({ id: 'active', pts: [...pts], color: NEON })
    }
    return rows
  }, [cubeState, renderSeq])

  return (
    <>
      <color attach="background" args={['#0b1020']} />
      <hemisphereLight intensity={0.55} color="#b8d4ff" groundColor="#1a1520" />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.35} />
      <directionalLight position={[-4, -2, -5]} intensity={0.45} />

      <ShellOutline />

      <FaceGridLines n={n} />
      <CellMeshes n={n} onCellPointerDown={handleCellPointerDown} />

      {tubes.map((t) => (
        <StrokeTube key={t.id} points={t.pts} color={t.color} radius={0.055 / n} />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.65}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI - 0.25}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        minDistance={2.35}
        maxDistance={6.5}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          // One-finger gestures are reserved for drawing on the shell.
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.ROTATE,
        }}
      />
    </>
  )
}

export function GameScene({
  n = 3,
  resetToken,
}: {
  n?: number
  resetToken: number
}) {
  const cubeRef = useRef(new CubeState(n))
  const [renderSeq, setRenderSeq] = useState(0)
  const bump = useCallback(() => setRenderSeq((t) => t + 1), [])

  useEffect(() => {
    cubeRef.current = new CubeState(n)
    bump()
  }, [n, resetToken, bump])

  return (
    <Canvas
      className="!block h-full min-h-[100svh] w-full touch-none"
      style={{ width: '100%', height: '100%', minHeight: '100svh' }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        preserveDrawingBuffer: false,
      }}
      camera={{ position: [2.35, 1.85, 2.65], fov: 45, near: 0.05, far: 40 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0b1020', 1)
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.15
      }}
    >
      <SceneContent
        n={n}
        cubeState={cubeRef.current}
        onPathsChange={bump}
        renderSeq={renderSeq}
      />
    </Canvas>
  )
}

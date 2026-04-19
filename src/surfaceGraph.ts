import * as THREE from 'three'

/** Half extent of the cube in world units (vertices at ±HALF). */
export const HALF = 1

export type FaceId = 0 | 1 | 2 | 3 | 4 | 5

export type SurfaceCell = {
  face: FaceId
  i: number
  j: number
}

export type FaceBasis = {
  id: FaceId
  center: THREE.Vector3
  /** Unit axis along increasing cell index `i` (local horizontal on the face). */
  u: THREE.Vector3
  /** Unit axis along increasing cell index `j` (local vertical on the face). */
  v: THREE.Vector3
}

/**
 * Six outward faces (Y-up): +Z front, -Z back, +X right, -X left, +Y top, -Y bottom.
 * Axes are chosen so neighboring face cells share exact 3D centers on edges.
 */
export const FACE_BASES: readonly FaceBasis[] = [
  { id: 0, center: new THREE.Vector3(0, 0, HALF), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  { id: 1, center: new THREE.Vector3(0, 0, -HALF), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  { id: 2, center: new THREE.Vector3(HALF, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  { id: 3, center: new THREE.Vector3(-HALF, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  { id: 4, center: new THREE.Vector3(0, HALF, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  { id: 5, center: new THREE.Vector3(0, -HALF, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
]

const _tmp = new THREE.Vector3()

export function cellKey(c: SurfaceCell): string {
  return `${c.face}:${c.i},${c.j}`
}

export function parseCellKey(key: string): SurfaceCell | null {
  const m = /^(\d):(\d+),(\d+)$/.exec(key)
  if (!m) return null
  return { face: Number(m[1]) as FaceId, i: Number(m[2]), j: Number(m[3]) }
}

export function getCellCenter(b: FaceBasis, i: number, j: number, n: number): THREE.Vector3 {
  const uCoord = ((i + 0.5) / n) * 2 - 1
  const vCoord = ((j + 0.5) / n) * 2 - 1
  return _tmp
    .copy(b.center)
    .addScaledVector(b.u, uCoord * HALF)
    .addScaledVector(b.v, vCoord * HALF)
}

export function buildNeighborMap(n: number): Map<string, SurfaceCell[]> {
  const step = (2 * HALF) / n
  const centers: { key: string; pos: THREE.Vector3; cell: SurfaceCell }[] = []

  for (const basis of FACE_BASES) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cell: SurfaceCell = { face: basis.id, i, j }
        centers.push({
          key: cellKey(cell),
          pos: getCellCenter(basis, i, j, n).clone(),
          cell,
        })
      }
    }
  }

  const neighbors = new Map<string, SurfaceCell[]>()

  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  for (const { key, pos, cell } of centers) {
    const list: SurfaceCell[] = []
    const basis = FACE_BASES[cell.face]!

    for (const [di, dj] of dirs) {
      const ni = cell.i + di
      const nj = cell.j + dj
      if (ni >= 0 && ni < n && nj >= 0 && nj < n) {
        list.push({ face: cell.face, i: ni, j: nj })
        continue
      }

      const delta = _tmp
        .copy(basis.u)
        .multiplyScalar(di * step)
        .addScaledVector(basis.v, dj * step)
      const target = pos.clone().add(delta)

      let bestKey: string | null = null
      let bestD = Infinity
      for (const other of centers) {
        if (other.key === key) continue
        const d = other.pos.distanceToSquared(target)
        if (d < bestD) {
          bestD = d
          bestKey = other.key
        }
      }

      if (bestKey && bestD < (step * 0.55) ** 2) {
        const oc = centers.find((c) => c.key === bestKey)?.cell
        if (oc) list.push(oc)
      }
    }

    neighbors.set(key, list)
  }

  return neighbors
}

export function getOutwardNormal(face: FaceId): THREE.Vector3 {
  const c = FACE_BASES[face]!.center
  return c.clone().normalize()
}

/** Slightly offset hit surface along the normal for stable raycasts. */
export function getHitSurfacePoint(b: FaceBasis, i: number, j: number, n: number, eps = 0.02): THREE.Vector3 {
  return getCellCenter(b, i, j, n).addScaledVector(getOutwardNormal(b.id), eps)
}

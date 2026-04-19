import * as THREE from 'three'
import {
  buildNeighborMap,
  cellKey,
  FACE_BASES,
  getCellCenter,
  type SurfaceCell,
} from './surfaceGraph'

export type LineStroke = {
  color: string
  cells: SurfaceCell[]
}

export class CubeState {
  readonly n: number
  readonly neighborByKey: Map<string, SurfaceCell[]>
  private strokes: LineStroke[] = []
  private activeStroke: SurfaceCell[] = []
  private activeColor = '#38bdf8'

  constructor(n: number) {
    this.n = n
    this.neighborByKey = buildNeighborMap(n)
  }

  getActiveColor(): string {
    return this.activeColor
  }

  setActiveColor(color: string): void {
    this.activeColor = color
  }

  getStrokes(): readonly LineStroke[] {
    return this.strokes
  }

  getActiveStroke(): readonly SurfaceCell[] {
    return this.activeStroke
  }

  neighbors(cell: SurfaceCell): SurfaceCell[] {
    return this.neighborByKey.get(cellKey(cell)) ?? []
  }

  isNeighbor(a: SurfaceCell, b: SurfaceCell): boolean {
    return this.neighbors(a).some((x) => x.face === b.face && x.i === b.i && x.j === b.j)
  }

  beginStroke(start: SurfaceCell): void {
    this.activeStroke = [start]
  }

  /** Extend the stroke to `next` if it is adjacent to the tip (or backtracks one step). */
  extendStroke(next: SurfaceCell): boolean {
    if (this.activeStroke.length === 0) return false
    const tip = this.activeStroke[this.activeStroke.length - 1]!
    if (tip.face === next.face && tip.i === next.i && tip.j === next.j) return false

    const prev =
      this.activeStroke.length >= 2
        ? this.activeStroke[this.activeStroke.length - 2]!
        : null
    if (prev && prev.face === next.face && prev.i === next.i && prev.j === next.j) {
      this.activeStroke.pop()
      return true
    }

    if (!this.isNeighbor(tip, next)) return false
    if (this.activeStroke.some((c) => c.face === next.face && c.i === next.i && c.j === next.j)) {
      return false
    }

    this.activeStroke.push(next)
    return true
  }

  commitActiveStroke(): void {
    if (this.activeStroke.length < 2) {
      this.activeStroke = []
      return
    }
    this.strokes.push({ color: this.activeColor, cells: [...this.activeStroke] })
    this.activeStroke = []
  }

  cancelActiveStroke(): void {
    this.activeStroke = []
  }

  resetAll(): void {
    this.strokes = []
    this.activeStroke = []
  }

  worldPointsForStroke(cells: readonly SurfaceCell[], target: THREE.Vector3[] = []): THREE.Vector3[] {
    target.length = 0
    for (const c of cells) {
      const basis = FACE_BASES[c.face]!
      target.push(getCellCenter(basis, c.i, c.j, this.n))
    }
    return target
  }
}

import type { Point2 } from './vectorModel'

export type Segment2 = {
  start: Point2
  end: Point2
}

export type SegmentProjection = {
  index: number
  t: number
  point: Point2
  distance: number
  direction: Point2
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const projectPointToSegment = (point: Point2, segment: Segment2, index = 0): SegmentProjection => {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared < 1e-8
    ? 0
    : clamp01(((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared)
  const projected = {
    x: segment.start.x + dx * t,
    y: segment.start.y + dy * t,
  }
  const length = Math.hypot(dx, dy)

  return {
    index,
    t,
    point: projected,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    direction: length < 1e-8 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length },
  }
}

export const nearestPointOnPolyline = (point: Point2, segments: Segment2[]): SegmentProjection | null => {
  let best: SegmentProjection | null = null
  segments.forEach((segment, index) => {
    const projection = projectPointToSegment(point, segment, index)
    if (!best || projection.distance < best.distance) best = projection
  })
  return best
}

export const pointOnSegment = (segment: Segment2, t: number): Point2 => ({
  x: segment.start.x + (segment.end.x - segment.start.x) * clamp01(t),
  y: segment.start.y + (segment.end.y - segment.start.y) * clamp01(t),
})

export const normalizedSegmentDirection = (segment: Segment2): Point2 => {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const length = Math.hypot(dx, dy)
  return length < 1e-8 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length }
}

export const tangentEndpoints = (point: Point2, direction: Point2, halfLength = 120) => ({
  start: {
    x: point.x - direction.x * halfLength,
    y: point.y - direction.y * halfLength,
  },
  end: {
    x: point.x + direction.x * halfLength,
    y: point.y + direction.y * halfLength,
  },
})

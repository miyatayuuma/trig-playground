import { describe, expect, it } from 'vitest'
import {
  nearestPointOnPolyline,
  normalizedSegmentDirection,
  projectPointToSegment,
  tangentEndpoints,
} from './waveTangentModel'

describe('wave tangent geometry', () => {
  it('projects a pointer onto the closest point of a segment', () => {
    const projection = projectPointToSegment(
      { x: 7, y: 4 },
      { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    )
    expect(projection.t).toBeCloseTo(0.7, 8)
    expect(projection.point).toEqual({ x: 7, y: 0 })
    expect(projection.distance).toBeCloseTo(4, 8)
  })

  it('selects the nearest segment of a polyline', () => {
    const result = nearestPointOnPolyline({ x: 12, y: 7 }, [
      { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
    ])
    expect(result?.index).toBe(1)
    expect(result?.point.x).toBeCloseTo(10, 8)
    expect(result?.point.y).toBeCloseTo(7, 8)
  })

  it('keeps the tangent centered on the selected wave point', () => {
    const direction = normalizedSegmentDirection({
      start: { x: 0, y: 0 },
      end: { x: 3, y: 4 },
    })
    const tangent = tangentEndpoints({ x: 20, y: 30 }, direction, 10)
    expect((tangent.start.x + tangent.end.x) / 2).toBeCloseTo(20, 8)
    expect((tangent.start.y + tangent.end.y) / 2).toBeCloseTo(30, 8)
    expect(Math.hypot(tangent.end.x - tangent.start.x, tangent.end.y - tangent.start.y)).toBeCloseTo(20, 8)
  })
})

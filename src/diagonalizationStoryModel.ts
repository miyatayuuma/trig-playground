export type StoryPoint = { x: number; y: number }

export type DiagonalizationStoryFrame = {
  scene: 'world' | 'reframe' | 'reset' | 'eigen'
  basisMorph: number
  transformProgress: number
  transformedOpacity: number
  scaleEmphasis: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const smoothStoryStep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

export const normalizeStoryVector = (value: StoryPoint): StoryPoint => {
  const length = Math.hypot(value.x, value.y)
  return length < 1e-8 ? { x: 1, y: 0 } : { x: value.x / length, y: value.y / length }
}

export const orientDirectionNear = (direction: StoryPoint, reference: StoryPoint): StoryPoint => {
  const unit = normalizeStoryVector(direction)
  const target = normalizeStoryVector(reference)
  return unit.x * target.x + unit.y * target.y < 0
    ? { x: -unit.x, y: -unit.y }
    : unit
}

export const interpolateDirection = (from: StoryPoint, to: StoryPoint, progress: number): StoryPoint => {
  const t = smoothStoryStep(progress)
  return normalizeStoryVector({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  })
}

export const addStoryVectors = (a: StoryPoint, b: StoryPoint): StoryPoint => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const scaleStoryVector = (value: StoryPoint, scale: number): StoryPoint => ({
  x: value.x * scale,
  y: value.y * scale,
})

export const interpolateStoryPoint = (from: StoryPoint, to: StoryPoint, progress: number): StoryPoint => {
  const t = smoothStoryStep(progress)
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  }
}

export const eigenCoordinates = (
  point: StoryPoint,
  eigenOne: StoryPoint,
  eigenTwo: StoryPoint,
): StoryPoint => {
  const determinant = eigenOne.x * eigenTwo.y - eigenOne.y * eigenTwo.x
  if (Math.abs(determinant) < 1e-8) return { x: 0, y: 0 }
  return {
    x: (point.x * eigenTwo.y - point.y * eigenTwo.x) / determinant,
    y: (eigenOne.x * point.y - eigenOne.y * point.x) / determinant,
  }
}

export const applyEigenTransform = (
  point: StoryPoint,
  eigenOne: StoryPoint,
  eigenTwo: StoryPoint,
  lambdaOne: number,
  lambdaTwo: number,
): StoryPoint => {
  const coefficients = eigenCoordinates(point, eigenOne, eigenTwo)
  return {
    x: eigenOne.x * coefficients.x * lambdaOne + eigenTwo.x * coefficients.y * lambdaTwo,
    y: eigenOne.y * coefficients.x * lambdaOne + eigenTwo.y * coefficients.y * lambdaTwo,
  }
}

export const diagonalizationStoryFrame = (progress: number): DiagonalizationStoryFrame => {
  const p = ((progress % 1) + 1) % 1

  if (p < 0.30) {
    return {
      scene: 'world',
      basisMorph: 0,
      transformProgress: smoothStoryStep(p / 0.22),
      transformedOpacity: 1,
      scaleEmphasis: 0,
    }
  }

  if (p < 0.53) {
    return {
      scene: 'reframe',
      basisMorph: smoothStoryStep((p - 0.30) / 0.23),
      transformProgress: 1,
      transformedOpacity: 1,
      scaleEmphasis: smoothStoryStep((p - 0.40) / 0.13) * 0.35,
    }
  }

  if (p < 0.64) {
    return {
      scene: 'reset',
      basisMorph: 1,
      transformProgress: 0,
      transformedOpacity: 1 - smoothStoryStep((p - 0.53) / 0.11),
      scaleEmphasis: 0.45,
    }
  }

  return {
    scene: 'eigen',
    basisMorph: 1,
    transformProgress: smoothStoryStep((p - 0.64) / 0.22),
    transformedOpacity: 1,
    scaleEmphasis: smoothStoryStep((p - 0.64) / 0.18),
  }
}

export const negativeScaleCrossingProgress = (lambda: number) =>
  lambda < 0 ? 1 / (1 - lambda) : null

export const crossingPulse = (transformProgress: number, lambda: number) => {
  const crossing = negativeScaleCrossingProgress(lambda)
  if (crossing === null) return 0
  const distance = (transformProgress - crossing) / 0.085
  return Math.exp(-(distance * distance))
}

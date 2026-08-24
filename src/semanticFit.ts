export type SemanticBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ViewportSize = {
  width: number
  height: number
}

export type SemanticFit = {
  scale: number
  shiftXPercent: number
  shiftYPercent: number
}

export const boundsFromRect = (
  x: number,
  y: number,
  width: number,
  height: number,
): SemanticBounds => ({
  minX: x,
  minY: y,
  maxX: x + width,
  maxY: y + height,
})

export const unionBounds = (bounds: SemanticBounds[]): SemanticBounds | null => {
  if (bounds.length === 0) return null
  return {
    minX: Math.min(...bounds.map((value) => value.minX)),
    minY: Math.min(...bounds.map((value) => value.minY)),
    maxX: Math.max(...bounds.map((value) => value.maxX)),
    maxY: Math.max(...bounds.map((value) => value.maxY)),
  }
}

export const expandBounds = (
  bounds: SemanticBounds,
  paddingX: number,
  paddingY: number,
): SemanticBounds => ({
  minX: bounds.minX - paddingX,
  minY: bounds.minY - paddingY,
  maxX: bounds.maxX + paddingX,
  maxY: bounds.maxY + paddingY,
})

export const fitSemanticBounds = (
  bounds: SemanticBounds,
  viewport: ViewportSize,
  options: {
    safePaddingX?: number
    safePaddingY?: number
    maxScale?: number
  } = {},
): SemanticFit => {
  const safePaddingX = options.safePaddingX ?? 32
  const safePaddingY = options.safePaddingY ?? 28
  const maxScale = options.maxScale ?? 1
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const safeWidth = Math.max(1, viewport.width - safePaddingX * 2)
  const safeHeight = Math.max(1, viewport.height - safePaddingY * 2)
  const scale = Math.min(maxScale, safeWidth / width, safeHeight / height)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    scale,
    shiftXPercent: scale * (viewport.width / 2 - centerX) / viewport.width * 100,
    shiftYPercent: scale * (viewport.height / 2 - centerY) / viewport.height * 100,
  }
}

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180

export const trigValues = (degrees: number) => {
  const radians = degreesToRadians(degrees)
  return {
    radians,
    sin: Math.sin(radians),
    cos: Math.cos(radians),
  }
}

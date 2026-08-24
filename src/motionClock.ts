let installed = false
let paused = false
let frozenTimestamp: number | null = null

export const installMotionClock = () => {
  if (installed) return
  installed = true

  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window)

  window.requestAnimationFrame = (callback: FrameRequestCallback) => nativeRequestAnimationFrame((timestamp) => {
    if (!paused) {
      frozenTimestamp = null
      callback(timestamp)
      return
    }

    if (frozenTimestamp === null) frozenTimestamp = timestamp
    callback(frozenTimestamp)
  })
}

export const setMotionPaused = (value: boolean) => {
  paused = value
  if (!value) frozenTimestamp = null
}

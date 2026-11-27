/** Paint from the actual media clock, without scheduling React renders. */
export function bindStoryVideoProgress(video: HTMLVideoElement, bar: HTMLElement): () => void {
  let frame: number | null = null
  function paint() {
    const duration = video.duration
    const time = video.currentTime
    const progress = Number.isFinite(duration) && duration > 0 && Number.isFinite(time)
      ? Math.max(0, Math.min(1, time / duration)) : 0
    bar.style.transform = `scaleX(${progress})`
  }
  function stop() {
    if (frame !== null) window.cancelAnimationFrame(frame)
    frame = null
    paint()
  }
  function tick() {
    frame = null
    paint()
    if (!video.paused && !video.ended) frame = window.requestAnimationFrame(tick)
  }
  function start() {
    if (frame === null && !video.paused && !video.ended) tick()
  }
  const updates = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked']
  const stops = ['pause', 'waiting', 'ended', 'emptied', 'error']
  for (const event of updates) video.addEventListener(event, paint)
  for (const event of stops) video.addEventListener(event, stop)
  video.addEventListener('playing', start)
  paint()
  start()
  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame)
    for (const event of updates) video.removeEventListener(event, paint)
    for (const event of stops) video.removeEventListener(event, stop)
    video.removeEventListener('playing', start)
  }
}

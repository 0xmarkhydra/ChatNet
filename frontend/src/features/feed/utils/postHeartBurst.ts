const particleCount = 14
const waveSteps = 18

function between(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function burstPostHearts(button: HTMLButtonElement) {
  const doc = button.ownerDocument
  const win = doc.defaultView
  if (!win?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches
    || typeof button.animate !== 'function') return

  const bounds = (button.querySelector('svg') ?? button).getBoundingClientRect()
  const x = bounds.left + bounds.width / 2
  const y = bounds.top + bounds.height / 2
  const burst = doc.createElement('span')
  burst.className = 'feed-heart-burst'
  burst.setAttribute('aria-hidden', 'true')
  burst.style.left = `${x}px`
  burst.style.top = `${y}px`
  // The fixed layer keeps hearts from being clipped by a card or the reaction menu.
  doc.body.append(burst)

  const animations = Array.from({ length: particleCount }, (_, index) => {
    const heart = doc.createElement('span')
    const size = between(11, 31)
    const edge = size / 2 + 4
    const rise = Math.min(between(175, 325), Math.max(0, y - edge))
    const drift = between(-78, 78)
    const sway = between(13, 37)
    const phase = between(0, Math.PI * 2)
    const waves = between(1, 1.5)
    const tilt = between(8, 24)
    heart.className = 'feed-heart-particle'
    heart.textContent = '♥'
    heart.style.fontSize = `${size.toFixed(1)}px`
    burst.append(heart)

    const frames: Keyframe[] = Array.from({ length: waveSteps + 1 }, (_, step) => {
      const t = step / waveSteps
      const wave = Math.sin(phase + t * Math.PI * 2 * waves)
      const spread = drift * t + sway * (wave - Math.sin(phase)) * Math.sin(t * Math.PI / 2)
      const clampedX = Math.max(edge, Math.min(win.innerWidth - edge, x + spread))
      const dx = step === 0 ? 0 : clampedX - x
      const dy = -rise * t
      const scale = t < .16 ? .44 + t / .16 * .56 : 1 - (t - .16) * .21
      const opacity = t < .16 ? .26 + t / .16 * .74 : Math.min(1, (1 - t) / .29)
      return {
        offset: t,
        transform: `translate(-50%, -50%) translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${(wave * tilt).toFixed(1)}deg) scale(${scale.toFixed(2)})`,
        opacity,
      }
    })

    return heart.animate(frames, {
      duration: between(1600, 2350),
      delay: index * 16 + between(0, 85),
      easing: 'cubic-bezier(.23,.48,.42,1)',
    }).finished
  })
  void Promise.allSettled(animations).then(() => burst.remove())
}

'use strict'

const api = window.socoScreenshotSelector
const bitmap = document.getElementById('bitmap')
const selection = document.getElementById('selection')
const cancel = document.getElementById('cancel')
let start = null, submitted = false

api.onBitmap(async (dataURL) => {
  bitmap.src = dataURL
  try { await bitmap.decode(); api.ready(true) } catch { api.ready(false) }
})

function submit(region) {
  if (submitted) return
  submitted = true
  api.select(region)
}

function clamp(value) { return Math.max(0, Math.min(1, value)) }
function point(event) {
  return { x: clamp(event.clientX / window.innerWidth), y: clamp(event.clientY / window.innerHeight) }
}
function box(event) {
  const end = point(event)
  return {
    left: Math.min(start.x, end.x), top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y),
  }
}
function draw(event) {
  const { left, top, right, bottom } = box(event)
  Object.assign(selection.style, {
    left: `${left * 100}%`, top: `${top * 100}%`,
    width: `${(right - left) * 100}%`, height: `${(bottom - top) * 100}%`,
  })
}
function clear() {
  start = null
  selection.hidden = true
  document.body.classList.remove('selecting')
}

document.body.addEventListener('pointerdown', (event) => {
  if (submitted || start || !event.isPrimary || event.button !== 0 || event.target.closest('.help')) return
  document.body.setPointerCapture(event.pointerId)
  start = { ...point(event), pointerId: event.pointerId }
  selection.hidden = false
  document.body.classList.add('selecting')
  draw(event)
})

document.body.addEventListener('pointermove', (event) => {
  if (start?.pointerId === event.pointerId) draw(event)
})

document.body.addEventListener('pointerup', (event) => {
  if (start?.pointerId !== event.pointerId) return
  const region = box(event)
  clear()
  if ((region.right - region.left) * window.innerWidth >= 3 &&
      (region.bottom - region.top) * window.innerHeight >= 3) submit(region)
})

document.body.addEventListener('lostpointercapture', (event) => {
  if (start?.pointerId === event.pointerId) clear()
})

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); submit(null) }
})
cancel.addEventListener('click', () => submit(null))

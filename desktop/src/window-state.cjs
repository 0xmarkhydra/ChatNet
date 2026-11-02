'use strict'

const fs = require('node:fs')
const { dirname } = require('node:path')

function normalizeWindowState(value, workAreas) {
  const areas = workAreas.filter((a) => a && [a.x, a.y, a.width, a.height].every(Number.isFinite) && a.width > 0 && a.height > 0)
  if (!areas.length) throw new Error('WINDOW_NO_DISPLAY')
  const raw = value && typeof value === 'object' ? value : {}
  const bounds = raw.bounds || {}
  const valid = ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key]) && Math.abs(bounds[key]) <= 100000)
    && bounds.width >= 200 && bounds.height >= 200
  const area = valid && areas.find((a) =>
    Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x) >= 100 &&
    Math.min(bounds.y + bounds.height, a.y + a.height) - Math.max(bounds.y, a.y) >= 100) || areas[0]
  const width = Math.round(Math.min(area.width, Math.max(880, valid ? bounds.width : 1240)))
  const height = Math.round(Math.min(area.height, Math.max(580, valid ? bounds.height : 800)))
  const x = valid ? Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)) : area.x + (area.width - width) / 2
  const y = valid ? Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) : area.y + (area.height - height) / 2
  return {
    bounds: { x: Math.round(x), y: Math.round(y), width, height },
    maximized: raw.maximized === true,
    closeToTray: typeof raw.closeToTray === 'boolean' ? raw.closeToTray : null,
  }
}

function readWindowState(file, workAreas) {
  let value
  try {
    const info = fs.lstatSync(file)
    if (info.isFile() && !info.isSymbolicLink() && info.size <= 4096) value = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch { /* First launch or corrupt non-sensitive geometry: use visible defaults. */ }
  return normalizeWindowState(value, workAreas)
}

function writeWindowState(file, state) {
  fs.mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.tmp`
  try {
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 })
    fs.renameSync(temp, file)
  } finally {
    try { fs.unlinkSync(temp) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

module.exports = { normalizeWindowState, readWindowState, writeWindowState }

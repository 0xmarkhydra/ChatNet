'use strict'

// The Windows overlay is only 16 pixels wide, so use a legible 3×5 pixel font.
const glyphs = {
  0: '111 101 101 101 111',
  1: '010 110 010 010 010',
  2: '111 001 111 100 111',
  3: '111 001 111 001 111',
  4: '101 101 111 001 001',
  5: '111 100 111 001 111',
  6: '111 100 111 101 111',
  7: '111 001 010 010 010',
  8: '111 101 111 101 111',
  9: '111 101 111 001 111',
  '+': '000 010 111 010 000',
}

const size = 16
const white = [255, 255, 255, 255]
const red = [13, 0, 235, 255] // BGRA for Electron nativeImage.

function drawTaskbarBadge(label, attention) {
  const bitmap = Buffer.alloc(size * size * 4)
  const rows = [...label].map(char => glyphs[char].split(' '))
  const scale = label.length === 1 ? 1.8 : label.length === 2 ? 1.25 : 1
  const centeredLeft = (size - (4 * label.length - 1) * scale) / 2
  const textLeft = label.length === 3 ? Math.floor(centeredLeft) : centeredLeft
  const textTop = label.length === 3 ? 4 : 7.1 - 2.5 * scale

  function colorAt(x, y) {
    if (Math.hypot(x - 8, y - 7.1) <= 7.1) {
      const col = Math.floor((x - textLeft) / scale)
      const row = Math.floor((y - textTop) / scale)
      return col >= 0 && rows[Math.floor(col / 4)]?.[row]?.[col % 4] === '1' ? white : red
    }
    const lineDx = Math.max(Math.abs(x - 8) - 3.15, 0)
    if (attention && Math.hypot(lineDx, y - 15.35) <= 0.8) return red
    return null
  }

  // Average four samples per axis for a smooth 16 px circle and premultiplied alpha.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0]
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const color = colorAt(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)
          if (color) for (let c = 0; c < 4; c++) sum[c] += color[c]
        }
      }
      bitmap.set(sum.map(channel => Math.round(channel / 16)), (y * size + x) * 4)
    }
  }
  return bitmap
}

module.exports = { drawTaskbarBadge, size }

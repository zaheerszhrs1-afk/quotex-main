// Generates simple PWA icons (green rounded square with a candlestick glyph)
// using only Node built-ins (zlib). Produces 192x192 and 512x512 PNGs.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function makePng(size) {
  const bg = [14, 22, 33] // #0E1621
  const green = [0, 192, 118] // #00C076
  const red = [255, 98, 88] // #FF6258
  const px = (x, y) => {
    // rounded square background
    const r = size * 0.22
    const inset = size * 0.06
    const inX = x - inset
    const inY = y - inset
    const w = size - inset * 2
    // corner rounding test
    const cx = Math.min(Math.max(inX, r), w - r) + inset
    const cy = Math.min(Math.max(inY, r), w - r) + inset
    const d = Math.hypot(x - cx, y - cy)
    if (inX < 0 || inY < 0 || inX > w || inY > w || d > r) return null // transparent

    // candle 1 (green) and candle 2 (red)
    const c1x = size * 0.4
    const c2x = size * 0.6
    const bodyW = size * 0.08
    const wickW = size * 0.018
    const within = (val, c, halfW) => Math.abs(val - c) <= halfW
    // green candle body + wick
    if (within(x, c1x, wickW / 2) && y > size * 0.22 && y < size * 0.78) return green
    if (within(x, c1x, bodyW / 2) && y > size * 0.4 && y < size * 0.68) return green
    // red candle body + wick
    if (within(x, c2x, wickW / 2) && y > size * 0.3 && y < size * 0.82) return red
    if (within(x, c2x, bodyW / 2) && y > size * 0.45 && y < size * 0.72) return red
    return bg
  }

  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter type none
    for (let x = 0; x < size; x++) {
      const c = px(x, y)
      if (c === null) {
        raw[o++] = 0
        raw[o++] = 0
        raw[o++] = 0
        raw[o++] = 0
      } else {
        raw[o++] = c[0]
        raw[o++] = c[1]
        raw[o++] = c[2]
        raw[o++] = 255
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makePng(size))
  console.log(`wrote icon-${size}.png`)
}

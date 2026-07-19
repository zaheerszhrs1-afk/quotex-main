// Generates simple, valid PNG screenshots for the PWA manifest so APK packagers
// (PWABuilder / Bubblewrap) stop warning about missing screenshots.
// Pure Node (zlib) PNG encoder — produces a solid branded background.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
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

function makePNG(width, height, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  // rest 0 (compression, filter, interlace)
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.join(__dirname, '..', 'public', 'screenshots')
fs.mkdirSync(outDir, { recursive: true })

const bg = [14, 22, 33] // #0E1621 brand background
fs.writeFileSync(path.join(outDir, 'mobile.png'), makePNG(1080, 1920, bg))
fs.writeFileSync(path.join(outDir, 'desktop.png'), makePNG(1920, 1080, bg))
console.log('Wrote screenshots to', outDir)

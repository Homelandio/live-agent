const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [16, 32, 48, 256];

function roundedRect(x, y, width, height, radius, px, py) {
  const dx = Math.max(Math.abs(px - (x + radius)) - (width - radius * 2), 0);
  const dy = Math.max(Math.abs(py - (y + radius)) - (height - radius * 2), 0);
  return dx * dx + dy * dy <= radius * radius;
}

function circle(cx, cy, radius, px, py) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}

function pixel(size, x, y) {
  const scale = size / 256;
  const sx = x / scale;
  const sy = y / scale;
  let color = [0, 0, 0, 0];

  // A high-contrast navy workspace tile with blue dialogue and amber status mark.
  if (roundedRect(8, 8, 240, 240, 48, sx, sy)) color = [13, 24, 45, 255];
  if (roundedRect(42, 48, 172, 126, 28, sx, sy)) color = [76, 179, 255, 255];
  if (sx >= 72 && sx <= 105 && sy >= 158 && sy <= 205 && sy >= 158 + (sx - 72) * 1.42) color = [76, 179, 255, 255];
  if (circle(88, 111, 11, sx, sy) || circle(128, 111, 11, sx, sy) || circle(168, 111, 11, sx, sy)) color = [13, 24, 45, 255];
  if (circle(202, 202, 27, sx, sy)) color = [255, 184, 92, 255];
  if (circle(202, 202, 11, sx, sy)) color = [13, 24, 45, 255];
  return color;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, checksum]);
}

function pngImage(size) {
  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (rowBytes + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(size, x, y);
      const offset = row + 1 + x * 4;
      raw[offset] = r; raw[offset + 1] = g; raw[offset + 2] = b; raw[offset + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const images = sizes.map(pngImage);
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(0, 0); directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
for (let i = 0; i < sizes.length; i += 1) {
  const size = sizes[i]; const entry = 6 + i * 16; const image = images[i];
  directory[entry] = size === 256 ? 0 : size; directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8); directory.writeUInt32LE(offset, entry + 12); offset += image.length;
}

const output = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([directory, ...images]));
console.log(`created ${output} (${fs.statSync(output).size} bytes)`);

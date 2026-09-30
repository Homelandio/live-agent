const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 256];

function roundedRect(x, y, width, height, radius, px, py) {
  const dx = Math.max(Math.abs(px - (x + radius)) - (width - radius * 2), 0);
  const dy = Math.max(Math.abs(py - (y + radius)) - (height - radius * 2), 0);
  return dx * dx + dy * dy <= radius * radius;
}

function pixel(size, x, y) {
  const scale = size / 256;
  const sx = x / scale;
  const sy = y / scale;
  let color = [0, 0, 0, 0];
  if (roundedRect(8, 8, 240, 240, 48, sx, sy)) color = [15, 27, 49, 255];
  if (roundedRect(36, 54, 184, 124, 30, sx, sy)) color = [45, 212, 191, 255];
  if (roundedRect(58, 78, 140, 18, 9, sx, sy) || roundedRect(58, 112, 104, 18, 9, sx, sy)) color = [8, 20, 38, 255];
  if (sx >= 72 && sx <= 94 && sy >= 146 && sy <= 180 && sy >= 146 + (sx - 72) * 1.55) color = [45, 212, 191, 255];
  const d1 = Math.abs(Math.hypot(sx - 174, sy - 205) - 30);
  const d2 = Math.abs(Math.hypot(sx - 174, sy - 205) - 48);
  if ((d1 < 7 && sy < 205) || (d2 < 7 && sy < 205)) color = [239, 250, 250, 255];
  return color;
}

function imageData(size) {
  const rowBytes = size * 4;
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const buffer = Buffer.alloc(40 + rowBytes * size + maskRowBytes * size);
  buffer.writeUInt32LE(40, 0);
  buffer.writeInt32LE(size, 4);
  buffer.writeInt32LE(size * 2, 8);
  buffer.writeUInt16LE(1, 12);
  buffer.writeUInt16LE(32, 14);
  buffer.writeUInt32LE(rowBytes * size, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(size, x, y);
      const offset = 40 + ((size - 1 - y) * size + x) * 4;
      buffer[offset] = b; buffer[offset + 1] = g; buffer[offset + 2] = r; buffer[offset + 3] = a;
    }
  }
  return buffer;
}

const images = sizes.map(imageData);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i]; const image = images[i]; const entry = 6 + i * 16;
  header[entry] = size === 256 ? 0 : size; header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += image.length;
}
const output = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, ...images]));
console.log(`created ${output}`);

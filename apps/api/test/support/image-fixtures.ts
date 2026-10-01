/**
 * Minimal image files with real headers (type signature plus pixel size),
 * followed by `tag` so every fixture is unique. Enough for the API's checks;
 * not decodable pictures.
 */

export function pngImage(width: number, height: number, tag = ''): Buffer {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'latin1');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdr,
    Buffer.from(tag),
  ]);
}

export function jpegImage(width: number, height: number, tag = ''): Buffer {
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(19);
  sof0.writeUInt16BE(0xffc0, 0);
  sof0.writeUInt16BE(17, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from(tag)]);
}

export function webpImage(width: number, height: number, tag = ''): Buffer {
  const header = Buffer.alloc(30);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(22 + tag.length, 4);
  header.write('WEBP', 8, 'latin1');
  header.write('VP8X', 12, 'latin1');
  header.writeUInt32LE(10, 16);
  header.writeUIntLE(width - 1, 24, 3);
  header.writeUIntLE(height - 1, 27, 3);
  return Buffer.concat([header, Buffer.from(tag)]);
}

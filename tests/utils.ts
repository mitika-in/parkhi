export function concat(...buffers: Uint8Array[]): Uint8Array {
  const size = buffers.reduce((size, buffer) => size + buffer.length, 0);
  const result = new Uint8Array(size);

  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

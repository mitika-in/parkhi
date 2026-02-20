export function parseU32(b0: number, b1: number, b2: number, b3: number): number {
  const l0 = b0 << 24;
  const l1 = b1 << 16;
  const l2 = b2 << 8;
  const l3 = b3 << 0;
  const u32 = (l0 | l1 | l2 | l3) >>> 0;
  return u32;
}

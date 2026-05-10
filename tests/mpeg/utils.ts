import { concat, encodeAscii, encodeU32 } from "../utils.ts";

export function makeBox(type: string, ...data: Uint8Array[]): Uint8Array {
  const boxData = concat(...data);

  const box = new Uint8Array(4 + 4 + boxData.length);

  const boxSize = encodeU32(box.length);
  box.set(boxSize, 0);

  const boxType = encodeAscii(type);
  box.set(boxType, 4);

  box.set(boxData, 8);

  return box;
}

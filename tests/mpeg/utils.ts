import { concat } from "../utils.ts";

export function asciiEncode(data: string): Uint8Array {
  const array = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) array[i] = data.charCodeAt(i);
  return array;
}

export function makeBox(type: string, ...data: Uint8Array[]): Uint8Array {
  const boxData = concat(...data);

  const box = new Uint8Array(4 + 4 + boxData.length);

  box[0] = (box.length >>> 24) & 0xff;
  box[1] = (box.length >>> 16) & 0xff;
  box[2] = (box.length >>> 8) & 0xff;
  box[3] = (box.length >>> 0) & 0xff;

  const boxType = asciiEncode(type);
  box.set(boxType, 4);

  box.set(boxData, 8);

  return box;
}

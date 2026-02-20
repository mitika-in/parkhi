import { Buffer } from "../buffer.ts";

export function synchronise(ff: boolean, data: Uint8Array): { data: Uint8Array; ff: boolean } {
  let i = 0;

  for (const byte of data) {
    if (!(byte == 0x00 && ff)) {
      data[i] = byte;
      i += 1;
    }
    ff = byte == 0xff;
  }

  return { data: data.subarray(0, i), ff };
}

export class SyncBuffer implements Pick<Buffer, keyof Buffer> {
  private buffer: Buffer = new Buffer();
  private rejectedChunks: Uint8Array[] = [];
  private ff = false;
  private readLength = 0;

  constructor(
    chunks: Uint8Array[] = [],
    private maxLength = Infinity,
  ) {
    for (const chunk of chunks) this.push(chunk);
  }

  get length() {
    return this.buffer.length;
  }

  get done() {
    return this.readLength == this.maxLength;
  }

  get rejected() {
    return this.rejectedChunks;
  }

  push(chunk: Uint8Array) {
    if (chunk.length == 0) return;
    if (this.done) return;

    const readableLength = Math.min(this.maxLength - this.readLength, chunk.length);
    const rejected = chunk.subarray(readableLength);
    chunk = chunk.subarray(0, readableLength);
    if (rejected.length != 0) this.rejectedChunks.push(rejected);

    const result = synchronise(this.ff, chunk);
    this.buffer.push(result.data);
    this.ff = result.ff;
    this.readLength += chunk.length;
  }

  peek(idx: number): number {
    return this.buffer.peek(idx);
  }

  slice(begin: number, end: number): Uint8Array {
    return this.buffer.slice(begin, end);
  }

  pop(size: number): Uint8Array {
    return this.buffer.pop(size);
  }
}

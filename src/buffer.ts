import { ErrorCode, ParkhiError } from "./error.ts";

export class Buffer {
  private chunks: Uint8Array[] = [];
  private rejectedChunks: Uint8Array[] = [];
  private len = 0;
  private readLength = 0;

  constructor(
    chunks: Uint8Array[] = [],
    private maxLength = Infinity,
  ) {
    for (const chunk of chunks) this.push(chunk);
  }

  get length() {
    return this.len;
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

    this.chunks.push(chunk);
    this.len += chunk.length;
    this.readLength += chunk.length;
  }

  peek(idx: number): number {
    if (idx > this.len) throw new Error(`idx (${idx}) exceeds length (${this.len})`);

    for (const chunk of this.chunks) {
      if (idx < chunk.length) return chunk[idx]!;
      idx -= chunk.length;
    }

    throw new ParkhiError(ErrorCode.Internal, "unreachable code");
  }

  slice(begin: number, end: number): Uint8Array {
    if (begin > this.len) throw new Error(`begin (${begin}) exceeds length (${this.len})`);
    if (end > this.len) throw new Error(`end (${end}) exceeds length (${this.len})`);

    if (this.chunks.length == 0) return new Uint8Array(0);

    const size = end - begin;
    const chunks = [];
    let remaining = size;

    let chunkIdx;
    for (chunkIdx = 0; chunkIdx < this.chunks.length; chunkIdx++) {
      const chunk = this.chunks[chunkIdx]!;
      if (chunk.length > begin) break;
      begin -= chunk.length;
    }

    const chunk = this.chunks[chunkIdx]!;
    const subChunk = chunk.subarray(begin, begin + Math.min(remaining, chunk.length));
    chunks.push(subChunk);
    remaining -= subChunk.length;
    chunkIdx += 1;

    while (remaining != 0) {
      const chunk = this.chunks[chunkIdx]!;
      const subChunk = chunk.subarray(0, Math.min(remaining, chunk.length));
      chunks.push(subChunk);
      remaining -= subChunk.length;
      chunkIdx += 1;
    }

    const array = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      array.set(chunk, offset);
      offset += chunk.length;
    }

    return array;
  }

  pop(size: number): Uint8Array {
    if (size > this.len) throw new Error(`size (${size}) exceeds length (${this.len})`);

    const chunks = [];
    let remaining = size;

    while (remaining != 0) {
      const chunk = this.chunks[0]!;

      if (remaining < chunk.length) {
        const left = chunk.subarray(0, remaining);
        const right = chunk.subarray(remaining, chunk.length);
        chunks.push(left);
        this.chunks[0] = right;
        remaining -= left.length;
      } else {
        this.chunks.shift();
        chunks.push(chunk);
        remaining -= chunk.length;
      }
    }

    const array = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      array.set(chunk, offset);
      offset += chunk.length;
    }

    this.len -= size;

    return array;
  }
}

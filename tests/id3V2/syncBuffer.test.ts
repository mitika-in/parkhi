import { SyncBuffer, synchronise } from "../../src/id3V2/syncBuffer.ts";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("synchronise", () => {
  it("should return identical data when no 0xff is present", () => {
    const result = synchronise(false, new Uint8Array([0x01, 0x02, 0x03]));
    assert.deepEqual(result.data, new Uint8Array([0x01, 0x02, 0x03]));
    assert.equal(result.ff, false);
  });

  it("should handle empty input data", () => {
    const result = synchronise(false, new Uint8Array([]));
    assert.deepEqual(result.data, new Uint8Array([]));
    assert.equal(result.ff, false);
  });

  it("should preserve ff state if data is empty", () => {
    const result = synchronise(true, new Uint8Array([]));
    assert.equal(result.ff, true);
  });

  it("should strip 0x00 following 0xff", () => {
    const result = synchronise(false, new Uint8Array([0x60, 0xff, 0x00, 0x70]));
    assert.deepEqual(result.data, new Uint8Array([0x60, 0xff, 0x70]));
    assert.equal(result.ff, false);
  });

  it("should strip multiple 0x00 bytes following multiple 0xff bytes", () => {
    const result = synchronise(false, new Uint8Array([0xff, 0x00, 0x11, 0xff, 0x00, 0x22]));
    assert.deepEqual(result.data, new Uint8Array([0xff, 0x11, 0xff, 0x22]));
    assert.equal(result.ff, false);
  });

  it("should handle the 0xff 0x00 0x00 pattern", () => {
    const result = synchronise(false, new Uint8Array([0xff, 0x00, 0x00]));
    assert.deepEqual(result.data, new Uint8Array([0xff, 0x00]));
    assert.equal(result.ff, false);
  });

  it("should handle the 0xff 0xff 0x00 pattern", () => {
    const result = synchronise(false, new Uint8Array([0xff, 0xff, 0x00]));
    assert.deepEqual(result.data, new Uint8Array([0xff, 0xff]));
    assert.equal(result.ff, false);
  });

  it("should handle a chunk consisting only of 0xff 0x00", () => {
    const result = synchronise(false, new Uint8Array([0xff, 0x00]));
    assert.deepEqual(result.data, new Uint8Array([0xff]));
    assert.equal(result.ff, false);
  });

  it("should set ff to true if chunk ends with 0xff", () => {
    const result = synchronise(false, new Uint8Array([0xaa, 0xff]));
    assert.deepEqual(result.data, new Uint8Array([0xaa, 0xff]));
    assert.equal(result.ff, true);
  });

  it("should handle a single byte chunk of 0xff", () => {
    const result = synchronise(false, new Uint8Array([0xff]));
    assert.deepEqual(result.data, new Uint8Array([0xff]));
    assert.equal(result.ff, true);
  });

  it("should handle a single byte chunk of 0x00 with ff true", () => {
    const result = synchronise(true, new Uint8Array([0x00]));
    assert.deepEqual(result.data, new Uint8Array([]));
    assert.equal(result.ff, false);
  });

  it("should strip 0x00 at start of chunk if ff is true", () => {
    const result = synchronise(true, new Uint8Array([0x00, 0xaa, 0xbb]));
    assert.deepEqual(result.data, new Uint8Array([0xaa, 0xbb]));
    assert.equal(result.ff, false);
  });

  it("should not strip 0x00 at start of chunk if ff is false", () => {
    const result = synchronise(false, new Uint8Array([0x00, 0xaa, 0xbb]));
    assert.deepEqual(result.data, new Uint8Array([0x00, 0xaa, 0xbb]));
    assert.equal(result.ff, false);
  });

  it("should handle 0xff and 0x00 split across chunks", () => {
    const res1 = synchronise(false, new Uint8Array([0xaa, 0xff]));
    assert.equal(res1.ff, true);

    const res2 = synchronise(res1.ff, new Uint8Array([0x00, 0xbb]));
    assert.deepEqual(res2.data, new Uint8Array([0xbb]));
    assert.equal(res2.ff, false);
  });

  it("should handle 0xff at end of chunk followed by non-zero at start of next", () => {
    const res1 = synchronise(false, new Uint8Array([0xaa, 0xff]));
    const res2 = synchronise(res1.ff, new Uint8Array([0xbb, 0xcc]));
    assert.deepEqual(res2.data, new Uint8Array([0xbb, 0xcc]));
    assert.equal(res2.ff, false);
  });

  it("should handle consecutive 0xff bytes split across chunks", () => {
    const res1 = synchronise(false, new Uint8Array([0xff]));
    const res2 = synchronise(res1.ff, new Uint8Array([0xff, 0x00]));
    assert.deepEqual(res2.data, new Uint8Array([0xff]));
    assert.equal(res2.ff, false);
  });
});

describe("SyncBuffer", () => {
  it("should be empty on construction", () => {
    const buffer = new SyncBuffer();
    assert.equal(buffer.length, 0);
  });

  it("should be filled with given chunks on construction", () => {
    const buffer = new SyncBuffer([new Uint8Array([0x00]), new Uint8Array([0x01, 0x02])]);
    assert.deepEqual(buffer.length, 3);
  });

  it("should peek valid indices", () => {
    const buffer = new SyncBuffer([
      new Uint8Array([0xff]),
      new Uint8Array([0x00, 0x01]),
      new Uint8Array([0x02, 0x03, 0x04]),
      new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    ]);
    assert.equal(buffer.peek(0), 0xff);
    assert.equal(buffer.peek(1), 0x01);
    assert.equal(buffer.peek(3), 0x03);
    assert.equal(buffer.peek(6), 0x06);
  });

  it("should fail for greedy peek request", () => {
    const buffer = new SyncBuffer();
    assert.throws(
      () => buffer.peek(0),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should be okay for empty slice", () => {
    const buffer = new SyncBuffer();
    assert.deepEqual(buffer.slice(0, 0), new Uint8Array(0));
  });

  it("should fail for greedy slice request", () => {
    const buffer = new SyncBuffer();
    assert.throws(
      () => buffer.slice(1, 1),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should slice cleanly on aligned request", () => {
    const buffer = new SyncBuffer([
      new Uint8Array([0xff]),
      new Uint8Array([0x00, 0x01]),
      new Uint8Array([0x02, 0x03, 0x04]),
      new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    ]);
    const slice = buffer.slice(3, 6);
    assert.deepEqual(slice, new Uint8Array([0x03, 0x04, 0x05]));
    assert.deepEqual(buffer.length, 9);
  });

  it("should split and slice on non-aligned request", () => {
    const buffer = new SyncBuffer([
      new Uint8Array([0xff]),
      new Uint8Array([0x00, 0x01]),
      new Uint8Array([0x02, 0x03, 0x04]),
      new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    ]);
    const slice = buffer.slice(2, 7);
    assert.deepEqual(slice, new Uint8Array([0x02, 0x03, 0x04, 0x05, 0x06]));
    assert.deepEqual(buffer.length, 9);
  });

  it("should be okay for empty pop", () => {
    const buffer = new SyncBuffer();
    assert.deepEqual(buffer.pop(0), new Uint8Array(0));
  });

  it("should fail for greedy pop request", () => {
    const buffer = new SyncBuffer();
    assert.throws(
      () => buffer.pop(1),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should pop cleanly on aligned request", () => {
    const buffer = new SyncBuffer([
      new Uint8Array([0xff]),
      new Uint8Array([0x00, 0x01]),
      new Uint8Array([0x02, 0x03, 0x04]),
      new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    ]);
    const array = buffer.pop(3);
    assert.deepEqual(array, new Uint8Array([0xff, 0x01, 0x02]));
    assert.deepEqual(buffer.length, 6);
  });

  it("should split and pop on non-aligned request", () => {
    const buffer = new SyncBuffer([
      new Uint8Array([0xff]),
      new Uint8Array([0x00, 0x01]),
      new Uint8Array([0x02, 0x03, 0x04]),
      new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    ]);
    const array = buffer.pop(5);
    assert.deepEqual(array, new Uint8Array([0xff, 0x01, 0x02, 0x03, 0x04]));
    assert.deepEqual(buffer.length, 4);
  });

  it("should respect maximum length", () => {
    const buffer = new SyncBuffer(
      [
        new Uint8Array([0xff]),
        new Uint8Array([0x00, 0x01]),
        new Uint8Array([0x02, 0x03, 0x04]),
        new Uint8Array([0x05, 0x06, 0x07, 0x08]),
      ],
      7,
    );
    assert.equal(buffer.length, 6);
    assert.deepEqual(buffer.slice(0, 6), new Uint8Array([0xff, 0x01, 0x02, 0x03, 0x04, 0x05]));
    assert.deepEqual(buffer.rejected, [new Uint8Array([0x06, 0x07, 0x08])]);
    assert.ok(buffer.done);
  });
});

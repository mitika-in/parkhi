import { Buffer } from "../src/buffer.ts";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("Buffer", () => {
  it("should be empty on construction", () => {
    const buffer = new Buffer();
    assert.equal(buffer.length, 0);
  });

  it("should be filled with given chunks on construction", () => {
    const buffer = new Buffer([new Uint8Array([0x00]), new Uint8Array([0x01, 0x02])]);
    assert.deepEqual(buffer.length, 3);
  });

  it("should peek valid indices", () => {
    const buffer = new Buffer([
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02]),
      new Uint8Array([0x03, 0x04, 0x05]),
      new Uint8Array([0x06, 0x07, 0x08, 0x09]),
    ]);
    assert.equal(buffer.peek(0), 0x00);
    assert.equal(buffer.peek(1), 0x01);
    assert.equal(buffer.peek(3), 0x03);
    assert.equal(buffer.peek(6), 0x06);
  });

  it("should fail for greedy peek request", () => {
    const buffer = new Buffer();
    assert.throws(
      () => buffer.peek(0),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should be okay for empty slice", () => {
    const buffer = new Buffer();
    assert.deepEqual(buffer.slice(0, 0), new Uint8Array(0));
  });

  it("should fail for greedy slice request", () => {
    const buffer = new Buffer();
    assert.throws(
      () => buffer.slice(1, 1),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should slice cleanly on aligned request", () => {
    const buffer = new Buffer([
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02]),
      new Uint8Array([0x03, 0x04, 0x05]),
      new Uint8Array([0x06, 0x07, 0x08, 0x09]),
    ]);
    const slice = buffer.slice(3, 6);
    assert.deepEqual(slice, new Uint8Array([0x03, 0x04, 0x05]));
    assert.deepEqual(buffer.length, 10);
  });

  it("should split and slice on non-aligned request", () => {
    const buffer = new Buffer([
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02]),
      new Uint8Array([0x03, 0x04, 0x05]),
      new Uint8Array([0x06, 0x07, 0x08, 0x09]),
    ]);
    const slice = buffer.slice(2, 7);
    assert.deepEqual(slice, new Uint8Array([0x02, 0x03, 0x04, 0x05, 0x06]));
    assert.deepEqual(buffer.length, 10);
  });

  it("should be okay for empty pop", () => {
    const buffer = new Buffer();
    assert.deepEqual(buffer.pop(0), new Uint8Array(0));
  });

  it("should fail for greedy pop request", () => {
    const buffer = new Buffer();
    assert.throws(
      () => buffer.pop(1),
      (error) => {
        assert(error instanceof Error);
        return true;
      },
    );
  });

  it("should pop cleanly on aligned request", () => {
    const buffer = new Buffer([
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02]),
      new Uint8Array([0x03, 0x04, 0x05]),
      new Uint8Array([0x06, 0x07, 0x08, 0x09]),
    ]);
    const array = buffer.pop(3);
    assert.deepEqual(array, new Uint8Array([0x00, 0x01, 0x02]));
    assert.deepEqual(buffer.length, 7);
  });

  it("should split and pop on non-aligned request", () => {
    const buffer = new Buffer([
      new Uint8Array([0x00]),
      new Uint8Array([0x01, 0x02]),
      new Uint8Array([0x03, 0x04, 0x05]),
      new Uint8Array([0x06, 0x07, 0x08, 0x09]),
    ]);
    const array = buffer.pop(5);
    assert.deepEqual(array, new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]));
    assert.deepEqual(buffer.length, 5);
  });

  it("should respect maximum length", () => {
    const buffer = new Buffer(
      [
        new Uint8Array([0x00]),
        new Uint8Array([0x01, 0x02]),
        new Uint8Array([0x03, 0x04, 0x05]),
        new Uint8Array([0x06, 0x07, 0x08, 0x09]),
      ],
      7,
    );
    assert.deepEqual(buffer.length, 7);
    const array = buffer.pop(7);
    assert.deepEqual(array, new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
    assert.deepEqual(buffer.rejected, [new Uint8Array([0x07, 0x08, 0x09])]);
    assert.ok(buffer.done);
  });
});

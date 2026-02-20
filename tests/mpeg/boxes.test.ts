import { ErrorCode, ParkhiError } from "../../src/error.ts";
import {
  parseBoxes,
  parseChapName,
  parseFtyp,
  parseItem,
  parseMdhd,
  parseMdia,
  parseMinf,
  parseMoov,
  parseStco,
  parseStsc,
  parseStsz,
  parseStts,
  parseStz2,
  parseTkhd,
  parseTrak,
  parseTref,
  parseUdta,
} from "../../src/mpeg/boxes.ts";
import { concat } from "../utils.ts";
import { asciiEncode, makeBox } from "./utils.ts";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("parseBoxes", () => {
  it("should parse data with one box", () => {
    const data = makeBox("abcd", new Uint8Array(16));
    const boxes = parseBoxes(data);

    assert.equal(boxes.length, 1);
    assert.equal(boxes[0]!.type, "abcd");
    assert.deepEqual(boxes[0]!.data, new Uint8Array(16));
  });

  it("should parse data with multiple boxes", () => {
    const box0 = makeBox("abcd", new Uint8Array(16));
    const box1 = makeBox("efgh", new Uint8Array(32));
    const box2 = makeBox("ijkl", new Uint8Array(64));
    const data = concat(box0, box1, box2);
    const boxes = parseBoxes(data);

    assert.equal(boxes.length, 3);
    assert.equal(boxes[0]!.type, "abcd");
    assert.deepEqual(boxes[0]!.data, new Uint8Array(16));
    assert.equal(boxes[1]!.type, "efgh");
    assert.deepEqual(boxes[1]!.data, new Uint8Array(32));
    assert.equal(boxes[2]!.type, "ijkl");
    assert.deepEqual(boxes[2]!.data, new Uint8Array(64));
  });

  it("should parse data with nested boxes", () => {
    const box0 = makeBox("abcd", new Uint8Array(16));
    const subBox0 = makeBox("bx10", new Uint8Array(4));
    const subBox1 = makeBox("bx11", new Uint8Array(8));
    const box1 = makeBox("efgh", subBox0, subBox1);
    const subBox2 = makeBox("bx20", new Uint8Array(16));
    const subBox3 = makeBox("bx20", new Uint8Array(32));
    const box2 = makeBox("ijkl", subBox2, subBox3);
    const data = concat(box0, box1, box2);
    const boxes = parseBoxes(data);

    assert.equal(boxes.length, 3);
    assert.equal(boxes[0]!.type, "abcd");
    assert.deepEqual(boxes[0]!.data, new Uint8Array(16));
    assert.equal(boxes[1]!.type, "efgh");
    assert.deepEqual(boxes[1]!.data, concat(subBox0, subBox1));
    assert.equal(boxes[2]!.type, "ijkl");
    assert.deepEqual(boxes[2]!.data, concat(subBox2, subBox3));
  });

  it("should parse box with size field 0", () => {
    const box0 = makeBox("abcd", new Uint8Array(16));
    const box1 = makeBox("efgh", new Uint8Array(32));
    const box2 = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      ...asciiEncode("ijkl"),
      ...new Uint8Array(64),
    ]);
    const data = concat(box0, box1, box2);
    const boxes = parseBoxes(data);

    assert.equal(boxes[0]!.type, "abcd");
    assert.deepEqual(boxes[0]!.data, new Uint8Array(16));
    assert.equal(boxes[1]!.type, "efgh");
    assert.deepEqual(boxes[1]!.data, new Uint8Array(32));
    assert.equal(boxes[2]!.type, "ijkl");
    assert.deepEqual(boxes[2]!.data, new Uint8Array(64));
  });

  it("should fail for box with extended size", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    assert.throws(
      () => parseBoxes(data),
      (error) => {
        assert(error instanceof ParkhiError);
        assert.equal(error.code, ErrorCode.Unknown);
        return true;
      },
    );
  });
});

describe("parseFtyp", () => {
  it("should be okay for valid data", () => {
    const data = asciiEncode("M4A\x00");
    const brand = parseFtyp(data);

    assert.equal(brand, "M4A\x00");
  });
});

describe("parseStsc", () => {
  it("shold be okay for valid data", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x04, // Entry count: 4.
      0x00, 0x00, 0x00, 0x01, // Entry 1: first chunk.
      0x00, 0x00, 0x00, 0x01, // Entry 1: samples per chunk.
      0x00, 0x00, 0x00, 0x01, // Entry 1: sample description index.
      0x00, 0x00, 0x00, 0x03, // Entry 2: first chunk.
      0x00, 0x00, 0x00, 0x02, // Entry 2: samples per chunk.
      0x00, 0x00, 0x00, 0x01, // Entry 2: sample description index.
      0x00, 0x00, 0x00, 0x08, // Entry 3: first chunk.
      0x00, 0x00, 0x00, 0x01, // Entry 3: samples per chunk.
      0x00, 0x00, 0x00, 0x01, // Entry 3: sample description index.
      0x00, 0x00, 0x00, 0x0f, // Entry 4: first chunk.
      0x00, 0x00, 0x00, 0x05, // Entry 4: samples per chunk.
      0x00, 0x00, 0x00, 0x01  // Entry 4: sample description index.
    ]);
    const chunksCount = 15;
    const indices = parseStsc(data, chunksCount);

    assert.deepEqual(indices, [0, 1, 2, 4, 6, 8, 10, 12, 13, 14, 15, 16, 17, 18, 19, 24]);
  });
});

describe("parseStco", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x0f, // Entry count: 15.
      0x00, 0x00, 0x00, 0x64, // Chunk 1 offset: 100.
      0x00, 0x00, 0x00, 0xc8, // Chunk 2 offset: 200.
      0x00, 0x00, 0x01, 0x2c, // Chunk 3 offset: 300.
      0x00, 0x00, 0x01, 0x90, // Chunk 4 offset: 400.
      0x00, 0x00, 0x01, 0xf4, // Chunk 5 offset: 500.
      0x00, 0x00, 0x02, 0x58, // Chunk 6 offset: 600.
      0x00, 0x00, 0x02, 0xbc, // Chunk 7 offset: 700.
      0x00, 0x00, 0x03, 0x20, // Chunk 8 offset: 800.
      0x00, 0x00, 0x03, 0x84, // Chunk 9 offset: 900.
      0x00, 0x00, 0x03, 0xe8, // Chunk 10 offset: 1000.
      0x00, 0x00, 0x04, 0x4c, // Chunk 11 offset: 1100.
      0x00, 0x00, 0x04, 0xb0, // Chunk 12 offset: 1200.
      0x00, 0x00, 0x05, 0x14, // Chunk 13 offset: 1300.
      0x00, 0x00, 0x05, 0x78, // Chunk 14 offset: 1400.
      0x00, 0x00, 0x05, 0xdc  // Chunk 15 offset: 1500.
    ]);
    const offsets = parseStco(data);

    assert.deepEqual(
      offsets,
      [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500],
    );
  });
});

describe("parseStz2", () => {
  it("should be okay for valid data with field size 4", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x04, // Reserved and field size.
      0x00, 0x00, 0x00, 0x04, // Sample count.
      0x5a, // Sample 1: 5 and 2: 10.
      0xf3, // Sample 3: 15 and 4: 3.
    ]);
    const sizes = parseStz2(data);

    assert.deepEqual(sizes, [5, 10, 15, 3]);
  });

  it("should be okay for valid data with field size 8", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x08, // Reserved and field size.
      0x00, 0x00, 0x00, 0x04, // Sample count.
      0x0a,
      0x14,
      0x1e,
      0x28,
    ]);
    const sizes = parseStz2(data);

    assert.deepEqual(sizes, [10, 20, 30, 40]);
  });

  it("should be okay for valid data with field size 16", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x10, // Reserved and field size.
      0x00, 0x00, 0x00, 0x04, // Sample count.
      0x03, 0xe8,
      0x07, 0xd0,
      0x0b, 0xb8,
      0x0f, 0xa0,
    ]);
    const sizes = parseStz2(data);

    assert.deepEqual(sizes, [1000, 2000, 3000, 4000]);
  });
});

describe("parseStsz", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const data =  new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x00, // Sample size: variable.
      0x00, 0x00, 0x00, 0x04, // Sample count: 4.
      0x00, 0x00, 0x00, 0x64, // Sample 1 size.
      0x00, 0x00, 0x00, 0xc8, // Sample 2 size.
      0x00, 0x00, 0x01, 0x2c, // Sample 3 size.
      0x00, 0x00, 0x01, 0x90  // Sample 4 size.
    ]);
    const sizes = parseStsz(data);

    assert.deepEqual(sizes, [100, 200, 300, 400]);
  });
});

describe("parseStts", () => {
  it("should be okay for valid stts", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version and flags.
      0x00, 0x00, 0x00, 0x02, // Entry count: 2.
      0x00, 0x00, 0x00, 0x02, // Entry 1 count: 2 samples.
      0x00, 0x00, 0x01, 0x2c, // Entry 1 delta: 300 ticks.
      0x00, 0x00, 0x00, 0x02, // Entry 2 count: 2 samples.
      0x00, 0x00, 0x01, 0xf4  // Entry 2 delta: 500 ticks.
    ]);
    const timescale = 100;
    const positions = parseStts(data, timescale);

    assert.deepEqual(positions, [0, 3, 6, 11]);
  });
});

describe("parseMinf", () => {
  it("should be okay for valid minf", () => {
    // prettier-ignore
    const stts = makeBox("stts", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 entries.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4, // 1 sample, duration 500.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03, 0xe8, // 1 sample, duration 1000.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4  // 1 sample, duration 500.
    ]));

    // prettier-ignore
    const stsz = makeBox("stsz", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, // Global size: variable.
      0x00, 0x00, 0x00, 0x03, // 3 sample sizes.
      0x00, 0x00, 0x00, 0x08, // Chapter 1: 8 bytes.
      0x00, 0x00, 0x00, 0x0c, // Chapter 2: 12 bytes.
      0x00, 0x00, 0x00, 0x08  // Chapter 3: 8 bytes.
    ]));

    // prettier-ignore
    const stsc = makeBox("stsc", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 anf flags.
      0x00, 0x00, 0x00, 0x01, // 1 entry in the table.
      0x00, 0x00, 0x00, 0x01, // First chunk 1.
      0x00, 0x00, 0x00, 0x01, // 1 sample per chunk.
      0x00, 0x00, 0x00, 0x01, // Sample description index.
    ]));

    // prettier-ignore
    const stco = makeBox("stco", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 offsets.
      0x00, 0x00, 0x13, 0x88, // Offset 5000.
      0x00, 0x00, 0x13, 0x90, // Offset 5008.
      0x00, 0x00, 0x13, 0x9c  // Offset 5020.
    ]));

    const data = makeBox("stbl", stts, stsz, stsc, stco);
    const timescale = 100;
    const chapters = parseMinf(data, timescale);

    assert.deepEqual(chapters, [
      {
        nameBegin: 5000,
        nameEnd: 5008,
        position: 0,
      },
      {
        nameBegin: 5008,
        nameEnd: 5020,
        position: 5,
      },
      {
        nameBegin: 5020,
        nameEnd: 5028,
        position: 15,
      },
    ]);
  });
});

describe("parseMdhd", () => {
  it("should be okay for valid data with version 0", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x64, // Timescale: 100.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);
    const timescale = parseMdhd(data);

    assert.equal(timescale, 100);
  });

  it("should be okay for valid data with version 1", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x01, 0x00, 0x00, 0x00, // Version 1 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03, 0xe8, // Timescale: 1000.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const timescale = parseMdhd(data);

    assert.equal(timescale, 1000);
  });
});

describe("parseMdia", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const mdhd = makeBox("mdhd", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x64, // Timescale: 100.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]));

    // prettier-ignore
    const stts = makeBox("stts", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 entries.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4, // 1 sample, duration 500.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03, 0xe8, // 1 sample, duration 1000.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4  // 1 sample, duration 500.
    ]));

    // prettier-ignore
    const stsz = makeBox("stsz", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, // Global size: variable.
      0x00, 0x00, 0x00, 0x03, // 3 sample sizes.
      0x00, 0x00, 0x00, 0x08, // Chapter 1: 8 bytes.
      0x00, 0x00, 0x00, 0x0c, // Chapter 2: 12 bytes.
      0x00, 0x00, 0x00, 0x08  // Chapter 3: 8 bytes.
    ]));

    // prettier-ignore
    const stsc = makeBox("stsc", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 anf flags.
      0x00, 0x00, 0x00, 0x01, // 1 entry in the table.
      0x00, 0x00, 0x00, 0x01, // First chunk 1.
      0x00, 0x00, 0x00, 0x01, // 1 sample per chunk.
      0x00, 0x00, 0x00, 0x01, // Sample description index.
    ]));

    // prettier-ignore
    const stco = makeBox("stco", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 offsets.
      0x00, 0x00, 0x13, 0x88, // Offset 5000.
      0x00, 0x00, 0x13, 0x90, // Offset 5008.
      0x00, 0x00, 0x13, 0x9c  // Offset 5020.
    ]));

    const stbl = makeBox("stbl", stts, stsz, stsc, stco);
    const minf = makeBox("minf", stbl);
    const data = concat(mdhd, minf);
    const chapters = parseMdia(data);

    assert.deepEqual(chapters, [
      {
        nameBegin: 5000,
        nameEnd: 5008,
        position: 0,
      },
      {
        nameBegin: 5008,
        nameEnd: 5020,
        position: 5,
      },
      {
        nameBegin: 5020,
        nameEnd: 5028,
        position: 15,
      },
    ]);
  });
});

describe("parseItem", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const data = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Type: UTF-8.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x48, 0x65, 0x6c, 0x6c, 0x6f, // Value: "Hello".
    ]));
    const udta = { authors: [], cover: null, name: null };
    parseItem("©nam", data, udta);

    assert.equal(udta.name, "Hello");
  });
});

describe("parseUdta", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const nameData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Type: UTF-8.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x42, 0x6f, 0x6f, 0x6b, // Value: "Book".
    ]));
    const nameBox = makeBox("©nam", nameData);

    // prettier-ignore
    const authorData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Type: UTF-8.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x4a, 0x6f, 0x68, 0x6e, // Value: "John".
    ]));
    const authorBox = makeBox("©ART", authorData);

    // prettier-ignore
    const coverData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x0e, // Type: PNG.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x89, 0x50, 0x4e, 0x47, // Value: PNG data.
    ]));
    const coverBox = makeBox("covr", coverData);

    const ilst = makeBox("ilst", nameBox, authorBox, coverBox);
    const data = makeBox("meta", new Uint8Array([0x00, 0x00, 0x00, 0x00]), ilst);
    const udta = parseUdta(data);

    assert.deepEqual(udta.authors, ["John"]);
    assert.equal(udta.name, "Book");
    assert.deepEqual(
      udta.cover,
      new Blob([new Uint8Array([0x89, 0x50, 0x43, 0x47])], { type: "image/png" }),
    );
  });
});

describe("parseTref", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const data = makeBox("chap", new Uint8Array([
      0x00, 0x00, 0x00, 0x02, // Track ID: 2
    ]));
    const trefs = parseTref(data);

    assert.deepEqual(trefs, [{ type: "chap", ids: [2] }]);
  });
});

describe("parseTkhd", () => {
  it("should be okay for valid data with version 0", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x01,  // Track ID: 1
    ]);
    const id = parseTkhd(data);

    assert.equal(id, 1);
  });

  it("should be okay for valid data with version 1", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x01, 0x00, 0x00, 0x01, // Version 1 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x02  // Track ID: 2
    ]);
    const id = parseTkhd(data);

    assert.equal(id, 2);
  });
});

describe("parseTrak", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const tkhd = makeBox("tkhd", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x01,  // Track ID: 1
    ]));
    // prettier-ignore
    const trefData = makeBox("chap", new Uint8Array([
      0x00, 0x00, 0x00, 0x02, // Track ID: 2
    ]));
    const tref = makeBox("tref", trefData);
    const mdia = makeBox("mdia", new Uint8Array([0x00, 0x01, 0x02]));
    const data = concat(tkhd, tref, mdia);
    const tracks = parseTrak(data);

    assert.deepEqual(tracks, {
      id: 1,
      trefs: [{ type: "chap", ids: [2] }],
      mdia: new Uint8Array([0x00, 0x01, 0x02]),
    });
  });
});

describe("parseMoov", () => {
  it("should be okay for valid data", () => {
    // prettier-ignore
    const tkhd1 = makeBox("tkhd", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x01,  // Track ID: 1
    ]));

    // prettier-ignore
    const trefData = makeBox("chap", new Uint8Array([
      0x00, 0x00, 0x00, 0x02, // Track ID: 2
    ]));
    const tref = makeBox("tref", trefData);

    const mdia1 = makeBox("mdia", new Uint8Array([0x00, 0x01, 0x02]));
    const trak1 = makeBox("trak", tkhd1, tref, mdia1);

    // prettier-ignore
    const tkhd2 = makeBox("tkhd", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x02,  // Track ID: 2
    ]));

    // prettier-ignore
    const mdhd = makeBox("mdhd", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x64, // Timescale: 100.
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]));

    // prettier-ignore
    const stts = makeBox("stts", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 entries.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4, // 1 sample, duration 500.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03, 0xe8, // 1 sample, duration 1000.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xf4  // 1 sample, duration 500.
    ]));

    // prettier-ignore
    const stsz = makeBox("stsz", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x00, // Global size: variable.
      0x00, 0x00, 0x00, 0x03, // 3 sample sizes.
      0x00, 0x00, 0x00, 0x08, // Chapter 1: 8 bytes.
      0x00, 0x00, 0x00, 0x0c, // Chapter 2: 12 bytes.
      0x00, 0x00, 0x00, 0x08  // Chapter 3: 8 bytes.
    ]));

    // prettier-ignore
    const stsc = makeBox("stsc", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 anf flags.
      0x00, 0x00, 0x00, 0x01, // 1 entry in the table.
      0x00, 0x00, 0x00, 0x01, // First chunk 1.
      0x00, 0x00, 0x00, 0x01, // 1 sample per chunk.
      0x00, 0x00, 0x00, 0x01, // Sample description index.
    ]));

    // prettier-ignore
    const stco = makeBox("stco", new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Version 0 and flags.
      0x00, 0x00, 0x00, 0x03, // 3 offsets.
      0x00, 0x00, 0x13, 0x88, // Offset 5000.
      0x00, 0x00, 0x13, 0x90, // Offset 5008.
      0x00, 0x00, 0x13, 0x9c  // Offset 5020.
    ]));

    const stbl = makeBox("stbl", stts, stsz, stsc, stco);
    const minf = makeBox("minf", stbl);
    const mdia2 = makeBox("mdia", mdhd, minf);

    const trak2 = makeBox("trak", tkhd2, mdia2);

    // prettier-ignore
    const nameData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Type: UTF-8.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x42, 0x6f, 0x6f, 0x6b, // Value: "Book".
    ]));
    const nameBox = makeBox("©nam", nameData);

    // prettier-ignore
    const authorData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x01, // Type: UTF-8.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x4a, 0x6f, 0x68, 0x6e, // Value: "John".
    ]));
    const authorBox = makeBox("©ART", authorData);

    // prettier-ignore
    const coverData = makeBox("data", new Uint8Array([
      0x00, 0x00, 0x00, 0x0e, // Type: PNG.
      0x00, 0x00, 0x00, 0x00, // Locale: default.
      0x89, 0x50, 0x4e, 0x47, // Value: PNG data.
    ]));
    const coverBox = makeBox("covr", coverData);

    const ilst = makeBox("ilst", nameBox, authorBox, coverBox);
    const meta = makeBox("meta", new Uint8Array([0x00, 0x00, 0x00, 0x00]), ilst);
    const udta = makeBox("udta", meta);

    const data = concat(trak1, trak2, udta);
    const moov = parseMoov(data);

    assert.deepEqual(moov.chaps, [
      {
        nameBegin: 5000,
        nameEnd: 5008,
        position: 0x00,
      },
      {
        nameBegin: 5008,
        nameEnd: 5020,
        position: 0x05,
      },
      {
        nameBegin: 5020,
        nameEnd: 5028,
        position: 0x0f,
      },
    ]);
    assert.deepEqual(moov.udta!.authors, ["John"]);
    assert.equal(moov.udta!.name, "Book");
    assert.deepEqual(
      moov.udta!.cover,
      new Blob([new Uint8Array([0x89, 0x50, 0x43, 0x47])], { type: "image/png" }),
    );
  });
});

describe("parseChapName", () => {
  it("should be okay for valid data with UTF-8", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x03, // Length: 3
      0x46, 0x6f, 0x6f, // "Foo"
    ]);
    const name = parseChapName(data);

    assert.equal(name, "Foo");
  });

  it("should be okay for valid data with UTF-16", () => {
    // prettier-ignore
    const data = new Uint8Array([
      0x00, 0x08, // Length: 8
      0xfe, 0xff, 0x00, 0x42, 0x00, 0x61, 0x00, 0x72, // "Bar"
    ]);
    const name = parseChapName(data);

    assert.equal(name, "Bar");
  });
});

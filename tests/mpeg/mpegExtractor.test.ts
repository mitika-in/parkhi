import { MpegExtractor } from "../../src/mpeg/mpegExtractor.ts";
import { concat } from "../utils.ts";
import { asciiEncode, makeBox } from "./utils.ts";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const ftyp = makeBox("ftyp", asciiEncode("M4A\x00"));

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
  0x00, 0x00, 0x00, 0x06, // Chapter 1: 6 bytes.
  0x00, 0x00, 0x00, 0x08, // Chapter 2: 8 bytes.
  0x00, 0x00, 0x00, 0x0a  // Chapter 3: 10 bytes.
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
  0x00, 0x00, 0x01, 0xae, // Offset 430.
  0x00, 0x00, 0x01, 0xc2, // Offset 450.
  0x00, 0x00, 0x01, 0xd6  // Offset 470.
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

const moovData = concat(trak1, trak2, udta);
const moov = makeBox("moov", moovData);

const mdat = makeBox("mdat", new Uint8Array(200));

const data = concat(ftyp, moov, mdat);

const UTF8 = new TextEncoder();
const chapter1 = concat(new Uint8Array([0x00, 0x04]), UTF8.encode("ABCD"));
const chapter2 = concat(new Uint8Array([0x00, 0x06]), UTF8.encode("EFGHIJ"));
const chapter3 = concat(new Uint8Array([0x00, 0x08]), UTF8.encode("KLMNOPQR"));
data.set(chapter1, 0x1ae);
data.set(chapter2, 0x1c2);
data.set(chapter3, 0x1d6);

const metadata = {
  type: "MPEG",
  name: "Book",
  authors: ["John"],
  cover: new Blob([new Uint8Array([0x89, 0x50, 0x43, 0x47])], { type: "image/png" }),
  chapters: [
    { name: "ABCD", position: 0x00, children: [] },
    { name: "EFGHIJ", position: 0x05, children: [] },
    { name: "KLMNOPQR", position: 0x0f, children: [] },
  ],
};

describe("MpegExtractor", () => {
  it("should parse data in byte by byte feeding", async () => {
    const extractor = new MpegExtractor();

    const source = new Uint8Array(data);
    for (let i = 0; i < source.length; i++) {
      const chunk = source.slice(i, i + 1);
      const done = await extractor.feed(chunk);
      assert.ok(!done);
    }
    const done = await extractor.feed(null);
    assert.ok(done);

    const actualMetadata = await extractor.getMetadata();
    assert.deepEqual(actualMetadata, metadata);
  });

  it("should parse data in single feeding", async () => {
    const extractor = new MpegExtractor();
    let done = await extractor.feed(new Uint8Array(data));
    assert.ok(!done);
    done = await extractor.feed(null);
    assert.ok(done);

    const actualMetadata = await extractor.getMetadata();
    assert.deepEqual(actualMetadata, metadata);
  });
});

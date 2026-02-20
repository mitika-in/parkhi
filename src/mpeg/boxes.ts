import { ErrorCode, ParkhiError } from "../error.ts";
import { warn } from "../logging.ts";
import { parseU32 } from "../utils.ts";

export enum BoxType {
  Chap = "chap",
  Co64 = "co64",
  Data = "data",
  Ftyp = "ftyp",
  Hdlr = "hdlr",
  Ilst = "ilst",
  Mdhd = "mdhd",
  Mdia = "mdia",
  Meta = "meta",
  Minf = "minf",
  Moov = "moov",
  Stbl = "stbl",
  Stco = "stco",
  Stsc = "stsc",
  Stsz = "stsz",
  Stts = "stts",
  Stz2 = "stz2",
  Tkhd = "tkhd",
  Trak = "trak",
  Tref = "tref",
  Udta = "udta",
}

export interface Box {
  type: string;
  data: Uint8Array;
}

export const LATIN1 = new TextDecoder("latin1", { fatal: true });
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const UTF16BE = new TextDecoder("utf-16be", { fatal: true });
const UTF16LE = new TextDecoder("utf-16le", { fatal: true });

function throwLengthMismatchError(
  component: string,
  part: string,
  expected: number | string,
  actual: number,
) {
  throw new ParkhiError(
    ErrorCode.Corrupt,
    `${component}'s ${part} length (${actual}) is smaller than expected (${expected})`,
  );
}

export function parseBoxes(data: Uint8Array): Box[] {
  const boxes = [];

  let cursor = 0;
  while (cursor < data.length) {
    if (data.length - cursor < 8)
      throwLengthMismatchError("box", "header", 8, data.length - cursor);

    let [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
    const size = parseU32(b0!, b1!, b2!, b3!);
    if (size == 1)
      throw new ParkhiError(ErrorCode.Unknown, "boxes with extended size are not supported");
    const dataSize = size - 4 - 4;
    cursor += 4;

    const type = LATIN1.decode(data.subarray(cursor, cursor + 4));
    cursor += 4;

    if (data.length - cursor < dataSize)
      throwLengthMismatchError("box", "data", dataSize, data.length - cursor);

    let boxData;
    if (size == 0) {
      boxData = data.subarray(cursor);
      cursor = data.length;
    } else {
      boxData = data.subarray(cursor, cursor + dataSize);
      cursor += dataSize;
    }
    boxes.push({ type, data: boxData });
  }

  return boxes;
}

export function parseFtyp(data: Uint8Array): string {
  if (data.length < 4) throwLengthMismatchError("ftyp", "data", 4, data.length);

  const brand = LATIN1.decode(data.subarray(0, 4));

  return brand;
}

export class UnknownVersion extends Error {
  constructor(
    readonly type: string,
    readonly version: number,
  ) {
    super();
  }
}

function handleUnknownVersion(block: () => void) {
  try {
    block();
  } catch (error) {
    if (error instanceof UnknownVersion)
      warn(`${error.type} has unknown version ${error.version}; skipping`);
    else throw error;
  }
}

export function parseStsc(data: Uint8Array, chunksCount: number): number[] {
  // indices[i] = index of sample that starts at chunk i.
  // indices[chunksCount] = total samples count.
  // Both i and sample index are 0 based.
  const indices = [];

  let cursor = 0;

  if (data.length - cursor < 8) throwLengthMismatchError("stsc", "data", 8, data.length);

  const version = data[cursor];
  if (version != 0) throw new UnknownVersion("stsc", version!);
  cursor += 4;

  const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
  const entryCount = parseU32(b0!, b1!, b2!, b3!);
  cursor += 4;

  if (data.length - cursor != entryCount * (4 + 4 + 4))
    throwLengthMismatchError("stsc", "data", entryCount * (4 + 4 + 4), data.length - cursor);

  let lastFirstChunk = 1;
  let lastSamplesPerChunk = 0;
  let currentSample = 0;
  for (cursor; cursor != data.length; cursor += 4 + 4 + 4) {
    const [f0, f1, f2, f3] = data.subarray(cursor, cursor + 4);
    const firstChunk = parseU32(f0!, f1!, f2!, f3!);
    const [s0, s1, s2, s3] = data.subarray(cursor + 4, cursor + 4 + 4);
    const samplesPerChunk = parseU32(s0!, s1!, s2!, s3!);

    const count = firstChunk - lastFirstChunk;
    for (let i = 0; i < count; i++) {
      indices.push(currentSample);
      currentSample += lastSamplesPerChunk;
    }
    lastFirstChunk = firstChunk;
    lastSamplesPerChunk = samplesPerChunk;
  }
  const count = chunksCount + 1 - lastFirstChunk;
  for (let i = 0; i < count; i++) {
    indices.push(currentSample);
    currentSample += lastSamplesPerChunk;
  }
  indices.push(currentSample);

  return indices;
}

export function parseStco(data: Uint8Array): number[] {
  const offsets = [];

  let cursor = 0;

  if (data.length - cursor < 8) throwLengthMismatchError("stco", "data", 8, data.length);

  const version = data[cursor];
  if (version != 0) throw new UnknownVersion("stco", version!);
  cursor += 4;

  const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
  const entryCount = parseU32(b0!, b1!, b2!, b3!);
  cursor += 4;

  if (data.length - cursor != entryCount * 4)
    throwLengthMismatchError("stco", "data", entryCount * 4, data.length - cursor);

  for (cursor; cursor < data.length; cursor += 4) {
    const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
    const offset = parseU32(b0!, b1!, b2!, b3!);
    offsets.push(offset);
  }

  return offsets;
}

export function parseStz2(data: Uint8Array): number[] {
  const sizes = [];

  let cursor = 0;

  if (data.length - cursor < 12) throwLengthMismatchError("stz2", "data", 12, data.length);

  const version = data[cursor];
  if (version != 0) throw new UnknownVersion("stz2", version!);
  cursor += 4;

  cursor += 3;

  const fieldSize = data[cursor]!;
  cursor += 1;

  const [c0, c1, c2, c3] = data.subarray(cursor, cursor + 4);
  const sampleCount = parseU32(c0!, c1!, c2!, c3!);
  cursor += 4;

  if (data.length - cursor != (sampleCount * fieldSize) / 8)
    throwLengthMismatchError("stz2", "data", (sampleCount * fieldSize) / 8, data.length - cursor);

  if (![4, 8, 16].includes(fieldSize))
    throw new ParkhiError(ErrorCode.Corrupt, `unknown fieldSize ${fieldSize}`);

  let stepSize = 1;
  if (fieldSize == 16) stepSize = 2;

  for (cursor; cursor != data.length; cursor += stepSize) {
    const [b0, b1] = data.subarray(cursor, cursor + stepSize);
    if (fieldSize == 4) {
      const s1 = b0! >> 4;
      const s2 = b0! & 0b00001111;
      sizes.push(s1);
      sizes.push(s2);
    } else if (fieldSize == 8) {
      sizes.push(b0!);
    } else {
      const s1 = parseU32(0, 0, b0!, b1!);
      sizes.push(s1);
    }
  }

  return sizes;
}

export function parseStsz(data: Uint8Array): number[] {
  const sizes = [];

  let cursor = 0;

  if (data.length - cursor < 12) throwLengthMismatchError("stsz", "data", 12, data.length);

  const version = data[cursor];
  if (version != 0) throw new UnknownVersion("stsz", version!);
  cursor += 4;

  const [s0, s1, s2, s3] = data.subarray(cursor, cursor + 4);
  const sampleSize = parseU32(s0!, s1!, s2!, s3!);
  cursor += 4;

  const [c0, c1, c2, c3] = data.subarray(cursor, cursor + 4);
  const sampleCount = parseU32(c0!, c1!, c2!, c3!);
  cursor += 4;

  if (sampleSize != 0) {
    for (let i = 0; i < sampleCount; i++) sizes.push(sampleSize);
  } else {
    if (data.length - cursor != sampleCount * 4)
      throwLengthMismatchError("stsz", "data", sampleCount * 4, data.length - cursor);

    for (cursor; cursor != data.length; cursor += 4) {
      const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
      const size = parseU32(b0!, b1!, b2!, b3!);
      sizes.push(size);
    }
  }

  return sizes;
}

export function parseStts(data: Uint8Array, timescale: number): number[] {
  // positions[i] = starting position of sample i in seconds.
  // Sample index is 0 based.
  const positions = [];

  let cursor = 0;

  if (data.length - cursor < 8) throwLengthMismatchError("stts", "data", 8, data.length);

  const version = data[cursor];
  if (version != 0) throw new UnknownVersion("stts", version!);
  cursor += 4;

  const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
  const entryCount = parseU32(b0!, b1!, b2!, b3!);
  cursor += 4;

  if (data.length - cursor != entryCount * (4 + 4))
    throwLengthMismatchError("stts", "data", entryCount * (4 + 4), data.length - cursor);

  let currentTime = 0;
  for (cursor; cursor != data.length; cursor += 4 + 4) {
    const [c0, c1, c2, c3] = data.subarray(cursor, cursor + 4);
    const count = parseU32(c0!, c1!, c2!, c3!);
    const [d0, d1, d2, d3] = data.subarray(cursor + 4, cursor + 8);
    const delta = parseU32(d0!, d1!, d2!, d3!);

    for (let i = 0; i < count; i++) {
      positions.push(currentTime / timescale);
      currentTime += delta;
    }
  }

  return positions;
}

export interface Chap {
  nameBegin: number;
  nameEnd: number;
  position: number;
}

export function parseMinf(data: Uint8Array, timescale: number): Chap[] {
  const stbl = parseBoxes(data).find((box) => box.type == BoxType.Stbl);
  if (!stbl) throw new ParkhiError(ErrorCode.Corrupt, "stbl not found");

  let stts;
  let stsz;
  let stz2;
  let stco;
  let co64;
  let stsc;

  const boxes = parseBoxes(stbl.data);
  for (const box of boxes) {
    if (box.type == BoxType.Stts) stts = box.data;
    else if (box.type == BoxType.Stsz) stsz = box.data;
    else if (box.type == BoxType.Stz2) stz2 = box.data;
    else if (box.type == BoxType.Stco) stco = box.data;
    else if (box.type == BoxType.Co64) co64 = box.data;
    else if (box.type == BoxType.Stsc) stsc = box.data;
  }

  if (!stts) throw new ParkhiError(ErrorCode.Corrupt, "stts not found");
  const positions = parseStts(stts, timescale);

  let sizes;
  if (stsz) sizes = parseStsz(stsz);
  else if (stz2) sizes = parseStz2(stz2);
  else throw new ParkhiError(ErrorCode.Corrupt, "neither stsz nor stz2 was found");

  let offsets;
  if (stco) offsets = parseStco(stco);
  else if (co64) throw new ParkhiError(ErrorCode.Unknown, "co64 offsets are not supported");
  else throw new ParkhiError(ErrorCode.Corrupt, "neither stco nor co64 was found");

  if (!stsc) throw new ParkhiError(ErrorCode.Corrupt, "stsc not found");
  const indices = parseStsc(stsc, offsets.length);

  const chaps = [];

  for (let chunkIdx = 0; chunkIdx < indices.length - 1; chunkIdx++) {
    let offset = offsets[chunkIdx]!;
    let chapIdx = indices[chunkIdx]!;
    const chapEndIdx = indices[chunkIdx + 1]!;
    for (chapIdx; chapIdx < chapEndIdx; chapIdx++) {
      chaps.push({
        nameBegin: offset,
        nameEnd: offset + sizes[chapIdx]!,
        position: positions[chapIdx]!,
      });
      offset += sizes[chapIdx]!;
    }
  }

  return chaps;
}

export function parseMdhd(data: Uint8Array): number {
  let cursor = 0;

  if (data.length - cursor < 8) throwLengthMismatchError("mdhd", "data", 8, data.length);

  const version = data[cursor];
  if (version == 1) cursor += 8 + 8;
  else if (version == 0) cursor += 4 + 4;
  else throw new UnknownVersion("mdhd", version!);
  cursor += 4;

  if (data.length - cursor < 8) throwLengthMismatchError("mdhd", "data", 8, data.length - cursor);

  const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
  const timescale = parseU32(b0!, b1!, b2!, b3!);

  return timescale;
}

export function parseMdia(data: Uint8Array): Chap[] {
  let mdhd;
  let minf;

  const boxes = parseBoxes(data);
  for (const box of boxes) {
    if (box.type == BoxType.Mdhd) mdhd = box.data;
    else if (box.type == BoxType.Minf) minf = box.data;
  }

  if (!mdhd) throw new ParkhiError(ErrorCode.Corrupt, "mdhd not found");
  if (!minf) throw new ParkhiError(ErrorCode.Corrupt, "minf not found");

  const timescale = parseMdhd(mdhd);
  const chaps = parseMinf(minf, timescale);

  return chaps;
}

export interface Udta {
  authors: string[];
  cover: Blob | null;
  name: string | null;
}

enum ItemType {
  Name = "©nam",
  Author = "©ART",
  Cover = "covr",
}

enum LocaleType {
  Default = 0,
}

enum DataType {
  Implicit = 0,
  Utf8 = 1,
  Utf16 = 2,
  Jpeg = 13,
  Png = 14,
}

export function parseItem(type: string, data: Uint8Array, udta: Udta) {
  if (!Object.values(ItemType).includes(type as ItemType)) return;

  const [box] = parseBoxes(data);
  if (!box || box.type != BoxType.Data)
    throw new ParkhiError(ErrorCode.Corrupt, `ilst item ${type} has no data boxes`);

  if (box.data.length < 9) throwLengthMismatchError("ilst", "data", ">= 8", box.data.length);

  const dataType = parseU32(box.data[0]!, box.data[1]!, box.data[2]!, box.data[3]!);
  if (!Object.values(DataType).includes(dataType as DataType)) return;

  const locale = parseU32(box.data[4]!, box.data[5]!, box.data[6]!, box.data[7]!);
  if (locale != LocaleType.Default) return;

  let value;
  if (dataType == DataType.Utf8) {
    value = UTF8.decode(box.data.subarray(8));
  } else if (dataType == DataType.Utf16) {
    value = UTF16BE.decode(box.data.subarray(8));
  } else {
    let mime = "";
    if (dataType == DataType.Jpeg) mime = "image/jpeg";
    else if (dataType == DataType.Png) mime = "image/png";
    value = new Blob([box.data.subarray(8) as Uint8Array<ArrayBuffer>], { type: mime });
  }

  if (type == ItemType.Author) udta.authors.push(value as string);
  else if (type == ItemType.Cover) udta.cover = value as Blob;
  else if (type == ItemType.Name) udta.name = value as string;
}

export function parseUdta(data: Uint8Array): Udta {
  const udta = {
    authors: [],
    cover: null,
    name: null,
  };

  let boxes = parseBoxes(data);
  const meta = boxes.find((box) => box.type == BoxType.Meta);
  if (!meta) return udta;
  const version = meta.data[0];
  if (version != 0) throw new UnknownVersion("meta", version!);

  boxes = parseBoxes(meta.data.subarray(4));
  const ilst = boxes.find((box) => box.type == BoxType.Ilst);
  if (!ilst) return udta;

  boxes = parseBoxes(ilst.data);
  for (const box of boxes) parseItem(box.type, box.data, udta);

  return udta;
}

export interface Tref {
  type: string;
  ids: number[];
}

export function parseTref(data: Uint8Array): Tref[] {
  const trefs = [];

  const boxes = parseBoxes(data);
  for (const box of boxes) {
    if (box.data.length % 4 != 0) throwLengthMismatchError("tref", "data", "% 4", data.length);

    const ids = [];
    for (let cursor = 0; cursor < box.data.length; cursor += 4) {
      const [b0, b1, b2, b3] = box.data.subarray(cursor, cursor + 4);
      const id = parseU32(b0!, b1!, b2!, b3!);
      ids.push(id);
    }

    trefs.push({ type: box.type, ids });
  }

  return trefs;
}

export function parseTkhd(data: Uint8Array): number {
  let cursor = 0;

  if (data.length - cursor < 4) throwLengthMismatchError("tkhd", "data", 4, data.length);

  const version = data[cursor];
  if (version == 1) cursor += 8 + 8;
  else if (version == 0) cursor += 4 + 4;
  else throw new UnknownVersion("tkhd", version!);
  cursor += 4;

  if (data.length - cursor < 4) throwLengthMismatchError("tkhd", "data", 4, data.length - cursor);

  const [b0, b1, b2, b3] = data.subarray(cursor, cursor + 4);
  const id = parseU32(b0!, b1!, b2!, b3!);

  return id;
}

export interface Trak {
  id: number;
  mdia: Uint8Array;
  trefs: Tref[];
}

export function parseTrak(data: Uint8Array): Trak {
  let id;
  let mdia;
  let trefs: Tref[] = [];

  const boxes = parseBoxes(data);
  for (const box of boxes) {
    if (box.type == BoxType.Tkhd) id = parseTkhd(box.data);
    else if (box.type == BoxType.Tref) trefs = parseTref(box.data);
    else if (box.type == BoxType.Mdia) mdia = box.data;
  }

  if (!id) throw new ParkhiError(ErrorCode.Corrupt, "trak does not have an id");
  if (!mdia) throw new ParkhiError(ErrorCode.Corrupt, "trak does not have an mdia");

  return { id, mdia, trefs };
}

export interface Moov {
  chaps: Chap[];
  udta: Udta | null;
}

export function parseMoov(data: Uint8Array): Moov {
  const moov: Moov = {
    chaps: [],
    udta: null,
  };

  const tracks: Trak[] = [];

  let boxes = parseBoxes(data);
  for (const box of boxes) {
    if (box.type == BoxType.Trak) {
      handleUnknownVersion(() => {
        const track = parseTrak(box.data);
        tracks.push(track);
      });
    } else if (box.type == BoxType.Udta) {
      handleUnknownVersion(() => {
        moov.udta = parseUdta(box.data);
      });
    }
  }

  let chapTrackId = null;
  for (const track of tracks) {
    for (const tref of track.trefs) {
      if (tref.type == BoxType.Chap) {
        chapTrackId = tref.ids[0];
        break;
      }
    }
  }

  for (const track of tracks) {
    if (track.id == chapTrackId) {
      handleUnknownVersion(() => {
        moov.chaps = parseMdia(track.mdia);
      });
      break;
    }
  }

  return moov;
}

export function parseChapName(data: Uint8Array): string {
  let cursor = 0;

  if (data.length - cursor < 2)
    throwLengthMismatchError("chapter name", "data", 2, data.length - cursor);

  const [b0, b1] = data.subarray(cursor, cursor + 2);
  const size = parseU32(0, 0, b0!, b1!);
  cursor += 2;

  if (data.length - cursor < size)
    throwLengthMismatchError("chapter name", "data", size, data.length - cursor);
  data = data.subarray(cursor, cursor + size);

  if (data[0] == 0xfe && data[1] == 0xff) return UTF16BE.decode(data.slice(2));
  if (data[0] == 0xff && data[1] == 0xfe) return UTF16LE.decode(data.slice(2));
  if (data[0] == 0xef && data[1] == 0xbb && data[2] == 0xbf) return UTF8.decode(data.slice(3));
  return UTF8.decode(data);
}

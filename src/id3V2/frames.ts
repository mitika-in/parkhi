import { ErrorCode, ParkhiError } from "../error.ts";
import { synchronise } from "./syncBuffer.ts";

export function parseSyncSafeSize(b0: number, b1: number, b2: number, b3: number): number {
  const l0 = (b0! & 0x7f) << 21;
  const l1 = (b1! & 0x7f) << 14;
  const l2 = (b2! & 0x7f) << 7;
  const l3 = (b3! & 0x7f) << 0;
  const size = (l0 | l1 | l2 | l3) >>> 0;
  return size;
}

export interface V23FrameHeader {
  id: string;
  size: number;
  hasCompression: boolean;
  hasEncryption: boolean;
  hasGroupingIdentity: boolean;
}

export function parseV23FrameHeader(data: Uint8Array): V23FrameHeader {
  const id = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  const size = parseSyncSafeSize(data[4]!, data[5]!, data[6]!, data[7]!);
  const flags = data[9]!;
  const hasCompression = (flags & 0b10000000) != 0;
  const hasEncryption = (flags & 0b01000000) != 0;
  const hasGroupingIdentity = (flags & 0b00100000) != 0;

  return {
    id,
    size,
    hasCompression,
    hasEncryption,
    hasGroupingIdentity,
  };
}

export function parseV23FrameData(header: V23FrameHeader, data: Uint8Array): Uint8Array {
  let cursor = 0;
  if (header.hasCompression) cursor += 4;
  if (header.hasEncryption) cursor += 1;
  if (header.hasGroupingIdentity) cursor += 1;
  data = data.subarray(cursor);

  return data;
}

export interface V24FrameHeader {
  id: string;
  size: number;
  hasGroupingIdentity: boolean;
  hasCompression: boolean;
  hasEncryption: boolean;
  hasUnsynchronisation: boolean;
  hasDataLengthIndicator: boolean;
}

export function parseV24FrameHeader(data: Uint8Array): V24FrameHeader {
  const id = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  const size = parseSyncSafeSize(data[4]!, data[5]!, data[6]!, data[7]!);
  const flags = data[9]!;
  const hasGroupingIdentity = (flags & 0b01000000) != 0;
  const hasCompression = (flags & 0b00001000) != 0;
  const hasEncryption = (flags & 0b00000100) != 0;
  const hasUnsynchronisation = (flags & 0b00000010) != 0;
  const hasDataLengthIndicator = (flags & 0b00000001) != 0;

  return {
    id,
    size,
    hasGroupingIdentity,
    hasCompression,
    hasEncryption,
    hasUnsynchronisation,
    hasDataLengthIndicator,
  };
}

export function parseV24FrameData(
  hasGlobalUnsynchronisation: boolean,
  header: V24FrameHeader,
  data: Uint8Array,
): Uint8Array {
  let cursor = 0;
  if (header.hasGroupingIdentity) cursor += 1;
  if (header.hasEncryption) cursor += 1;
  if (header.hasDataLengthIndicator) cursor += 4;
  data = data.subarray(cursor);

  if (hasGlobalUnsynchronisation || header.hasUnsynchronisation)
    data = synchronise(false, data).data;

  return data;
}

export async function decompressFrame(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream("deflate");
    const blob = new Blob([data as Uint8Array<ArrayBuffer>]);
    const stream = blob.stream().pipeThrough(ds);
    const result = await new Response(stream).blob();
    return new Uint8Array(await result.arrayBuffer());
  } catch (e) {
    throw new ParkhiError(ErrorCode.Corrupt, `unable to decompress frame: ${e}`);
  }
}

export enum FrameType {
  Apic = "APIC",
  Chap = "CHAP",
  Ctoc = "CTOC",
  Tit2 = "TIT2",
  Tpe1 = "TPE1",
  Tpe2 = "TPE2",
  Tpe3 = "TPE3",
  Tpe4 = "TPE4",
}

const ISO8859 = new TextDecoder("iso-8859-1", { fatal: true });
const UTF16 = new TextDecoder("utf-16", { fatal: true });
const UTF16BE = new TextDecoder("utf-16be", { fatal: true });
const UTF8 = new TextDecoder("utf-8", { fatal: true });

enum TextEncoding {
  Iso8859 = 0x00,
  Utf16 = 0x01,
  Utf16Be = 0x02,
  Utf8 = 0x03,
}

function decode(encoding: number, data: Uint8Array): string {
  let text;
  if (encoding == TextEncoding.Iso8859) text = ISO8859.decode(data);
  else if (encoding == TextEncoding.Utf16) text = UTF16.decode(data);
  else if (encoding == TextEncoding.Utf16Be) text = UTF16BE.decode(data);
  else if (encoding == TextEncoding.Utf8) text = UTF8.decode(data);
  else throw new ParkhiError(ErrorCode.Corrupt, `text frame has unknown encoding: ${encoding}`);
  return text;
}

export enum PictureType {
  Cover = 0x03,
}

export function parseApic(data: Uint8Array): { type: number; picture: Blob | string } {
  let cursor = 0;

  const encoding = data[cursor]!;
  cursor = 1;

  const mimeTypeEnd = data.indexOf(0, cursor);
  if (mimeTypeEnd == -1)
    throw new ParkhiError(ErrorCode.Corrupt, "APIC MIME type does not end with 0x00");

  const mimeTypeData = data.subarray(cursor, mimeTypeEnd);
  const mimeType = ISO8859.decode(mimeTypeData);
  cursor = mimeTypeEnd + 1;

  const pictureType = data[cursor]!;
  cursor += 1;

  if (encoding == TextEncoding.Iso8859 || encoding == TextEncoding.Utf8) {
    const descLen = data.indexOf(0, cursor);
    if (descLen == -1)
      throw new ParkhiError(ErrorCode.Corrupt, "APIC description does not end with 0x00");
    cursor = descLen + 1;
  } else if (encoding == TextEncoding.Utf16 || encoding == TextEncoding.Utf16Be) {
    while (cursor < data.length - 1) {
      if (data[cursor] == 0 && data[cursor + 1] == 0) {
        cursor += 2;
        break;
      }
      cursor += 2;
    }
  } else {
    throw new ParkhiError(ErrorCode.Corrupt, `APIC description has unknown encoding: ${encoding}`);
  }

  const picData = data.subarray(cursor);
  let picture;
  if (mimeType == "-->") picture = ISO8859.decode(picData);
  else picture = new Blob([picData as Uint8Array<ArrayBuffer>], { type: mimeType });

  return { type: pictureType, picture };
}

export async function parseChap(
  version: "2.3" | "2.4",
  data: Uint8Array,
): Promise<{ id: string; start: number; name: string }> {
  let cursor = 0;

  const idEnd = data.indexOf(0, cursor);
  if (idEnd == -1) throw new ParkhiError(ErrorCode.Corrupt, "CHAP id does not end with 0x00");

  const idData = data.subarray(cursor, idEnd);
  const id = ISO8859.decode(idData);
  cursor = idEnd + 1;

  const [b1, b2, b3, b4] = data.subarray(cursor, cursor + 4);
  if (b1 == undefined || b2 == undefined || b3 == undefined || b4 == undefined)
    throw new ParkhiError(ErrorCode.Corrupt, "CHAP data is smaller than expected");

  const s1 = b1 << 24;
  const s2 = b2 << 16;
  const s3 = b3 << 8;
  const s4 = b4 << 0;
  const start = ((s1 | s2 | s3 | s4) >>> 0) / 1000;
  cursor += 16;

  let name = "";
  while (cursor < data.length) {
    const headerData = data.subarray(cursor, cursor + 10);
    if (headerData.length < 10)
      throw new ParkhiError(ErrorCode.Corrupt, "CHAP subframe header is smaller than expected");
    cursor += 10;

    let header;
    if (version == "2.3") header = parseV23FrameHeader(headerData);
    else if (version == "2.4") header = parseV24FrameHeader(headerData);
    else throw new Error(`unknown version: ${version}`);

    const frameData = data.subarray(cursor, cursor + header.size);
    if (frameData.length < header.size)
      throw new ParkhiError(ErrorCode.Corrupt, "CHAP subframe data is smaller than expected");
    cursor += header.size;

    if (header.hasEncryption || header.id != FrameType.Tit2) continue;

    let payload;
    if (version == "2.3") {
      payload = parseV23FrameData(header, frameData);
    } else if (version == "2.4") {
      payload = parseV24FrameData(false, header as V24FrameHeader, frameData);
    } else {
      throw new Error(`unknown version: ${version}`);
    }

    let decompressed = frameData;
    if (header.hasCompression) decompressed = await decompressFrame(payload);
    name = parseTit2(decompressed);
    cursor += header.size;
  }

  return { id, start, name };
}

export function parseCtoc(data: Uint8Array): { id: string; root: boolean; children: string[] } {
  let cursor = 0;

  const idEnd = data.indexOf(0, cursor);
  if (idEnd == -1) throw new ParkhiError(ErrorCode.Corrupt, "CTOC id does not end with 0x00");

  const idData = data.subarray(cursor, idEnd);
  const id = ISO8859.decode(idData);
  cursor = idEnd + 1;

  const flags = data[cursor];
  if (flags == undefined)
    throw new ParkhiError(ErrorCode.Corrupt, "CTOC data is smaller than expected");

  const root = (flags & 0b00000010) != 0;
  cursor += 1;

  const len = data[cursor];
  if (len == undefined)
    throw new ParkhiError(ErrorCode.Corrupt, "CTOC data is smaller than expected");

  cursor += 1;

  const children = [];
  for (let i = 0; i < len; i++) {
    const idEnd = data.indexOf(0, cursor);
    if (idEnd == -1)
      throw new ParkhiError(ErrorCode.Corrupt, "CTOC child id does not end with 0x00");

    const idData = data.subarray(cursor, idEnd);
    const id = ISO8859.decode(idData);
    children.push(id);
    cursor = idEnd + 1;
  }

  return { id, root, children };
}

function parseText(data: Uint8Array): string {
  const encoding = data[0]!;
  const textData = data.subarray(1);
  const text = decode(encoding, textData);
  return text;
}

export function parseTit2(data: Uint8Array): string {
  const text = parseText(data);
  return text;
}

function splitText(version: "2.3" | "2.4", text: string): string[] {
  let sep;
  if (version == "2.3") sep = "/";
  else if (version == "2.4") sep = "\u0000";
  else throw new Error(`unknown version: ${version}`);

  return text
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length != 0);
}

export function parseTpex(version: "2.3" | "2.4", data: Uint8Array): string[] {
  const text = parseText(data);
  return splitText(version, text);
}

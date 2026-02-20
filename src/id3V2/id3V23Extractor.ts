import { Buffer } from "../buffer.ts";
import { ErrorCode, ParkhiError } from "../error.ts";
import { type Chapter, type Extractor, type Metadata } from "../extractor.ts";
import { MetadataType } from "../metadataType.ts";
import { parseU32 } from "../utils.ts";
import {
  FrameType,
  PictureType,
  type V23FrameHeader,
  decompressFrame,
  parseApic,
  parseChap,
  parseCtoc,
  parseSyncSafeSize,
  parseTit2,
  parseTpex,
  parseV23FrameData,
  parseV23FrameHeader,
} from "./frames.ts";
import { SyncBuffer } from "./syncBuffer.ts";

enum State {
  HeaderIdentifier,
  HeaderVersion,
  HeaderFlags,
  HeaderSize,
  ExtendedHeaderSize,
  ExtendedHeaderRest,
  FrameHeader,
  FrameData,
}

export class Id3V23Extractor implements Extractor {
  name = "Id3V23Extractor";

  private buffer: Pick<Buffer, keyof Buffer> = new Buffer();
  private state = State.HeaderIdentifier;

  private hasUnsynchronisation = false;
  private hasExtendedHeader = false;

  private extendedHeaderSize = 0;

  private frameHeader: V23FrameHeader | null = null;

  private chaps: Map<string, { start: number; name: string }> = new Map();
  private ctocs: Map<string, { root: boolean; children: string[] }> = new Map();

  private metadata: Metadata = {
    type: null,
    name: null,
    authors: [],
    cover: null,
    chapters: [],
  };

  async feed(chunk: Uint8Array | null): Promise<boolean> {
    if (chunk == null) {
      if (this.state <= State.HeaderVersion) {
        throw new ParkhiError(ErrorCode.Unknown, "version can not be determined");
      } else {
        throw new ParkhiError(ErrorCode.Corrupt, "data is smaller than expected");
      }
    }

    this.buffer.push(chunk);

    if (this.state == State.HeaderIdentifier && this.buffer.length >= 3) {
      const [b0, b1, b2] = this.buffer.pop(3);
      if (!(b0 == "I".charCodeAt(0) && b1 == "D".charCodeAt(0) && b2 == "3".charCodeAt(0)))
        throw new ParkhiError(ErrorCode.Unknown, "header does not match ID3");

      this.state = State.HeaderVersion;
    }

    if (this.state == State.HeaderVersion && this.buffer.length >= 2) {
      const [b0, b1] = this.buffer.pop(2);
      if (!(b0 == 3 && b1 == 0)) throw new ParkhiError(ErrorCode.Unknown, "version is not 30");

      this.state = State.HeaderFlags;
    }

    if (this.state == State.HeaderFlags && this.buffer.length >= 1) {
      const flags = this.buffer.pop(1)[0]!;
      this.hasUnsynchronisation = (flags & 0b10000000) != 0;
      this.hasExtendedHeader = (flags & 0b01000000) != 0;

      this.state = State.HeaderSize;
    }

    if (this.state == State.HeaderSize && this.buffer.length >= 4) {
      const [b0, b1, b2, b3] = this.buffer.pop(4);
      const size = parseSyncSafeSize(b0!, b1!, b2!, b3!);

      const chunks = this.buffer.pop(this.buffer.length);
      if (this.hasUnsynchronisation) this.buffer = new SyncBuffer([chunks], size);
      else this.buffer = new Buffer([chunks], size);

      if (this.hasExtendedHeader) this.state = State.ExtendedHeaderSize;
      else this.state = State.FrameHeader;
    }

    if (this.state == State.ExtendedHeaderSize && this.buffer.length >= 4) {
      const [b0, b1, b2, b3] = this.buffer.pop(4);
      this.extendedHeaderSize = parseU32(b0!, b1!, b2!, b3!);

      this.state = State.ExtendedHeaderRest;
    }

    if (
      this.state == State.ExtendedHeaderRest &&
      this.buffer.length >= this.extendedHeaderSize - 4
    ) {
      this.buffer.pop(this.extendedHeaderSize - 4);

      this.state = State.FrameHeader;
    }

    let consumed = true;
    let lastLength = this.buffer.length;
    while (consumed) {
      const done = await this.parseFrame();
      if (done || (this.buffer.done && this.buffer.length == 0)) {
        this.parseChapters();
        this.metadata.type = MetadataType.Id3v23;
        return true;
      }

      consumed = lastLength != this.buffer.length;
      lastLength = this.buffer.length;
    }

    return false;
  }

  private async parseFrame(): Promise<boolean> {
    if (this.state == State.FrameHeader && this.buffer.length >= 1) {
      if (this.buffer.peek(0) == 0x00) return true;
    }

    if (this.state == State.FrameHeader && this.buffer.length >= 10) {
      const data = this.buffer.pop(4);
      this.frameHeader = parseV23FrameHeader(data);

      this.state = State.FrameData;
    }

    if (this.state == State.FrameData && this.buffer.length >= this.frameHeader!.size) {
      const data = this.buffer.pop(this.frameHeader!.size);
      this.parseFrameData(data);

      this.state = State.FrameHeader;
    }

    return false;
  }

  private async parseFrameData(data: Uint8Array) {
    if (this.frameHeader!.hasEncryption) return;
    if (!Object.values(FrameType).includes(this.frameHeader!.id as FrameType)) return;

    data = parseV23FrameData(this.frameHeader!, data);
    if (this.frameHeader!.hasCompression) data = await decompressFrame(data);

    const id = this.frameHeader!.id;

    if (id == FrameType.Apic) {
      const pic = parseApic(data);
      if (pic.type != PictureType.Cover || typeof pic.picture == "string") return;
      this.metadata.cover = pic.picture;
      return;
    }

    if (id == FrameType.Chap) {
      const { id, start, name } = await parseChap("2.3", data);
      this.chaps.set(id, { start, name });
      return;
    }

    if (id == FrameType.Ctoc) {
      const { id, root, children } = parseCtoc(data);
      this.ctocs.set(id, { root, children });
      return;
    }

    if (id == FrameType.Tit2) {
      const title = parseTit2(data);
      this.metadata.name = title;
    }

    if (
      id == FrameType.Tpe1 ||
      id == FrameType.Tpe2 ||
      id == FrameType.Tpe3 ||
      id == FrameType.Tpe4
    ) {
      const authors = parseTpex("2.3", data);
      this.metadata.authors.push(...authors);
      return;
    }
  }

  private resolveChap(id: string): Chapter {
    const chap = this.chaps.get(id);
    const ctoc = this.ctocs.get(id);
    return {
      name: chap?.name ?? "",
      position: chap?.start ?? 0,
      children: ctoc?.children.map((id) => this.resolveChap(id)) ?? [],
    };
  }

  private parseChapters() {
    const rootCtoc = this.ctocs.entries().find(([_, { root }]) => root);
    if (!rootCtoc) return;
    const [_, { children }] = rootCtoc;
    const chapters = children.map((id) => this.resolveChap(id));
    this.metadata.chapters = chapters;
  }

  async getMetadata(): Promise<Metadata | null> {
    if (this.metadata.type == null) return null;
    return this.metadata;
  }
}

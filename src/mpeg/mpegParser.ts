import { Buffer } from "../buffer.ts";
import { ErrorCode, ParkhiError } from "../error.ts";
import { useLogging } from "../logging.ts";
import { MetadataType } from "../metadataType.ts";
import { type Metadata, type Parser } from "../parser.ts";
import { decodeAscii, parseU32 } from "../utils.ts";
import { BoxType, type Chap, parseChapName, parseFtyp, parseMoov } from "./boxes.ts";

const { debug } = useLogging("mpegParser");

enum State {
  Size,
  Type,
  Data,
}

export class MpegParser implements Parser {
  name = "MpegParser";

  private buffer = new Buffer();
  private state = State.Size;

  private backup = new Buffer();

  private ftypFound = false;

  private boxSize = -1;
  private boxType = "";

  private chaps: Chap[] = [];

  private metadata: Metadata = {
    type: null,
    name: null,
    authors: [],
    cover: null,
    chapters: [],
  };

  private copy(size: number): Uint8Array {
    const data = this.buffer.pop(size);
    this.backup.push(data);
    return data;
  }

  async feed(chunk: Uint8Array | null): Promise<boolean> {
    if (chunk == null) {
      if (!this.ftypFound) throw new ParkhiError(ErrorCode.Unknown, "ftyp box not found");

      if (this.boxSize == 0 && this.state == State.Data) {
        this.parseData(this.copy(this.buffer.length));
        this.parseChapters();
        return true;
      }

      if (this.state == State.Size && this.buffer.length == 0) {
        this.parseChapters();
        return true;
      }

      throw new ParkhiError(ErrorCode.Corrupt, "insufficient data");
    }
    this.buffer.push(chunk);

    let consumed = true;
    let lastLength = this.buffer.length;
    while (consumed) {
      this.parseBox();
      consumed = this.buffer.length != lastLength;
      lastLength = this.buffer.length;
    }

    return false;
  }

  private parseBox() {
    if (this.state == State.Size && this.buffer.length >= 4) {
      const [b3, b2, b1, b0] = this.copy(4);
      this.boxSize = parseU32(b3!, b2!, b1!, b0!);

      if (this.boxSize == 1)
        throw new ParkhiError(ErrorCode.Unknown, "boxes with extended size are not supported");

      this.state = State.Type;
    }

    if (this.state == State.Type && this.buffer.length >= 4) {
      this.boxType = decodeAscii(this.copy(4));

      if (!this.ftypFound && this.boxType != BoxType.Ftyp)
        throw new ParkhiError(ErrorCode.Unknown, `found ${this.boxType} box before ftyp`);

      this.state = State.Data;
    }

    if (
      this.state == State.Data &&
      this.boxSize != 0 &&
      this.buffer.length >= this.boxSize - 4 - 4
    ) {
      const data = this.copy(this.boxSize - 4 - 4);

      this.parseData(data);

      this.state = State.Size;
    }
  }

  private parseData(data: Uint8Array) {
    if (this.boxType == BoxType.Ftyp) {
      const brands = parseFtyp(data);

      let compatible = false;
      for (const brand of brands) {
        if (["M4A ", "M4B ", "isom"].includes(brand)) {
          compatible = true;
          break;
        }
      }
      if (!compatible) throw new ParkhiError(ErrorCode.Unknown, `unknown brands ${brands}`);

      this.ftypFound = true;
      debug("identified data to MPEG");

      return;
    }

    if (this.boxType == BoxType.Moov) {
      const moov = parseMoov(data);
      this.chaps = moov.chaps;
      if (moov.udta) {
        this.metadata.authors = moov.udta.authors;
        this.metadata.cover = moov.udta.cover;
        this.metadata.name = moov.udta.name;
      }

      this.metadata.type = MetadataType.Mpeg;
    }
  }

  private parseChapters() {
    debug("parsing chapters");

    for (const chap of this.chaps) {
      if (chap.nameBegin >= this.backup.length || chap.nameEnd >= this.backup.length) {
        throw new ParkhiError(
          ErrorCode.Corrupt,
          `chapter name's position [${chap.nameBegin}, ${chap.nameEnd})` +
            `is out of range [0, ${this.backup.length})`,
        );
      }
      const data = this.backup.slice(chap.nameBegin, chap.nameEnd);
      const name = parseChapName(data);
      const chapter = {
        name,
        position: chap.position,
        children: [],
      };
      this.metadata.chapters.push(chapter);
    }
  }

  async getMetadata(): Promise<Metadata | null> {
    if (this.metadata.type == null) return null;
    return this.metadata;
  }
}

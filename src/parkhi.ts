import { ErrorCode, ParkhiError } from "./error.ts";
import { Id3V23Parser } from "./id3V2/id3V23Parser.ts";
import { Id3V24Parser } from "./id3V2/id3V24Parser.ts";
import { useLogging } from "./logging.ts";
import { MpegParser } from "./mpeg/mpegParser.ts";
import { type Metadata, type Parser } from "./parser.ts";

const { debug } = useLogging("parkhi");

export enum ParserType {
  None = 0,
  Id3V23 = 1 << 0,
  Id3V24 = 1 << 1,
  Mpeg = 1 << 2,
  All = None | Id3V23 | Id3V24 | Mpeg,
}

export class Parkhi {
  private parsers: Set<Parser> = new Set();
  private parser: Parser | null = null;
  private done = false;

  constructor(parserType: ParserType = ParserType.All, customParsers: Parser[] = []) {
    if ((parserType & ParserType.Id3V23) != 0) {
      const parser = new Id3V23Parser();
      debug(`adding ${parser.name}`);
      this.parsers.add(parser);
    }

    if ((parserType & ParserType.Id3V24) != 0) {
      const parser = new Id3V24Parser();
      debug(`adding ${parser.name}`);
      this.parsers.add(parser);
    }

    if ((parserType & ParserType.Mpeg) != 0) {
      const parser = new MpegParser();
      debug(`adding ${parser.name}`);
      this.parsers.add(parser);
    }

    for (const parser of customParsers) {
      debug(`adding ${parser.name}`);
      this.parsers.add(parser);
    }
  }

  async feed(chunk: Uint8Array | null): Promise<boolean> {
    if (this.done) return true;

    const toDrop = [];

    for (const parser of this.parsers) {
      let done;
      try {
        done = await parser.feed(chunk);
      } catch (e) {
        if (e instanceof ParkhiError) {
          if (e.code == ErrorCode.Unknown) {
            debug(`${parser.name} says unknown: ${e.message}`);
            toDrop.push(parser);
          } else {
            throw e;
          }
        } else {
          throw new ParkhiError(ErrorCode.Internal, `${e}`);
        }
      }

      if (done) {
        debug(`${parser.name} parsed the data`);
        this.parsers.clear();
        this.parser = parser;
        this.done = true;
        return this.done;
      }
    }

    for (const parser of toDrop) this.parsers.delete(parser);
    if (this.parsers.size == 0)
      throw new ParkhiError(ErrorCode.Unknown, "no parser is able to parse the data");

    return false;
  }

  async getMetadata(): Promise<Metadata | null> {
    if (this.parser) return this.parser.getMetadata();

    return null;
  }
}

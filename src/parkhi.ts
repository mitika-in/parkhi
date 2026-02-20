import { ErrorCode, ParkhiError } from "./error.ts";
import { type Extractor, type Metadata } from "./extractor.ts";
import { Id3V23Extractor } from "./id3V2/id3V23Extractor.ts";
import { Id3V24Extractor } from "./id3V2/id3V24Extractor.ts";
import { debug } from "./logging.ts";
import { MpegExtractor } from "./mpeg/mpegExtractor.ts";

export enum ExtractorType {
  None = 0,
  Id3V23 = 1 << 0,
  Id3V24 = 1 << 1,
  Mpeg = 1 << 2,
  All = 1 << 3,
}

export class Parkhi {
  private extractors: Set<Extractor> = new Set();
  private extractor: Extractor | null = null;
  private done = false;

  constructor(
    extractorType: ExtractorType = ExtractorType.All,
    customExtractors: Extractor[] = [],
  ) {
    if ((extractorType & ExtractorType.Id3V23) != 0) {
      const extractor = new Id3V23Extractor();
      debug(`adding ${extractor.name}`);
      this.extractors.add(extractor);
    }

    if ((extractorType & ExtractorType.Id3V24) != 0) {
      const extractor = new Id3V24Extractor();
      debug(`adding ${extractor.name}`);
      this.extractors.add(extractor);
    }

    if ((extractorType & ExtractorType.Mpeg) != 0) {
      const extractor = new MpegExtractor();
      debug(`adding ${extractor.name}`);
      this.extractors.add(extractor);
    }

    for (const extractor of customExtractors) {
      debug(`adding ${extractor.name}`);
      this.extractors.add(extractor);
    }
  }

  async feed(chunk: Uint8Array | null): Promise<boolean> {
    if (this.done) return true;

    const toDrop = [];

    for (const extractor of this.extractors) {
      let done;
      try {
        done = await extractor.feed(chunk);
      } catch (e) {
        if (e instanceof ParkhiError) {
          if (e.code == ErrorCode.Unknown) {
            debug(`${extractor.name} says unknown`);
            toDrop.push(extractor);
          } else {
            throw e;
          }
        } else {
          throw new ParkhiError(ErrorCode.Internal, `${e}`);
        }
      }

      if (done) {
        debug(`${extractor.name} completed extraction`);
        this.extractors.clear();
        this.extractor = extractor;
        this.done = true;
        return this.done;
      }
    }

    for (const extractor of toDrop) this.extractors.delete(extractor);
    if (this.extractors.size == 0)
      throw new ParkhiError(ErrorCode.Unknown, "no extractor is able to extract the metadata");

    return false;
  }

  async getMetadata(): Promise<Metadata | null> {
    if (this.extractor) return this.extractor.getMetadata();

    return null;
  }
}

export interface Chapter {
  name: string;
  position: number;
  children: Chapter[];
}

export interface Metadata {
  type: string | null;
  name: string | null;
  authors: string[];
  cover: Blob | null;
  chapters: Chapter[];
}

export interface Extractor {
  name: string;
  feed(chunk: Uint8Array | null): Promise<boolean>;
  getMetadata(): Promise<Metadata | null>;
}

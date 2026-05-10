# API Guide

This document talks about different classes, enumerations, interfaces and other data exported by
Parkhi.

Please read [Usage](./usage.md) for an overview of how to use Parkhi.

## `class Parkhi`

<a name="parkhi"></a>

`Parkhi` is the main entry-point of Parkhi. It parses the given data of a media file to parse
metadata from it. A simplified example on how to use Parkhi is given below.

```typescript
import { Parkhi } from "@mitikaIn/parkhi";

const parkhi = new Parkhi();

const data = dataFromSomeSource();
await parkhi.feed(data);

const metadata = await parkhi.getMetadata();
console.log("Metadata:", metadata);
```

### `constructor(parserType: ParserType = ParserType.All, customParsers: Parser[] = [])`

<a name="parkhiConstructor"></a>

Creates a new instance of `Parkhi`.

By default, `Parkhi` tries all builtin parsers. However, if you know the data uses certain metadata
format (for example, using extension of source file as an idea), then you can set `parserType` to
the probable value. Check [`ParserType`](#parserType) for more information.

It is possible that Parkhi does not have parsers for all the metadata types or the working of a
builtin parser does not suit your expectations. In such scenarios, use `customParsers` to
[add your own parsers](./usage.md#customParsers).

If your custom parser conflicts with a builtin parser, then you should disable the builtin parser by
removing it from `parserType` parameter. For example `ParserType.All & ~ParserType.ID3V23` disables
the ID3v2.3 parser.

#### `async feed(chunk: Uint8Array | null): Promise<boolean>`

<a name="parkhiFeed"></a>

Feeds the `chunk` to `Parkhi`. If the return value is `true`, then parsing is complete and there is
no need to feed more data. On the other hand, `false` indicates that more data is required to parse
the metadata.

The special value `null` is used to indicate end of the data. It must be fed once the data has been
completely fed.

This method throws `ParkhiError`, which can be used to catch and handle different errors. Check
[`ParkhiError`](#parkhiError) for more information.

Learn more about what `chunk` refers to and its semantics at [Feeding data](./usage.md#feedingData).

#### `async getMetadata(): Promise<Metadata | null>`

<a name="parkhiGetMetadata"></a>

Returns the metadata of the parsed media. This method returns a value only after parsing is done,
that is, after [`Parkhi.feed`](#ParkhiFeed) returns `true`. On other situations, it returns `null`.

## `enum ParserType`

<a name="parserType"></a>

This represents the different parsers that can be parsed by Parkhi.

```typescript
import { Parkhi, ParserType } from "@mitikaIn/parkhi";

// Enable all builtin parsers.
let parserType = ParserType.All;

// Enable only ID3v2.3 parser.
parserType = ParserType.Id3V23;

// Enable only ID3v2.3 and ID3v2.4 parsers.
parserType = ParserType.Id3V23 & ParserType.Id3V24;

// Enable everything except ID3v2.3 parser.
parserType = ParserType.All & ~ParserType.Id3V23;

// Disable all builtin parsers.
parserType = ParserType.None;

// Finally pass this to parserType argument of Parkhi to take effect.
const parkhi = new Parkhi(parserType);
```

### `None`

Special value to represent no parser.

### `Id3V23`

Represents the [ID3v2.3](https://id3.org/id3v2.3.0) parser.

### `Id3V24`

Represents the [ID3v2.4](https://id3.org/id3v2.4.0-structure) parser.

### `Mpeg`

Represents the [MPEG](https://en.wikipedia.org/wiki/ISO_base_media_file_format) parser.

### `All`

Special value to represent all the above metadata parsers.

`ParserType` can be used as a
[bitwise flag](https://developer.mozilla.org/en-US/docs/Glossary/Bitwise_flags) to enable and
disable builtin parsers of Parkhi.

## `interface Metadata`

This describes the parsed metadata.

### `name: string | null`

Represents the name or title in the media.

### `authors: string[]`

Represents the authors and people involved in the media. The order is from most related (like the
original author or creator) to least related (like the translator or proof-reader).

### `cover: Blob | null`

Represents the front cover picture.

### `chapters: Chapter[]`

Represents the chapters in the media. It is ordered in sequential manner.

## `interface Chapter`

This describes a chapter in parsed metadata.

### `name: string`

Represents the name or title of the chapter.

### `position: number`

Represents the position of the chapter in seconds.

### `children: Chapter[]`

Represents the sub-chapters of the chapter.

## `enum MetadataType`

<a name="metadataType"></a>

This describes the metadata type of builtin parsers. Primary use of this enumeration is to avoid
hard coding strings when comparing the return value of [`Parkhi.getMetadata`](#parkhiGetMetadata).

```typescript
import { MetadataType, Parkhi } from "@mitikaIn/parkhi";

const parkhi = new Parkhi();

// Feed data to Parkhi as usual.

const metadata = await parkhi.getMetadata();

if (metadata.type == MetadataType.Id3V23) console.log("It is ID3v2.3 format.");
else console.log("It is", metadata.type);
```

### `Id3V23 = "ID3v2.3"`

Represents the [ID3v2.3](https://id3.org/id3v2.3.0) format.

### `Id3V24 = "ID3v2.4"`

Represents the [ID3v2.4](https://id3.org/id3v2.4.0-structure) format.

### `Mpeg = "MPEG"`

Represents the [MPEG](https://en.wikipedia.org/wiki/ISO_base_media_file_format) format.

## `class ParkhiError`

<a name="parkhiError"></a>

This describes the error class that can be thrown from Parkhi.

### `code: ErrorCode`

<a name="parkhiErrorCode"></a>

Represents what the error is about in a machine understandable way.

## `enum ErrorCode`

This describes the different type of errors. It is used in [`ParkhiError.code`](#parkhiErrorCode).

### `Corrupt`

<a name="errorCodeCorrupt"></a>

Represents a corrupted data.

### `Internal`

<a name="errorCodeInternal"></a>

Represents an internal error. Please report it to us.

### `Unknown`

<a name="errorCodeUnknown"></a>

Represents an unknown metadata format. This is thrown when no parser can parse metadata from the
data.

## `interface Parser`

<a name="parser"></a>

This is the interface implemented by all parsers of Parkhi. A custom parser must follow this
interface to be used by `Parkhi`.

Parsers must ensure that they only throw errors of type [`ParkhiError`](#parkhiError) so it is easy
to catch and handle in the user side.

### `feed(chunk: Uint8Array | null): Promise<boolean>`

This method must accept the given chunk of data and try to parse it. The return value indicates
whether the parsing is done. If it returns `true`, then the parsing is complete. Else, it requires
more data to parse the metadata.

If `chunk` is `null`, then it no more data is available.

### `getMetadata(): Promise<Metadata | null>`

This method must return the metadata parsed. It must return `null` when the parsing is not over.

## `Buffer`

<a name="buffer"></a>

`Buffer` is a utility type that can be useful when writing an parser. It stores chunks of data and
allows to retrieve them as a single slice.

```typescript
import { Buffer } from "@mitikaIn/parkhi";

const buffer = new Buffer();

const d1 = new Uint8Array([0, 1, 2, 3]);
const d2 = new Uint8Array([4, 5, 6, 7]);
buffer.push(d1);
buffer.push(d2);

console.log(buffer.length); // 8

console.log(buffer.slice(2)); // Uint8Array([0, 1])
console.log(buffer.slice(4)); // Uint8Array([2, 3, 4, 5])
console.log(buffer.slice(2)); // Uint8Array([6, 7])

buffer.slice(1); // ParkhiError(ErrorCode.Internal, "size should not be greater than length")
```

### `constructor(chunks: Uint8Array[] = [], maxLength = Infinity)`

Creates a new buffer filled with given chunks. `maxLength` can be used to limit the maximum size of
the buffer.

### `length: number`

<a name="bufferLength"></a>

Returns the number of bytes available in buffer.

### `done: boolean`

Returns if the maximum length of buffer reached.

### `rejected: Uint8Array[]`

Returns the rejected chunks that were pushed after the maximum length has been reached.

### `push(chunk: Uint8Array)`

Pushes the chunk to buffer.

### `peek(idx: number): number`

Get the byte at given index.

Throws [`ParkhiError`](#parkhiError) with [`ErrorCode.Internal`](#errorCodeInternal) if the `idx` is
greater than the [`Buffer.length`](#bufferLength).

### `slice(begin: number, end: number): Uint8Array`

Slices the bytes from `begin` to `end` and returns it as a single `Uint8Array`.

Throws [`ParkhiError`](#parkhiError) with [`ErrorCode.Internal`](#errorCodeInternal) if the
`[begin, end)` is out of buffer's range.

### `pop(size: number): Uint8Array`

Removes and returns the first `size` bytes from the buffer.

Throws [`ParkhiError`](#parkhiError) with [`ErrorCode.Internal`](#errorCodeInternal) if the `size`
is greater than [`Buffer.length`](#bufferLength).

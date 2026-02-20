# API Guide

This document talks about different classes, enumerations, interfaces and other
data exported by Parkhi.

Please read [Usage](./usage.md) for an overview of how to use Parkhi.

## `class Parkhi`

<a name="parkhi"></a>

`Parkhi` is the main entry-point of Parkhi. It parses the given data of a media
file to extract metadata from it.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

const blob = await getBlob();
const buffer = await blob.arrayBuffer();
const data = new Uint8Array(buffer);

const parkhi = new Parkhi();

await parkhi.feed(data);

const metadata = await parkhi.getMetadata();
const metadataType = parkhi.getMetadataType();

console.log("Metadata:", metadata);
console.log("Metadata type:" metadataType);
```

### `constructor(extractorType: ExtractorType = ExtractorType.All, customExtractors: Extractor[] = [])`

<a name="parkhiConstructor"></a>

Creates a new instance of `Parkhi`.

By default, `Parkhi` tries all builtin extractors. However, if you know the data
uses certain metadata format (for example, using extension of source file as an
idea), then you can set `extractorType` to the probable value. Check
[`ExtractorType`](#extractorType) for more information.

It is possible that Parkhi does not have extractors for all the metadata types
or the working of a builtin extractor does not suit your expectations. In such
scenarios, use `customExtractors` to [add your own
extractors](./usage.md#customExtractors).

If your custom extractor conflicts with a builtin extractor, then you should
disable the builtin extractor by removing it from `extractorType` parameter. For
example `ExtractorType.All & ~ExtractorType.ID3v23` disables the ID3v2.3
extractor.

#### `async feed(chunk: Uint8Array): Promise<boolean>`

<a name="parkhiFeed"></a>

Feeds the `chunk` to `Parkhi`. If the return value is `true`, then extraction is
complete and there is no need to feed more data. On the other hand, `false`
indicates that more data is required to extract the metadata.

This method throws `ParkhiError`, which can be used to catch and handle
different errors. Check [`ParkhiError`](#parkhiError) for more information.

Learn more about what `chunk` refers to and its semantics at [Feeding
data](./usage.md#feedingData).

#### `async getMetadata(): Promise<Metadata | null>`

Returns the metadata of the parsed media. This method returns a value only after
extraction is done, that is, after [`Parkhi.feed`](#ParkhiFeed) returns `true`.
On other situations, it returns `null`.

#### `getMetadataType(): string | null`

Returns the metadata type of the parsed media. This method returns a value only
after extraction is done, that is, after [`Parkhi.feed`](#ParkhiFeed) returns
`true`. On other situations, it returns `null`.

For builtin extractors, [`MetadataType`](#metadataType) can be used to compare
the return value instead of hard coding strings.

## `enum ExtractorType`

<a name="extractorType"></a>

This represents the different extractors that can be parsed by Parkhi.

```typescript
import { ExtractorType, Parkhi } from "@mitika-in/parkhi";

// Enable all builtin extractors.
let extractorType = ExtractorType.All;

// Enable only ID3v2.3 extractor.
extractorType = ExtractorType.Id3v23;

// Enable only ID3v2.3 and ID3v2.4 extractors.
extractorType = ExtractorType.Id3v23 & ExtractorType.Id3v24;

// Enable everything except ID3v2.3 extractor.
extractorType = ExtractorType.All & ~ExtractorType.Id3v23;

// Disable all builtin extractors.
extractorType = ExtractorType.None;

// Finally pass this to extractorType argument of Parkhi to take effect.
const parkhi = new Parkhi(extractorType);
```

### `None`

Special value to represent no extractor.

### `Id3v23`

Represents the [ID3v2.3](https://id3.org/id3v2.3.0) extractor.

### `Id3v24`

Represents the [ID3v2.4](https://id3.org/id3v2.4.0-structure) extractor.

### `All`

Special value to represent all the above metadata extractors.

`ExtractorType` can be used as a [bitwise
flag](https://developer.mozilla.org/en-US/docs/Glossary/Bitwise_flags) to enable
and disable builtin extractors of Parkhi.

## `interface Metadata`

This describes the parsed metadata.

### `name: string | null`

Represents the name or title in the media.

### `authors: string[]`

Represents the authors and people involved in the media. The order is from most
related (like the original author or creator) to least related (like the
translator or proof-reader).

### `cover: Blob | null`

Represents the front cover image.

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

This describes the metadata type of builtin extractors. Primary use of this
enumeration is to avoid hard coding strings when comparing the return value of
[`Parkhi.getMetadataType`](#parkhiGetMetadataType).

```typescript
import { MetadataType, Parkhi } from "@mitika-in/parkhi";

const parkhi = new Parkhi();

// Feed data to Parkhi as usual.

const metadataType = parkhi.getMetadataType();

if (metadataType == MetadataType.Id3v2) console.log("It is ID3v2.3 format.");
else console.log("It is", metadataType);
```

### `Id3v23 = "ID3v2.3"`

Represents the [ID3v2.3](https://id3.org/id3v2.3.0) format.

### `Id3v24 = "ID3v2.4"`

Represents the [ID3v2.4](https://id3.org/id3v2.4.0-structure) format.

## `class ParkhiError`

<a name="parkhiError"></a>

This describes the error class that can be thrown from Parkhi.

### `code: ErrorType`

<a name="parkhiErrorCode"></a>

Represents what the error is about in a machine understandable way.

## `enum ErrorType`

This describes the different type of errors. It is used in
[`ParkhiError.code`](#parkhiErrorCode).

### `Corrupt`

<a name="errorTypeCorrupt"></a>

Represents a corrupted data.

### `Internal`

<a name="errorTypeInternal"></a>

Represents an internal error. Please report it to us.

### `Unknown`

<a name="errorTypeUnknown"></a>

Represents an unknown metadata format. This is thrown when no extractor can
extract metadata from the data.

## `interface Extractor`

<a name="extractor"></a>

This is the interface implemented by all extractors of Parkhi. A custom
extractor must follow this interface to be used by `Parkhi`.

Extractors must ensure that they only throw errors of type
[`ParkhiError`](#parkhiError) so it is easy to catch and handle in the user
side.

### `feed(chunk: Uint8Array): Promise<Result>`

This method must accept the given chunk of data and try to parse it. The return
value indicates whether the extraction is done.

### `getMetadata(): Promise<Metadata | null>`

This method must return the metadata extracted. It must return `null` when the
extraction is not over.

### `getMetadataType(): string | null`

<a name="parkhiGetMetadataType"></a>

This method must return the metadata type of the data fed to the extractor. It
must return `null` when it does not know the type yet.

## `enum Result`

`Result` is returned by the extractors on their [`Parkhi.feed`](#parkhiFeed)
method.

### `Break`

An extractor must return this value when it can not parse the data. This can
happen either because the data is not of the format expected by the extractor or
the extractor faced an error.

### `Continue`

An extractor must return this value when it needs more data to understand and
parse the metadata.

### `Done`

An extractor must return this value when the extraction is done.

`Result.Break` and `Result.Done` are terminal states. So if the extractor
returns `Result.Break` once, then it must continue return the same value.
Similarly for `Result.Done`. Mostly this means that after the first
`Result.Break` or `Result.Done`, any more feeding should be no-op.

## `Buffer`

<a name="buffer"></a>

`Buffer` is a utility type that can be useful when writing an extractor. It
stores chunks of data and allows to retrieve them as a single slice.

```typescript
import { Buffer } from "@mitika-in/parkhi";

const buffer = new Buffer();

const d1 = new Uint8Array([0, 1, 2, 3]);
const d2 = new Uint8Array([4, 5, 6, 7]);
buffer.push(d1);
buffer.push(d2);

console.log(buffer.length); // 8

console.log(buffer.slice(2)); // Uint8Array([0, 1])
console.log(buffer.slice(4)); // Uint8Array([2, 3, 4, 5])
console.log(buffer.slice(2)); // Uint8Array([6, 7])

buffer.slice(1); // ParkhiError(ErrorType.Internal, "size should not be greater than length")
```

### `constructor(chunks: Uint8Array[] = [])`

Creates a new buffer filled with given chunks.

### `length: number`

Returns the number of bytes available in buffer.

### `push(chunk: Uint8Array)`

Pushes the chunk to buffer.

### `slice(size: number): Uint8Array`

Slices the first `size` bytes and returns it as a single `Uint8Array`.

Throws [`ParkhiError`](#parkhiError) with
[`ErrorType.Internal`](#errorTypeInternal) if the `size` is greater than
[`Buffer.length`](#bufferLength).

# Usage

This documents talks about how to use Parkhi. Please read [API](./api.md) to
learn about different classes, enumerations, interfaces etc. of Parkhi.

## What is Parkhi?

Parkhi is a metadata extractor written in TypeScript and aimed for JavaScript
environment. A media file, like an audio or video has some metadata inside it.
For example, if the media file is a song, then its metadata can be name of the
song, its authors, cover image etc. Parkhi can be used to extract it.

It is free of runtime third-party dependencies and is aimed to simple and
sufficient for extracting the basic metadata. It can run anywhere JavaScript can
run. Parkhi uses some latest
[baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)
features, so that it can be free of dependencies.

Parkhi was created for [Mitika](https://github.com/mitika-in/mitika), a free and
open source audiobook player and ebook reader.

## When and when not to use Parkhi?

Parkhi is primarily targeted at the expectations of Mitika. As a result, it is
kept very minimal without complex features. Though we are happy to add a feature
if it is not _too_ complex, you might want to consider better options first,
before choosing Parkhi.

If you are already using a library to load and play media, then there is a good
chance that the library provides a way to extract the metadata.

For example, the most popular multimedia framework FFmpeg provides
[`ffprobe`](https://ffmpeg.org/ffprobe.html) to get all information about the
media.

Similarly, another popular multimedia framework GStreamer can also [extract the
metadata](https://gstreamer.freedesktop.org/documentation/application-development/advanced/metadata.html?gi-language=c#metadata).

If your software makes use of a server (like an API server), then it is
recommended to go with FFmpeg or GStreamer or any other library to extract
metadata. It would not be just easy, but also most efficient and fast.

If none of the above applies to your situation, then Parkhi might be an
_okayish_ choice. But do remember that the metadata extracted by Parkhi is based
on requirements of Mitika. In future (based on demands), we might plan to make
it a full-blown competitive metadata extractor, but for now, it will be strictly
minimal.

## Builtin extractors

Please check [`ExtractorType`](./api.md#extractorType) to know the available
builtin extractors.

## Installing Parkhi

Parkhi is not available in any package registry like NPM. It is meant to be
installed directly from Git.

```sh
$ npm install git+https://github.com/mitika-in/parkhi.git
```

You are suggested to install a specific commit and update from it to avoid any
surprises. Check [`npm
install`](https://docs.npmjs.com/cli/v11/commands/npm-install) for more
information on how to install a package from Git.

## Overview

The main entry-point to Parkhi is the class named [`Parkhi`](./api.md#parkhi).
Create an instance of it, feed data to it and then get the metadata from it once
you are done.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

const parkhi = new Parkhi();

await parkhi.feed(data);

const metadata = await parkhi.getMetadata();
console.log("Metadata:", metadata);
```

Parkhi has multiple extractors and can also be extended with [custom
extractors](#customExtractors). By default, it runs your data through all the
available extractors. Each extractor, if the data is of its intended format
continues to accept the fed data. However, if the data looks odd to it, it will
bail out. Finally there must be a single extractor if the media data is
supported by Parkhi. If no extractor can handle the data, then `Parkhi` throws a
[`ParkhiError`](#errorHandling).

If you know the type of media in advance, then it might be efficient to ask
`Parkhi` to only use those specific extractors.

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

## Feeding data

<a name="feedingData"></a>

`Parkhi` feeds on
[`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).
You can either pass the entire media's data in one-go or pass it chunk by chunk.
However, when you pass chunk by chunk, remember that the flow must be
sequential. That is, you can not pass the first 10 bytes first and then pass
last 20 bytes, then pass middle 30 bytes. It is fine to pass empty chunk though.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

// Feed the complete media data.
const blob = await getBlob();
const buffer = await blob.arrayBuffer();
const data = new Uint8Array(buffer);
let parkhi = new Parkhi();
await parkhi.feed(data);

parkhi = new Parkhi();

// Or feed it in terms of chunks.
for (const chunk of chunkedMedia) {
  await parkhi.feed(chunk);
}
```

The data passed to `Parkhi` must not be changed after feeding. That is, do not
do the following.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

const parkhi = new Parkhi();

const data = new Uint8Array([0, 2, 2]);
await parkhi.feed(data);

// Do not do this.
data[1] = 1;
```

`Parkhi` may not require the entire file to extract metadata. For example, if
the metadata is located at the first 10 bytes of a file, then it is not required
to continue feeding the remaining data.

As a result, [`Parkhi.feed`](./api.md#parkhiFeed) returns `true` if the
extraction is complete. After that, you can retrieve the metadata. On the other
hand, `false` means more data is required.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

const parkhi = new Parkhi();
for (const chunk of chunkedMedia) {
  const done = await parkhi.feed(chunk);
  if (done) {
    const metadata = await parkhi.getMetadata();
    console.log("Metadata:", metadata);
    break;
  }
}
```

## Non-blocking usage

Even though `Parkhi`'s methods are asynchronous in nature, the parsing logic
might have synchronous flows. Therefore, to avoid blocking UI or the other parts
of the software, it is suggested to run Parkhi in a
[worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).

## Error handling

<a name="errorHandling"></a>

All the errors thrown out of Parkhi is encapsulated as a single class called
[`ParkhiError`](./api.md#parkhiError). To know what the error is about, use
[`ParkhiError.code`](./api.md#parkhiErrorCode).

The error codes that you might be interested in are
[`ErrorType.Corrupt`](./api.md#errorTypeCorrupt) and
[`ErrorType.Unknown`](./api.md#errorTypeUnknown).

`ErrorType.Corrupt` is thrown when the media data is found corrupt. For example,
if the frame size does not match the expected size. `ErrorType.Unknown` is
thrown when `Parkhi` does not have any extractor which can extract from the
media data.

Finally, there is [`ErrorType.Internal`](./api.md#errorTypeInternal) which
points to an internal issue in Parkhi. Please report it to us.

Whenever an error is thrown, any more feeding of data results in undefined
behavior.

```typescript
import { ErrorType, Parkhi, ParkhiError } from "@mitika-in/parkhi";

const blob = myBlob;
const parkhi = new Parkhi();

try {
  await parkhi.feed(blob);
} catch (e) {
  if (e instanceof ParkhiError) {
    if (e.code == ErrorType.Corrupt) {
      console.error("The media data is corrupted.");
    } else if (e.code == ErrorType.Internal) {
      console.error("Oops something went wrong, please report.");
    } else if (e.code == ErrorType.Unknown) {
      console.error("The media data is unknown.");
    }
  } else {
    console.error("Oops something went wrong, please surely repor.t");
  }
}
```

## Custom extractors

<a name="customExtractors"></a>

Custom extractors can be used when Parkhi's builtin extractors are insufficient
or for an unsupported metadata type. All extractors must implement the
[`Extractor`](./api.md#extractor) interface. Though not necessary,
[`Buffer`](./api.md#buffer) can be useful while implementing an extractor.

After creating the extractor, pass it to `customExtractors` parameter of
[`Parkhi`](./api.md#parkhiConstructor).

```typescript
import {
  Buffer,
  type Extractor,
  ExtractorType,
  type Metadata,
  Parkhi,
  Result,
} from "@mitika-in/parkhi";

class MyExtractor implements Extractor {
  private buffer = new Buffer();

  async feed(chunk: Uint8Array): Promise<Result> {
    // Do something with the chunk.
    this.buffer.push(chunk);
    return Result.Continue;
  }

  async getMetadata(): Promise<Metadata | null> {
    // Return the extracted metadata.
    return null;
  }

  getMedataType(): string | null {
    // Return the metadata type of the data.
    return null;
  }
}

let extractorType = ExtractorType.All;

// If MyExtractor replaces a builtin extractor, then disable the builtin extractor
extractorType = ExtractorType.All & ~ExtractorType.Id3v23;
// Else, leave it to default or Extractor.None to disable all builtin extractors.

const parkhi = new Parkhi(extractorType, [MyExtractor]);
```

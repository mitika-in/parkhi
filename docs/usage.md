# Usage

This documents talks about how to use Parkhi. Please read [API](./api.md) to learn about different
classes, enumerations, interfaces etc. of Parkhi.

## What is Parkhi?

Parkhi is a metadata parser written in TypeScript and aimed for JavaScript environment. A media
file, like an audio or video has some metadata inside it. For example, if the media file is a song,
then its metadata can be name of the song, its authors, cover picture etc. Parkhi can be used to
parse it.

It is free of runtime third-party dependencies and is aimed to be simple and sufficient for parsing
the basic metadata. It can run anywhere JavaScript can run. Parkhi uses some latest
[baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility) features, so
that it can be free of dependencies.

Parkhi was created for [Mitika](https://github.com/mitikaIn/mitika), a free and open source
audiobook player and ebook reader.

## When and when not to use Parkhi?

Parkhi is primarily targeted at the expectations of Mitika. As a result, it is kept very minimal
without complex features. Though we are happy to add a feature if it is not _too_ complex, you might
want to consider better options first, before choosing Parkhi.

If you are already using a library to load and play media, then there is a good chance that the
library provides a way to parse the metadata.

For example, the most popular multimedia framework FFmpeg provides
[`ffprobe`](https://ffmpeg.org/ffprobe.html) to get all information about the media.

Similarly, another popular multimedia framework GStreamer can also
[parse the metadata](https://gstreamer.freedesktop.org/documentation/application-development/advanced/metadata.html?gi-language=c#metadata).

If your software makes use of a server (like an API server), then it is recommended to go with
FFmpeg or GStreamer or any other library to parse metadata. It would not be just easy, but also most
efficient and fast.

If none of the above applies to your situation, then Parkhi might be an _okayish_ choice. But do
remember that the metadata parseed by Parkhi is based on requirements of Mitika. In future (based on
demands), we might plan to make it a full-blown competitive metadata parser, but for now, it will be
strictly minimal.

## Builtin parsers

Please check [`ParserType`](./api.md#parserType) to know the available builtin parsers.

## Installing Parkhi

Parkhi is not available in any package registry like NPM. It is meant to be installed directly from
Git.

```sh
$ npm install git+https://github.com/mitikaIn/parkhi.git
```

You are suggested to install a specific commit and update from it to avoid any surprises. Check
[`npm install`](https://docs.npmjs.com/cli/v11/commands/npm-install) for more information on how to
install a package from Git.

## Overview

The main entry-point to Parkhi is the class named [`Parkhi`](./api.md#parkhi). Create an instance of
it, feed data to it and then get the metadata from it once you are done.

```typescript
import { ErrorCode, Parkhi, ParkhiError } from "@mitikaIn/parkhi";

const parkhi = new Parkhi();

const source = new Blob([]); // The media data to be parsed.
const stream = source.stream();
const reader = stream.getReader();

try {
  while (true) {
    const { value, done } = await reader.read();

    if (value) {
      const parsed = await parkhi.feed(value);
      if (parsed) {
        console.log("parsed metadata");
        await printMetadata();
        break;
      }
    }

    if (done) {
      const parsed = await parkhi.feed(null);
      if (parsed) {
        console.log("parsed metadata");
        await printMetadata();
        break;
      }
    }
  }
} catch (error) {
  if (error instanceof ParkhiError) {
    if (error.code == ErrorCode.Unknown) {
      console.log("no parser is able to parse the data", error.message);
    } else if (error.code == ErrorCode.Corrupt) {
      console.log("media data is corrupt", error.message);
    } else {
      console.log("something went wrong, please report to Parkhi", error.message);
    }
  }
}

async function printMetadata() {
  const metadata = await parkhi.getMetadata();

  console.log(metadata!.name);
  console.log(metadata!.authors);
  console.log(metadata!.cover);

  for (const chapter of metadata!.chapters) {
    console.log(chapter.name, chapter.position);
  }
}
```

Parkhi has multiple parsers and can also be extended with [custom parsers](#customParsers). By
default, it runs your data through all the available parsers. Each parser, if the data is of its
intended format continues to accept the fed data. However, if the data looks odd to it, it will bail
out. Finally there must be a single parser if the media data is supported by Parkhi. If no parser
can handle the data, then `Parkhi` throws a [`ParkhiError`](#errorHandling).

If you know the type of media in advance, then it might be efficient to ask `Parkhi` to only use
those specific parsers.

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

## Feeding data

<a name="feedingData"></a>

`Parkhi` feeds on
[`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).
You can either pass the entire media's data in one-go or pass it chunk by chunk. However, when you
pass chunk by chunk, remember that the flow must be sequential. That is, you can not pass the first
10 bytes first and then pass last 20 bytes, then pass middle 30 bytes. It is fine to pass empty
chunk though.

Once the media data has been completely fed, feed `null` to signal end of data.

```typescript
import { Parkhi } from "@mitikaIn/parkhi";

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

The data passed to `Parkhi` must not be changed after feeding. That is, do not do the following.

```typescript
import { Parkhi } from "@mitikaIn/parkhi";

const parkhi = new Parkhi();

const data = new Uint8Array([0, 2, 2]);
await parkhi.feed(data);

// Do not do this.
data[1] = 1;
```

`Parkhi` may not require the entire file to parse metadata. For example, if the metadata is located
at the first 10 bytes of a file, then it is not required to continue feeding the remaining data.

As a result, [`Parkhi.feed`](./api.md#parkhiFeed) returns `true` if the parsing is complete. After
that, you can retrieve the metadata. On the other hand, `false` means more data is required.

```typescript
import { Parkhi } from "@mitikaIn/parkhi";

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

Even though `Parkhi`'s methods are asynchronous in nature, the parsing logic might have synchronous
flows. Therefore, to avoid blocking UI or the other parts of the software, it is suggested to run
Parkhi in a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).

## Error handling

<a name="errorHandling"></a>

All the errors thrown out of Parkhi is encapsulated as a single class called
[`ParkhiError`](./api.md#parkhiError). To know what the error is about, use
[`ParkhiError.code`](./api.md#parkhiErrorCode).

The error codes that you might be interested in are [`ErrorCode.Corrupt`](./api.md#errorCodeCorrupt)
and [`ErrorCode.Unknown`](./api.md#errorCodeUnknown).

`ErrorCode.Corrupt` is thrown when the media data is found corrupt. For example, if the frame size
does not match the expected size. `ErrorCode.Unknown` is thrown when `Parkhi` does not have any
parser which can parse from the media data.

Finally, there is [`ErrorCode.Internal`](./api.md#errorCodeInternal) which points to an internal
issue in Parkhi. Please report it to us.

Whenever an error is thrown, any more feeding of data results in undefined behavior.

```typescript
import { ErrorCode, Parkhi, ParkhiError } from "@mitikaIn/parkhi";

const blob = myBlob;
const parkhi = new Parkhi();

try {
  await parkhi.feed(blob);
} catch (e) {
  if (e instanceof ParkhiError) {
    if (e.code == ErrorCode.Corrupt) {
      console.error("The media data is corrupted.");
    } else if (e.code == ErrorCode.Internal) {
      console.error("Oops something went wrong, please report.");
    } else if (e.code == ErrorCode.Unknown) {
      console.error("The media data is unknown.");
    }
  } else {
    console.error("Oops something went wrong, please surely repor.t");
  }
}
```

## Custom parsers

<a name="customParsers"></a>

Custom parsers can be used when Parkhi's builtin parsers are insufficient or for an unsupported
metadata type. All parsers must implement the [`Parser`](./api.md#parser) interface. Though not
necessary, [`Buffer`](./api.md#buffer) can be useful while implementing an parser.

After creating the parser, pass it to `customParsers` parameter of
[`Parkhi`](./api.md#parkhiConstructor).

```typescript
import { Buffer, type Metadata, Parkhi, type Parser, ParserType } from "@mitikaIn/parkhi";

class MyParser implements Parser {
  private buffer = new Buffer();

  async feed(chunk: Uint8Array | null): Promise<boolean> {
    // Do something with the chunk.
    this.buffer.push(chunk);
    return false;
  }

  async getMetadata(): Promise<Metadata | null> {
    // Return the parseed metadata.
    return null;
  }
}

let parserType = ParserType.All;

// If MyParser replaces a builtin parser, then disable the builtin parser
parserType = ParserType.All & ~ParserType.Id3V23;
// Else, leave it to default or Parser.None to disable all builtin parsers.

const parkhi = new Parkhi(parserType, [MyParser]);
```

# Parkhi

Parkhi is a free and open source TypeScript and JavaScript library to extract metadata from media
files. Parkhi can currently extract title, authors, cover picture and chapter information of
different metadata formats.

Parkhi is made primarily for [Mitika](https://github.com/mitikaIn/mitika) and so supports very
minimal features and aims to be small and simple. As a result, Parkhi is free of third-party runtime
dependencies and makes best use of browser/runtime features whenever possible.

```typescript
import { Parkhi } from "@mitikaIn/parkhi";

const parkhi = new Parkhi();

const data = dataFromSomeSource();
await parkhi.feed(data);

const metadata = await parkhi.getMetadata();
console.log("Metadata:", metadata);
```

Please check [`ParserType`](./api.md#parserType) to know the available builtin parsers.

Parkhi means a discerning examiner in
[Hindi](https://www.collinsdictionary.com/dictionary/hindi-english/%E0%A4%AA%E0%A4%BE%E0%A4%B0%E0%A4%96%E0%A5%80).

## Documentation

To know if Parkhi is good for your use case, how to install, use and extend it, please check the
[documentation](./docs).

## Getting started

First do the debug build to get tests and CLI.

```sh
$ npm run build:debug
```

The built files now will be located in `build/debug` directory.

### Running tests

Parkhi uses [Node's builtin test framework](https://nodejs.org/api/test.html). You can invoke it
directly or use the shortcut `npm run test`.

```sh
$ npm run test
```

### Testing with a media file

To test Parkhi directly with a media file, the CLI tool can be useful. It is located at
`build/debug/src/cli.js`.

```sh
$ node build/debug/src/cli.js /path/to/media/file
```

### Building for release

The release build excludes tests and CLI. Invoke a release build by using `npm run build:release`.

```sh
$ npm run build:release
```

`build/release` will now have the built files.

## License

Parkhi is licensed under [MIT License](./LICENSE).

# Parkhi

Parkhi is a free and open source TypeScript and JavaScript library to extract
metadata from media files. Parkhi can currently extract title, authors, cover
and chapter information of different metadata formats.

Parkhi is made primarily for [Mitika](https://github.com/mitika-in/mitika) and
so supports very minimal features and aims to be small and simple. As a result,
Parkhi is free of third-party runtime dependencies and makes best use of
browser/runtime features whenever possible.

```typescript
import { Parkhi } from "@mitika-in/parkhi";

const parkhi = new Parkhi();

const data = dataFromSomeSource();
await parkhi.feed(data);

const metadata = await parkhi.getMetadata();
console.log("Metadata:", metadata);
```

Please check [`ExtractorType`](./api.md#extractorType) to know the available
builtin extractors.

Parkhi means a discerning examiner in
[Hindi](https://www.collinsdictionary.com/dictionary/hindi-english/%E0%A4%AA%E0%A4%BE%E0%A4%B0%E0%A4%96%E0%A5%80).

## Documentation

To know if Parkhi is good for your use case, how to install, use and extend it,
please check the [documentation](./docs).

## License

Parkhi is licensed under [MIT License](./LICENSE).

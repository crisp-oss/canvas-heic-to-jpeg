# HEIC to JPEG

[![Test and Build](https://github.com/crisp-oss/heic-to-jpeg/actions/workflows/test.yml/badge.svg)](https://github.com/crisp-oss/heic-to-jpeg/actions/workflows/test.yml) [![Version](https://img.shields.io/npm/v/canvas-heic-to-jpeg.svg)](https://www.npmjs.com/package/canvas-heic-to-jpeg) [![Downloads](https://img.shields.io/npm/dt/canvas-heic-to-jpeg.svg)](https://www.npmjs.com/package/canvas-heic-to-jpeg) [![License](https://img.shields.io/npm/l/canvas-heic-to-jpeg.svg)](./LICENSE)

Tiny zero-dependency HEIC/HEIF to JPEG converter for the browser, backed by the native canvas pipeline. Designed for **Safari on iOS**, where WebKit decodes HEIC natively — no WASM, no 2 MB polyfill.

Copyright 2026 Crisp IM SAS. See LICENSE for copying information.

* **🎯 Target**: Safari 13+ (desktop), Safari on iOS 13+ (mobile)
* **📦 Size**: < 4 KB minified, zero dependencies
* **🔋 Powered by**: `HTMLImageElement` + `<canvas>` + `canvas.toBlob()`
* **😘 Maintainer**: [@baptistejamin](https://github.com/baptistejamin)

## Why?

Every other HEIC-to-JPEG library ships a WASM decoder (libheif, ~2 MB) to support Chrome and Firefox. If your users are on **iOS Safari** — which is the only place HEIC files actually come from — that decoder is already built into the browser. This library leverages it through the standard canvas API and stays minimal.

**Trade-off:** this library does NOT work on Chrome, Firefox or Edge, because those browsers can't decode HEIC natively. If you need universal browser support, use a WASM-based library instead.

## Installation

```bash
npm install --save canvas-heic-to-jpeg
```

Or load it directly in a `<script type="module">`:

```html
<script type="module">
  import HeicToJpeg from "./node_modules/canvas-heic-to-jpeg/dist/heic-to-jpeg.js";
</script>
```

## Quick start

```js
import HeicToJpeg from "canvas-heic-to-jpeg";

const converter = new HeicToJpeg();

converter.setQuality(0.9);
converter.setMaxDimensions(2048, 2048);

// From a <input type="file">
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];

  if (converter.isHeic(file)) {
    const jpegBlob = await converter.convert(file);

    preview.src = URL.createObjectURL(jpegBlob);
  }
});
```

## API Reference

### Constructor

```js
const converter = new HeicToJpeg();
```

### Configuration setters

All setters are chainable-style (they return `void`), meant to be called once during setup.

| Method                                                          | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `setQuality(quality: number)`                                   | JPEG quality between `0` and `1`. Default: `0.92`.              |
| `setMimeType("image/jpeg" \| "image/png" \| "image/webp")`      | Output MIME type. Default: `image/jpeg`.                        |
| `setMaxDimensions(maxWidth: number \| null, maxHeight: number \| null)` | Max output dimensions (aspect ratio preserved).         |
| `setBackgroundColor(color: string)`                             | Background color used to flatten transparency for JPEG output. Default: `#ffffff`. |

### Conversion methods

All conversion methods accept the same `HeicSource` input and an optional per-call `ConvertOptions` override.

```ts
type HeicSource = Blob | File | ArrayBuffer | Uint8Array | string;

type ConvertOptions = {
  quality?:         number;
  maxWidth?:        number;
  maxHeight?:       number;
  mimeType?:        "image/jpeg" | "image/png" | "image/webp";
  backgroundColor?: string;
};
```

| Method                                                                 | Returns           | Use case                       |
| ---------------------------------------------------------------------- | ----------------- | ------------------------------ |
| `convert(source, options?)`                                            | `Promise<Blob>`   | Most flexible (upload, store). |
| `convertToObjectURL(source, options?)`                                 | `Promise<string>` | Display in `<img>`.            |
| `convertToDataURL(source, options?)`                                   | `Promise<string>` | Embed in JSON, localStorage.   |
| `convertToFile(source, fileName: string, options?)`                    | `Promise<File>`   | Upload via `FormData`.         |

### Helpers

| Method                          | Returns   | Description                                        |
| ------------------------------- | --------- | -------------------------------------------------- |
| `isHeic(source: Blob \| File \| string)` | `boolean` | Detects `.heic`/`.heif` extension or MIME type. |

## Examples

### Convert a file input and preview it

```js
const converter = new HeicToJpeg();

input.addEventListener("change", async () => {
  const url = await converter.convertToObjectURL(input.files[0]);

  image.src = url;
});
```

### Upload to a server as JPEG

```js
const converter = new HeicToJpeg();
const jpegFile  = await converter.convertToFile(heicFile, "photo.jpg");

const form = new FormData();
form.append("photo", jpegFile);

await fetch("/api/upload", { method: "POST", body: form });
```

### Resize while converting (thumbnails)

```js
const converter = new HeicToJpeg();
const thumb     = await converter.convert(file, {
  quality:   0.7,
  maxWidth:  512,
  maxHeight: 512
});
```

### Convert from a URL

```js
const blob = await converter.convert("/photos/IMG_1234.HEIC");
```

### Graceful fallback

```js
const source = converter.isHeic(file) ? await converter.convert(file) : file;
```

## Browser support

| Browser               | Support                  |
| --------------------- | ------------------------ |
| Safari (iOS 13+)      | ✅ Works natively        |
| Safari (macOS 13+)    | ✅ Works natively        |
| Chrome / Edge         | ❌ No native HEIC decoder|
| Firefox               | ❌ No native HEIC decoder|

Use `converter.isHeic(file)` + a `try/catch` to provide a graceful degradation path on unsupported browsers.

## Development

```bash
# Build TypeScript to ESM
npm run build

# Lint
npm test

# Run the local demo
npx http-server . -p 8080 -c-1
# Open http://localhost:8080/examples/convert-file-input.html in Safari
```

To test on a real iPhone, expose the local server via `ngrok http 8080` and open the HTTPS URL on the device.

## License

MIT — see [LICENSE](./LICENSE).

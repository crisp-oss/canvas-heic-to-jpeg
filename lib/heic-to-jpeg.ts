/*
 * This file is part of heic-to-jpeg
 *
 * Copyright (c) 2026 Crisp IM SAS
 * All rights belong to Crisp IM SAS
 */

/**************************************************************************
 * TYPES
 ***************************************************************************/

export type HeicSource = Blob | File | ArrayBuffer | Uint8Array | string;

export type ConvertOptions = {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  backgroundColor?: string;
};

/**************************************************************************
 * CONSTANTS
 ***************************************************************************/

const DEFAULT_QUALITY = 0.92;
const DEFAULT_MIME_TYPE = "image/jpeg";
const DEFAULT_BACKGROUND_COLOR = "#ffffff";

const MIN_QUALITY = 0;
const MAX_QUALITY = 1;

const HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence"
];

const HEIC_EXTENSIONS = [
  ".heic",
  ".heif"
];

/**************************************************************************
 * CLASSES
 ***************************************************************************/

/**
 * HeicToJpeg
 */
class HeicToJpeg {
  private _quality: number = DEFAULT_QUALITY;
  private _mimeType: string = DEFAULT_MIME_TYPE;
  private _maxWidth: number | null = null;
  private _maxHeight: number | null = null;
  private _backgroundColor: string = DEFAULT_BACKGROUND_COLOR;

  /**
   * Sets the output quality (between 0 and 1)
   */
  setQuality(quality: number) {
    if (typeof quality !== "number" || isNaN(quality)) {
      throw new Error(
        "[HeicToJpeg] setQuality: parameter quality should be a number"
      );
    }

    if (quality < MIN_QUALITY || quality > MAX_QUALITY) {
      throw new Error(
        "[HeicToJpeg] setQuality: parameter quality should be between "  +
          MIN_QUALITY + " and " + MAX_QUALITY
      );
    }

    this._quality = quality;
  }

  /**
   * Sets the output MIME type
   */
  setMimeType(mimeType: "image/jpeg" | "image/png" | "image/webp") {
    if (typeof mimeType !== "string") {
      throw new Error(
        "[HeicToJpeg] setMimeType: parameter mimeType should be a string"
      );
    }

    this._mimeType = mimeType;
  }

  /**
   * Sets the maximum output dimensions (aspect ratio is preserved)
   */
  setMaxDimensions(maxWidth: number | null, maxHeight: number | null) {
    if (maxWidth !== null && (typeof maxWidth !== "number" || maxWidth <= 0)) {
      throw new Error(
        "[HeicToJpeg] setMaxDimensions: parameter maxWidth should be a "  +
          "positive number or null"
      );
    }

    if (
      maxHeight !== null && (typeof maxHeight !== "number" || maxHeight <= 0)
    ) {
      throw new Error(
        "[HeicToJpeg] setMaxDimensions: parameter maxHeight should be a "  +
          "positive number or null"
      );
    }

    this._maxWidth  = maxWidth;
    this._maxHeight = maxHeight;
  }

  /**
   * Sets the background color used behind transparent pixels (JPEG only)
   */
  setBackgroundColor(color: string) {
    if (typeof color !== "string") {
      throw new Error(
        "[HeicToJpeg] setBackgroundColor: parameter color should be a string"
      );
    }

    this._backgroundColor = color;
  }

  /**
   * Returns whether the provided source looks like a HEIC/HEIF image
   */
  isHeic(source: Blob | File | string): boolean {
    if (typeof source === "string") {
      const lower = source.toLowerCase();

      return HEIC_EXTENSIONS.some((extension) => {
        return lower.endsWith(extension);
      });
    }

    // Blob / File
    if (source && typeof (source as Blob).type === "string") {
      const type = (source as Blob).type.toLowerCase();

      if (HEIC_MIME_TYPES.indexOf(type) !== -1) {
        return true;
      }

      // Fall back to filename (some browsers expose an empty MIME type)
      const name = (source as File).name;

      if (typeof name === "string") {
        const lowerName = name.toLowerCase();

        return HEIC_EXTENSIONS.some((extension) => {
          return lowerName.endsWith(extension);
        });
      }
    }

    return false;
  }

  /**
   * Converts a HEIC source to a JPEG Blob (via the browser canvas)
   */
  convert(source: HeicSource, options?: ConvertOptions): Promise<Blob> {
    const localOptions = (options || {});

    const quality = (
      (typeof localOptions.quality === "number")  ?
        localOptions.quality : this._quality
    );

    const mimeType = (localOptions.mimeType || this._mimeType);

    const maxWidth = (
      (typeof localOptions.maxWidth === "number")  ?
        localOptions.maxWidth : this._maxWidth
    );

    const maxHeight = (
      (typeof localOptions.maxHeight === "number")  ?
        localOptions.maxHeight : this._maxHeight
    );

    const backgroundColor = (
      localOptions.backgroundColor || this._backgroundColor
    );

    // Track the object URL so we can revoke it once the image has loaded (we \
    //   must not leak blob URLs on the mobile Safari target)
    let objectUrl: string | null = null;

    return Promise.resolve()
      .then(() => {
        return this.__normalizeToBlob(source);
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);

        return this.__loadImage(objectUrl);
      })
      .then((image) => {
        const canvas = this.__drawToCanvas(
          image, maxWidth, maxHeight, mimeType, backgroundColor
        );

        return this.__canvasToBlob(canvas, mimeType, quality);
      })
      .then((blob) => {
        if (objectUrl !== null) {
          URL.revokeObjectURL(objectUrl);

          objectUrl = null;
        }

        return blob;
      })
      .catch((error) => {
        if (objectUrl !== null) {
          URL.revokeObjectURL(objectUrl);

          objectUrl = null;
        }

        throw error;
      });
  }

  /**
   * Converts a HEIC source and returns a blob: object URL
   */
  convertToObjectURL(
    source: HeicSource, options?: ConvertOptions
  ): Promise<string> {
    return this.convert(source, options)
      .then((blob) => {
        return URL.createObjectURL(blob);
      });
  }

  /**
   * Converts a HEIC source and returns a data: URL
   */
  convertToDataURL(
    source: HeicSource, options?: ConvertOptions
  ): Promise<string> {
    return this.convert(source, options)
      .then((blob) => {
        return this.__blobToDataURL(blob);
      });
  }

  /**
   * Converts a HEIC source and returns a File (useful for form submissions)
   */
  convertToFile(
    source: HeicSource, fileName: string, options?: ConvertOptions
  ): Promise<File> {
    if (typeof fileName !== "string" || fileName.length === 0) {
      throw new Error(
        "[HeicToJpeg] convertToFile: parameter fileName should be a "  +
          "non-empty string"
      );
    }

    return this.convert(source, options)
      .then((blob) => {
        return new File([blob], fileName, {
          type: blob.type,

          lastModified: Date.now()
        });
      });
  }

  /**
   * Normalizes an arbitrary source to a Blob
   */
  private __normalizeToBlob(source: HeicSource): Promise<Blob> {
    if (source instanceof Blob) {
      return Promise.resolve(source);
    }

    if (source instanceof ArrayBuffer) {
      return Promise.resolve(new Blob([source]));
    }

    if (source instanceof Uint8Array) {
      // Notice: wrap into a fresh ArrayBuffer to avoid narrowing issues with \
      //   SharedArrayBuffer-backed views reported by TypeScript
      return Promise.resolve(new Blob([source.slice().buffer]));
    }

    if (typeof source === "string") {
      return fetch(source)
        .then((response) => {
          if (response.ok !== true) {
            throw new Error(
              "[HeicToJpeg] fetch failed with status: " + response.status
            );
          }

          return response.blob();
        });
    }

    return Promise.reject(
      new Error("[HeicToJpeg] convert: unsupported source type")
    );
  }

  /**
   * Loads an image from a URL (wraps the HTMLImageElement load events)
   */
  private __loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      // Required for images that may be served from a different origin (the \
      //   canvas would otherwise be tainted and toBlob() would fail)
      image.crossOrigin = "anonymous";
      image.decoding    = "async";

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            "[HeicToJpeg] failed to decode image source (is HEIC "  +
              "supported by this browser?)"
          )
        );
      };

      image.src = url;
    });
  }

  /**
   * Draws an image to a canvas, applying max dimensions and background
   */
  private __drawToCanvas(
    image: HTMLImageElement,
    maxWidth: number | null,
    maxHeight: number | null,
    mimeType: string,
    backgroundColor: string
  ): HTMLCanvasElement {
    const sourceWidth  = (image.naturalWidth || image.width);
    const sourceHeight = (image.naturalHeight || image.height);

    if (sourceWidth === 0 || sourceHeight === 0) {
      throw new Error(
        "[HeicToJpeg] decoded image has zero width or height"
      );
    }

    const scaled = this.__computeTargetSize(
      sourceWidth, sourceHeight, maxWidth, maxHeight
    );

    const canvas = document.createElement("canvas");

    canvas.width  = scaled.width;
    canvas.height = scaled.height;

    const context = canvas.getContext("2d");

    if (context === null) {
      throw new Error(
        "[HeicToJpeg] failed to acquire a 2D rendering context"
      );
    }

    // JPEG does not support transparency, so flatten onto a solid background
    if (mimeType === "image/jpeg") {
      context.fillStyle = backgroundColor;

      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  /**
   * Computes the target size respecting the aspect ratio
   */
  private __computeTargetSize(
    sourceWidth: number,
    sourceHeight: number,
    maxWidth: number | null,
    maxHeight: number | null
  ): { width: number; height: number } {
    let width  = sourceWidth;
    let height = sourceHeight;

    if (maxWidth !== null && width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width  = maxWidth;
    }

    if (maxHeight !== null && height > maxHeight) {
      width  = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    return {
      width: Math.max(1, width),

      height: Math.max(1, height)
    };
  }

  /**
   * Exports a canvas as a Blob of the requested MIME type
   */
  private __canvasToBlob(
    canvas: HTMLCanvasElement, mimeType: string, quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            return reject(
              new Error(
                "[HeicToJpeg] canvas.toBlob() returned no blob (MIME type "  +
                  "possibly unsupported: '" + mimeType + "')"
              )
            );
          }

          return resolve(blob);
        },

        mimeType,
        quality
      );
    });
  }

  /**
   * Reads a Blob as a base64 data URL
   */
  private __blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          return resolve(reader.result);
        }

        return reject(
          new Error("[HeicToJpeg] FileReader did not return a string result")
        );
      };

      reader.onerror = () => {
        reject(
          reader.error  ||
            new Error("[HeicToJpeg] FileReader failed to read blob")
        );
      };

      reader.readAsDataURL(blob);
    });
  }
}

/**************************************************************************
 * EXPORTS
 ***************************************************************************/

export default HeicToJpeg;

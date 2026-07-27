import "server-only";

import { createHash } from "node:crypto";

import sharp from "sharp";

export const maximumFieldPhotoBytes = 1_572_864;
export const maximumFieldPhotoEdge = 1_600;
export const maximumFieldPhotoPixels = 25_000_000;
export const maximumUploadedPhotoBytes = 12 * 1_024 * 1_024;

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

type SanitizedImage = {
  data: Buffer;
  width: number;
  height: number;
  sha256: Buffer;
};

type ImageErrorCode =
  | "IMAGE_EMPTY"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_TYPE_UNSUPPORTED"
  | "IMAGE_INVALID"
  | "IMAGE_OUTPUT_TOO_LARGE";

function imageError(code: ImageErrorCode, message: string) {
  return { code, message };
}

function signatureMatches(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    return (
      buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
      ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)
    );
  }

  return false;
}

export async function sanitizeFieldPhoto(
  source: Buffer,
  declaredMimeType: string,
):
  Promise<
    | { ok: true; data: SanitizedImage }
    | {
        ok: false;
        error: { code: ImageErrorCode; message: string };
      }
  > {
  const mimeType = declaredMimeType.toLowerCase();

  if (source.length === 0) {
    return {
      ok: false,
      error: imageError("IMAGE_EMPTY", "Fotoğraf seçilmedi."),
    };
  }

  if (source.length > maximumUploadedPhotoBytes) {
    return {
      ok: false,
      error: imageError(
        "IMAGE_TOO_LARGE",
        "Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.",
      ),
    };
  }

  if (!acceptedMimeTypes.has(mimeType) || !signatureMatches(source, mimeType)) {
    return {
      ok: false,
      error: imageError(
        "IMAGE_TYPE_UNSUPPORTED",
        "Fotoğraf biçimi okunamadı. JPEG, PNG, HEIC veya WebP kullanın.",
      ),
    };
  }

  try {
    const pipeline = sharp(source, {
      failOn: "error",
      limitInputPixels: maximumFieldPhotoPixels,
      sequentialRead: true,
    });
    const metadata = await pipeline.metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > maximumFieldPhotoPixels
    ) {
      return {
        ok: false,
        error: imageError(
          "IMAGE_INVALID",
          "Fotoğraf çözünürlüğü güvenli sınırı aşıyor.",
        ),
      };
    }

    for (const quality of [82, 70, 55]) {
      const result = await sharp(source, {
        failOn: "error",
        limitInputPixels: maximumFieldPhotoPixels,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: maximumFieldPhotoEdge,
          height: maximumFieldPhotoEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: "4:2:0",
        })
        .toBuffer({ resolveWithObject: true });

      if (
        result.data.length <= maximumFieldPhotoBytes &&
        result.info.width <= maximumFieldPhotoEdge &&
        result.info.height <= maximumFieldPhotoEdge
      ) {
        return {
          ok: true,
          data: {
            data: result.data,
            width: result.info.width,
            height: result.info.height,
            sha256: createHash("sha256").update(result.data).digest(),
          },
        };
      }
    }

    return {
      ok: false,
      error: imageError(
        "IMAGE_OUTPUT_TOO_LARGE",
        "Fotoğraf güvenli boyuta küçültülemedi. Başka bir fotoğraf seçin.",
      ),
    };
  } catch {
    return {
      ok: false,
      error: imageError(
        "IMAGE_INVALID",
        "Fotoğraf bozuk veya güvenli biçimde okunamadı.",
      ),
    };
  }
}

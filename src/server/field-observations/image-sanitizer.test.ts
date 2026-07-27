// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import {
  maximumFieldPhotoBytes,
  maximumFieldPhotoEdge,
  sanitizeFieldPhoto,
} from "./image-sanitizer";

describe("saha fotoğrafı doğrulama ve metadata temizliği", () => {
  it("JPEG'i döndürür, küçültür ve EXIF metadata'sını kaldırır", async () => {
    const source = await sharp({
      create: {
        width: 2_400,
        height: 1_800,
        channels: 3,
        background: "#245c44",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await sanitizeFieldPhoto(source, "image/jpeg");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const metadata = await sharp(result.data.data).metadata();

    expect(Math.max(result.data.width, result.data.height)).toBeLessThanOrEqual(
      maximumFieldPhotoEdge,
    );
    expect(result.data.data.length).toBeLessThanOrEqual(maximumFieldPhotoBytes);
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(result.data.sha256).toHaveLength(32);
  });

  it("PNG kaynağını metadata'sız JPEG'e dönüştürür", async () => {
    const source = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 4,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const result = await sanitizeFieldPhoto(source, "image/png");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((await sharp(result.data.data).metadata()).format).toBe("jpeg");
    }
  });

  it("HEIC/HEIF konteyner kaynağını metadata'sız JPEG'e dönüştürür", async () => {
    const source = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: "#d7a640",
      },
    })
      .avif()
      .toBuffer();
    Buffer.from("heic").copy(source, 8);

    const result = await sanitizeFieldPhoto(source, "image/heic");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const metadata = await sharp(result.data.data).metadata();

      expect(metadata.format).toBe("jpeg");
      expect(metadata.exif).toBeUndefined();
    }
  });

  it("sahte MIME, bozuk dosya ve piksel bombasını reddeder", async () => {
    const png = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "#000000",
      },
    })
      .png()
      .toBuffer();
    const pixelBomb = await sharp({
      create: {
        width: 5_100,
        height: 5_100,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    expect(await sanitizeFieldPhoto(png, "image/jpeg")).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(
      await sanitizeFieldPhoto(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(await sanitizeFieldPhoto(pixelBomb, "image/png")).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  it("12 MiB kaynak sınırını imzadan sonra içerik okumadan reddeder", async () => {
    const oversized = Buffer.alloc(12 * 1_024 * 1_024 + 1);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    expect(await sanitizeFieldPhoto(oversized, "image/jpeg")).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "IMAGE_TOO_LARGE" }),
    });
  });
});

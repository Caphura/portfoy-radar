"use client";

const maximumBytes = 1_572_864;
const maximumEdge = 1_600;

export async function prepareFieldPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Fotoğraf biçimi okunamadı.");
  }

  if (file.size > 12 * 1_024 * 1_024) {
    throw new Error("Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.");
  }

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Bu cihaz fotoğrafı küçültemedi. JPEG veya PNG olarak yeniden deneyin.",
    );
  }

  const scale = Math.min(1, maximumEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    bitmap.close();
    throw new Error("Fotoğraf bu cihazda hazırlanamadı.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (blob && blob.size <= maximumBytes) {
      return new File([blob], "saha-fotografi.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  throw new Error(
    "Fotoğraf güvenli boyuta küçültülemedi. Başka bir fotoğraf seçin.",
  );
}

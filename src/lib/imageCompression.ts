// Browser-native image compression for SolenOS.
// No Vite-only or third-party runtime dependency is required.
export async function compressImage(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
    compressForce?: boolean;
    rotate?: boolean;
  } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image");
  }

  const maxSizeMB = options.maxSizeMB ?? 0.5;
  const maxDimension = options.maxWidthOrHeight ?? 2000;
  const initialQuality = options.initialQuality ?? 0.8;

  if (file.size <= maxSizeMB * 1024 * 1024 && !options.compressForce) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const targetBytes = maxSizeMB * 1024 * 1024;
    let quality = Math.min(1, Math.max(0.2, initialQuality));
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > targetBytes && quality > 0.25) {
      quality = Math.max(0.25, quality - 0.15);
      blob = await canvasToBlob(canvas, quality);
    }
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const normalizedBlob = blob.type === outputType ? blob : await canvasToBlob(canvas, quality, outputType);
    return new File([normalizedBlob], file.name, {
      type: normalizedBlob.type || outputType,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.warn("Image compression unavailable; preserving original image.", error);
    return file;
  } finally {
    bitmap?.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number, type = "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Browser could not encode this image.")),
      type,
      quality,
    );
  });
}

export function calculateSizeReduction(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

export function dataURLtoFile(dataURL: string, filename: string): File {
  const parts = dataURL.split(",");
  const mime = parts[0]?.match(/:(.*?);/)?.[1];
  if (!mime || !parts[1]) throw new Error("Invalid image data.");
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

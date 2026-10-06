import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ValidatedProductImage = {
  bytes: Buffer;
  extension: "jpg" | "png" | "webp";
};

export async function validateProductImage(file: File): Promise<ValidatedProductImage> {
  if (!acceptedTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size === 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("Image must be 5 MB or smaller.");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new Error("The selected image is empty.");
  if (bytes.length > MAX_PRODUCT_IMAGE_BYTES) throw new Error("Image must be 5 MB or smaller.");

  const extension = detectImageExtension(bytes);
  if (!extension) throw new Error("The selected file is not a supported JPEG, PNG, or WebP image.");
  const expectedType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  if (file.type !== expectedType) throw new Error("The image content does not match its declared file type.");

  return { bytes, extension };
}

function detectImageExtension(bytes: Uint8Array): ValidatedProductImage["extension"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((value, index) => bytes[index] === value)) return "png";

  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";

  return null;
}

export async function storeProductImage(bytes: Buffer, extension: ValidatedProductImage["extension"]) {
  const directory = path.resolve(process.cwd(), "public", "uploads", "products");
  await mkdir(directory, { recursive: true });

  // Reject a symlinked target directory so uploads cannot be redirected outside the app folder.
  if (await realpath(directory) !== directory) throw new Error("The product image upload directory is not safe.");

  const fileName = `${randomUUID()}.${extension}`;
  const filePath = path.join(directory, fileName);
  try {
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    try {
      await unlink(filePath);
    } catch {
      // A failed exclusive write may not have created a file.
    }
    throw error;
  }
  return {
    filePath,
    url: `/uploads/products/${fileName}`,
  };
}

export async function removeNewProductImage(filePath: string) {
  const directory = path.resolve(process.cwd(), "public", "uploads", "products");
  if (path.dirname(filePath) !== directory) throw new Error("Refusing to remove a file outside the product upload directory.");
  await unlink(filePath);
}

export async function removeOwnedProductImageUrl(url: string) {
  const match = /^\/uploads\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i.exec(url);
  if (!match) return false;

  const directory = path.resolve(process.cwd(), "public", "uploads", "products");
  try {
    if (await realpath(directory) !== directory) throw new Error("The product image upload directory is not safe.");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return true;
    throw error;
  }
  const filePath = path.join(directory, match[1]);
  if (path.dirname(filePath) !== directory) throw new Error("Refusing to remove a file outside the product upload directory.");
  try {
    await unlink(filePath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return true;
    throw error;
  }
  return true;
}

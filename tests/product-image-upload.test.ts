import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  removeNewProductImage,
  removeOwnedProductImageUrl,
  storeProductImage,
  validateProductImage,
} from "@/lib/admin/product-image-upload";

test("product image validation accepts JPEG, PNG, and WebP signatures when declared MIME matches", async () => {
    const samples = [
      { type: "image/jpeg", extension: "jpg", bytes: [0xff, 0xd8, 0xff, 0x00] },
      { type: "image/png", extension: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { type: "image/webp", extension: "webp", bytes: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50] },
    ] as const;

    for (const sample of samples) {
      const result = await validateProductImage(new File([Uint8Array.from(sample.bytes)], `original.${sample.extension}`, { type: sample.type }));
      assert.equal(result.extension, sample.extension);
    }
});

test("product image validation rejects unsupported declared types and content/MIME mismatches", async () => {
    await assert.rejects(
      validateProductImage(new File(["<svg></svg>"], "image.svg", { type: "image/svg+xml" })),
      /JPEG, PNG, or WebP/,
    );
    await assert.rejects(
      validateProductImage(new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "fake.jpg", { type: "image/jpeg" })),
      /does not match/,
    );
});

test("product image validation rejects empty files and files larger than 5 MiB", async () => {
    await assert.rejects(validateProductImage(new File([], "empty.png", { type: "image/png" })), /empty/);
    const oversized = new File([new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1)], "large.png", { type: "image/png" });
    await assert.rejects(validateProductImage(oversized), /5 MB or smaller/);
});

test("product image storage uses its public URL and removes only generated local files", async () => {
    const stored = await storeProductImage(Buffer.from([0xff, 0xd8, 0xff]), "jpg");
    try {
      assert.match(stored.url, /^\/uploads\/products\/[0-9a-f-]+\.jpg$/i);
      assert.equal(existsSync(stored.filePath), true);
      assert.equal(await removeOwnedProductImageUrl("https://images.example.test/item.jpg"), false);
      assert.equal(await removeOwnedProductImageUrl(stored.url), true);
      assert.equal(existsSync(stored.filePath), false);
    } finally {
      if (existsSync(stored.filePath)) await removeNewProductImage(stored.filePath);
    }
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Shrinks a picked photo to the one stored format (lib/photos/photo.schema.ts):
 * a 128×128 base64 JPEG. 128px covers the largest avatar (72dp) and keeps
 * Buscar light, since it reads every customer on each keystroke.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ValidationError } from "../errors/ValidationError";
import { photoSchema } from "./photo.schema";

/** JPEG qualities tried in order until the photo fits `MAX_PHOTO_CHARS`. */
export const PHOTO_QUALITIES = [0.7, 0.55, 0.4] as const;

const PHOTO_SIZE = 128;

/**
 * Returns the first encoding, from best to worst quality, that passes
 * `photoSchema` (at most 20,000 characters). Throws the schema's
 * ValidationError ("La foto es muy grande") when even the lowest fails.
 */
export async function pickEncoding(encode: (quality: number) => Promise<string>): Promise<string> {
  let lastError: ValidationError | null = null;
  for (const quality of PHOTO_QUALITIES) {
    const result = photoSchema.safeParse(await encode(quality));
    if (result.success) return result.data;
    lastError = new ValidationError(result.error);
  }
  throw lastError!;
}

/** Resizes the image at `uri` to 128×128 and encodes it as base64 JPEG. */
export async function encodePhoto(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri)
    .resize({ width: PHOTO_SIZE, height: PHOTO_SIZE })
    .renderAsync();
  return pickEncoding(async (quality) => {
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
      base64: true
    });
    return saved.base64 ?? "";
  });
}

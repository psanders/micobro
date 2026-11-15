/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The one door to the camera and the photo library. Screens and tests go
 * through here, never through expo-image-picker directly. The gallery uses
 * the system picker (Android photo picker / iOS PHPicker), which needs no
 * permission, so only the camera is ever asked for.
 */
import * as ImagePicker from "expo-image-picker";
import { encodePhoto } from "./encodePhoto";

export type PhotoSource = "camera" | "library";

export type PickPhotoResult =
  | { status: "picked"; photo: string }
  | { status: "canceled" }
  | { status: "denied"; canAskAgain: boolean };

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1
};

/**
 * Opens the camera or the gallery with a square crop, then encodes the
 * result (lib/photos/encodePhoto.ts). Rejects when the photo can't be
 * encoded.
 */
export async function pickPhoto(source: PhotoSource): Promise<PickPhotoResult> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { status: "denied", canAskAgain: permission.canAskAgain };
    }
    result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  }

  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: "canceled" };

  return { status: "picked", photo: await encodePhoto(asset.uri) };
}

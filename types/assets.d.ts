/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Metro resolves static image imports to an opaque asset reference
 * (a numeric module id) accepted by <Image source>.
 */
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";
  const source: ImageSourcePropType;
  export default source;
}

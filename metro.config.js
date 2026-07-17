const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withStorybook } = require("@storybook/react-native/withStorybook");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite) ships a .wasm file that it imports
// like a JS module. Metro only treats extensions listed in `assetExts` as
// static assets, so without this, `expo export --platform web` fails to
// resolve `./wa-sqlite/wa-sqlite.wasm` from expo-sqlite/web/worker.ts.
config.resolver.assetExts.push("wasm");

module.exports = withStorybook(config, {
  enabled: process.env.STORYBOOK_ENABLED === "true",
  configPath: path.resolve(__dirname, "./.storybook")
});

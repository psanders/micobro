/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Preview } from "@storybook/react-native";
import { View } from "react-native";

const preview: Preview = {
  decorators: [
    (Story) => (
      <View style={{ flex: 1, padding: 20, backgroundColor: "#F4FBF6" }}>
        <Story />
      </View>
    )
  ]
};

export default preview;

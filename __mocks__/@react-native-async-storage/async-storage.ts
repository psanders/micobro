/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * AsyncStorage has no native module under Jest. The package's own in-memory
 * mock, used for every test (Jest picks up root __mocks__ for node_modules).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = require("@react-native-async-storage/async-storage/jest/async-storage-mock");

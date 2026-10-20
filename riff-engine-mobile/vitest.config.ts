import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["engine/**/*.test.ts", "audio/**/*.test.ts", "store/**/*.test.ts", "lib/**/*.test.ts"],
    alias: {
      // Store tests exercise the real persist middleware; without a backing
      // store every write rejects and the failures are silently swallowed.
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "test/asyncStorageMock.ts",
      ),
    },
  },
});

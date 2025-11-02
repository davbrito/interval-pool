import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  platform: "neutral",
  target: "es2022",
  exports: true,
  entry: ["src/index.ts"],
});

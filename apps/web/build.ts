import baseConfig from "./build.config";

const isDev = process.argv.includes("--dev");

const config = {
  ...baseConfig,
  minify: !isDev,
  sourcemap: isDev ? "external" as const : undefined,
};

console.log(`🐰 Building for ${isDev ? "development" : "production"}...`);
const start = Date.now();

try {
  await Bun.build(config);
  console.log(`✨ Built in ${Date.now() - start}ms`);
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
} 
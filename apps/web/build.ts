import baseConfig from "./build.config";
import fs from "fs/promises";
import path from "path";

const isDev = process.argv.includes("--dev");

// Ensure dist directory exists
await fs.mkdir("dist", { recursive: true }).catch(() => {});

const config = {
  ...baseConfig,
  minify: !isDev,
  sourcemap: isDev ? "external" as const : undefined,
};

console.log(`🐰 Building for ${isDev ? "development" : "production"}...`);
console.log("Config:", JSON.stringify(config, null, 2));
console.log("Entry points:", config.entrypoints);
console.log("Output directory:", config.outdir);

const start = Date.now();

try {
  const result = await Bun.build(config);
  
  // Log build outputs
  console.log("\nBuild outputs:");
  for (const output of result.outputs) {
    console.log(`- ${output.path}`);
    // Write the output to disk
    await fs.writeFile(output.path, await output.text());
  }
  
  // Copy index.html to dist if it doesn't exist
  const indexHtml = await fs.readFile("index.html", "utf8");
  await fs.writeFile(path.join("dist", "index.html"), indexHtml);
  
  console.log(`\n✨ Built in ${Date.now() - start}ms`);
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
} 
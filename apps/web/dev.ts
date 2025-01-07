import { watch } from "fs";
import { join } from "path";

const BUILD_DIR = "./dist";
const PUBLIC_DIR = "./public";

// Build the app initially
console.log("🐰 Initial build...");
await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: BUILD_DIR,
  target: "browser",
  sourcemap: "external",
  minify: false
});

// Set up the dev server
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    
    // Try public files first
    let file = Bun.file(join(PUBLIC_DIR, filePath));
    if (!await file.exists()) {
      // Then try build directory
      file = Bun.file(join(BUILD_DIR, filePath));
      if (!await file.exists()) {
        // Fall back to index.html for SPA routing
        file = Bun.file(join(PUBLIC_DIR, "index.html"));
      }
    }
    
    return new Response(file);
  },
  websocket: {
    message(ws, message) {
      // Handle HMR messages
      console.log("WS message:", message);
    },
  },
});

// Watch for changes and rebuild
const watcher = watch("./src", { recursive: true }, async (event, filename) => {
  if (!filename) return;
  
  console.log(`🔄 Rebuilding due to changes in ${filename}...`);
  const start = Date.now();
  
  try {
    await Bun.build({
      entrypoints: ["./src/index.tsx"],
      outdir: BUILD_DIR,
      target: "browser",
      sourcemap: "external",
      minify: false
    });
    console.log(`✨ Rebuilt in ${Date.now() - start}ms`);
    
    // Notify clients to refresh
    server.publish("hmr", "reload");
  } catch (error) {
    console.error("Build failed:", error);
  }
});

console.log(`🚀 Dev server running at http://localhost:${server.port}`);

// Cleanup on exit
process.on("SIGINT", () => {
  watcher.close();
  process.exit(0);
});
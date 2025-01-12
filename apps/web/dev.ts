import { watch } from "fs";
import { join, extname } from "path";
import buildConfig from "./build.config";

// Build the app initially
console.log("🐰 Initial build...");
await Bun.build(buildConfig);

// Content type map
const contentTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const API_SERVER = "http://localhost:3000";

// Set up the dev server
const server = Bun.serve({
  port: 5173,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Proxy API requests to the API server
    if (url.pathname.startsWith('/api')) {
      const apiUrl = new URL(url.pathname + url.search, API_SERVER);
      return fetch(apiUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
    }
    
    const filePath = url.pathname;
    const ext = extname(filePath);
    
    // If requesting a file with a known extension (like .js, .css, etc)
    if (ext && contentTypes[ext]) {
      // Try root directory first
      let file = Bun.file(join(".", filePath));
      if (!await file.exists()) {
        // Then try build directory
        file = Bun.file(join("./dist", filePath));
        if (!await file.exists()) {
          return new Response("Not Found", { status: 404 });
        }
      }
      return new Response(file, {
        headers: {
          "Content-Type": contentTypes[ext]
        }
      });
    }
    
    // For all other requests (routes), serve index.html
    const indexFile = Bun.file("./index.html");
    return new Response(indexFile, {
      headers: {
        "Content-Type": "text/html"
      }
    });
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
    await Bun.build(buildConfig);
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
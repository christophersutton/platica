import { join } from "path";

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    
    // Try serving the file directly
    let file = Bun.file(join(".", filePath));
    if (!await file.exists()) {
      // Fall back to index.html for SPA routing
      file = Bun.file("./index.html");
    }
    
    return new Response(file);
  },
});

console.log(`🚀 Preview server running at http://localhost:${server.port}`); 
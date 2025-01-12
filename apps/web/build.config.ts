import type { BunPlugin } from "bun";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import fs from "fs/promises";
import path from "path";

let combinedCSS = '';

// CSS plugin for Bun
const cssPlugin: BunPlugin = {
  name: "css",
  async setup(build) {
    // Handle .css files
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      try {
        const css = await fs.readFile(args.path, "utf8");
        
        // Process with PostCSS (Tailwind + Autoprefixer)
        const result = await postcss([
          tailwindcss({
            config: path.resolve("./tailwind.config.ts")
          }),
          autoprefixer,
        ]).process(css, { 
          from: args.path,
          map: { inline: false }
        });

        // Append to combined CSS
        combinedCSS += result.css + '\n';

        // Ensure dist directory exists
        await fs.mkdir("dist", { recursive: true });

        // Write the combined CSS file
        await fs.writeFile("dist/index.css", combinedCSS);

        // Return empty JS that imports the CSS
        return {
          loader: "js",
          contents: `
            const style = document.createElement('style');
            style.textContent = ${JSON.stringify(result.css)};
            document.head.appendChild(style);
          `,
        };
      } catch (error) {
        console.error("CSS Processing Error:", error);
        return {
          loader: "js",
          errors: [{
            text: `CSS Processing Error: ${error.message}`,
            location: { file: args.path, line: 1, column: 1 }
          }],
          contents: ""
        };
      }
    });
  },
};

export default {
  entrypoints: ["./src/main.tsx"],
  plugins: [cssPlugin],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "external",
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production")
  },
  loader: {
    ".tsx": "tsx",
    ".ts": "tsx",
    ".jsx": "jsx",
    ".js": "jsx",
    ".css": "css",
  }
} as const; 
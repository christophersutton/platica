import type { BunPlugin } from "bun";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import fs from "fs/promises";

let combinedCSS = '';

// CSS plugin for Bun
const cssPlugin: BunPlugin = {
  name: "css",
  async setup(build) {
    // Handle .css files
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.readFile(args.path, "utf8");
      
      // Process with PostCSS (Tailwind + Autoprefixer)
      const result = await postcss([
        tailwindcss,
        autoprefixer,
      ]).process(css, { from: args.path });

      // Append to combined CSS
      combinedCSS += result.css + '\n';

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
    });
  },
};

export default {
  entrypoints: ["./src/main.tsx"],
  plugins: [cssPlugin],
  outdir: "./dist",
  target: "browser" as const,
  sourcemap: "external" as const,
  minify: false,
}; 
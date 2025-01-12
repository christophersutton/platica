import baseConfig from "./build.config";
import fs from "fs/promises";
import path from "path";

const isDev = process.argv.includes("--dev");

interface BuildResult {
  path: string;
  size: string;
}

function formatBuildErrors(logs: Array<{ message: string }>) {
  return logs
    .map(log => log.message)
    .filter(msg => msg.includes("error") || msg.includes("ERROR"))
    .map(msg => `  ${msg.trim()}`)
    .join("\n");
}

async function validateOutputs(result: Awaited<ReturnType<typeof Bun.build>>) {
  if (result.outputs.length === 0) {
    throw new Error("No build outputs generated!");
  }

  const results: BuildResult[] = [];
  for (const output of result.outputs) {
    const content = await output.text();
    if (!content || content.length === 0) {
      throw new Error(`Empty output file: ${output.path}`);
    }
    results.push({
      path: output.path,
      size: (content.length / 1024).toFixed(2) + " KB"
    });
  }
  return results;
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function copyIndexHtml() {
  const indexHtml = await fs.readFile("index.html", "utf8");
  if (!indexHtml.includes("<div id=\"root\">")) {
    console.warn("Warning: index.html might be missing root element");
  }
  
  // Inject CSS link
  const modifiedHtml = indexHtml.replace(
    "</head>",
    '  <link rel="stylesheet" href="/index.css" />\n  </head>'
  );
  
  await fs.writeFile(path.join("dist", "index.html"), modifiedHtml);
  console.log("✓ dist/index.html");
}

// Main build process
async function build() {
  console.log(`🐰 Building for ${isDev ? "development" : "production"}...`);
  
  const config = {
    ...baseConfig,
    minify: !isDev,
    sourcemap: isDev ? "external" as const : undefined,
  };

  const start = Date.now();

  try {
    // Ensure dist directory exists and is clean
    await ensureDirectoryExists("dist");
    
    // Verify entry point exists
    const entryPoint = path.resolve(process.cwd(), config.entrypoints[0]);
    try {
      await fs.access(entryPoint);
    } catch {
      throw new Error(`Entry point not found: ${config.entrypoints[0]}`);
    }

    // Run build
    const result = await Bun.build(config);
    
    if (!result.success) {
      const errors = formatBuildErrors(result.logs);
      throw new Error(
        "Build failed with errors:\n" + 
        (errors || "No specific error messages found. Check build configuration and entry points.")
      );
    }

    // Validate and write outputs
    const outputs = await validateOutputs(result);
    
    console.log("\nBuild outputs:");
    for (const { path: outputPath, size } of outputs) {
      const fullPath = path.join("dist", path.basename(outputPath));
      const content = await result.outputs.find(o => o.path === outputPath)?.text();
      if (!content) continue;
      
      await fs.writeFile(fullPath, content);
      console.log(`✓ ${fullPath} (${size})`);
    }

    // Copy and process index.html
    await copyIndexHtml();

    console.log(`\n✨ Built successfully in ${Date.now() - start}ms`);
  } catch (error) {
    console.error("\n🔥 Build failed:");
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(1);
        if (stackLines.length > 0) {
          console.error("\nStack trace:");
          console.error(stackLines.join('\n'));
        }
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

build(); 
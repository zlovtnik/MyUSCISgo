#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-net

/**
 * Complete Build System for Go WASM + React App
 * Handles Go compilation, asset copying, and development server
 */

const BUILD_DIR = "dist";

// Utility functions
async function runCommand(cmd: string, args: string[] = [], env?: Record<string, string>) {
  console.log(`🔧 Running: ${cmd} ${args.join(" ")}`);

  const command = new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
    env
  });

  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    console.error(`❌ Command failed: ${errorText}`);
    return false;
  }

  const outputText = new TextDecoder().decode(stdout);
  if (outputText.trim()) console.log(outputText);
  return true;
}

async function fileExists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src: string, dest: string) {
  if (await fileExists(src)) {
    await Deno.mkdir(dest.replace(/[^/]*$/, ""), { recursive: true });
    await Deno.copyFile(src, dest);
    console.log(`  ✅ ${src} → ${dest}`);
  } else {
    console.log(`  ⚠️  ${src} not found`);
  }
}

async function buildWASM() {
  console.log("🔨 Building Go WASM...");

  // Build Go to WASM with optimizations
  const buildSuccess = await runCommand("go", [
    "build",
    "-o", "main.wasm",
    "-ldflags=-s -w",
    "-trimpath",
    "main.go"
  ], {
    GOOS: "js",
    GOARCH: "wasm"
  });

  if (!buildSuccess) {
    console.error("❌ Go WASM build failed");
    return false;
  }

  console.log("✅ WASM built successfully");
  return true;
}

async function copyWasmExec() {
  console.log("📁 Copying wasm_exec.js...");

  // Try different possible locations for wasm_exec.js
  const possiblePaths = [
    "$(go env GOROOT)/lib/wasm/wasm_exec.js",
    "$(go env GOROOT)/misc/wasm/wasm_exec.js",
    "$(go env GOROOT)/libexec/misc/wasm/wasm_exec.js"
  ];

  for (const path of possiblePaths) {
    const copySuccess = await runCommand("cp", [path, "wasm_exec.js"]);
    if (copySuccess && await fileExists("wasm_exec.js")) {
      console.log("✅ Copied wasm_exec.js from Go installation");
      return true;
    }
  }

  // Fallback: download from Go repository
  console.log("📥 Downloading wasm_exec.js from Go repository...");
  const downloadSuccess = await runCommand("curl", [
    "-s", "-o", "wasm_exec.js",
    "https://raw.githubusercontent.com/golang/go/master/lib/wasm/wasm_exec.js"
  ]);

  if (downloadSuccess && await fileExists("wasm_exec.js")) {
    console.log("✅ Downloaded wasm_exec.js from Go repository");
    return true;
  }

  console.error("❌ Failed to get wasm_exec.js");
  return false;
}

async function copyAssets() {
  console.log("📁 Copying assets...");

  // Create build directory
  await Deno.mkdir(BUILD_DIR, { recursive: true });

  // Copy files
  const files = [
    ["index.html", `${BUILD_DIR}/index.html`],
    ["main.wasm", `${BUILD_DIR}/main.wasm`],
    ["wasm_exec.js", `${BUILD_DIR}/wasm_exec.js`]
  ];

  for (const [src, dest] of files) {
    await copyFile(src, dest);
  }

  return true;
}

async function clean() {
  console.log("🧹 Cleaning...");

  if (await fileExists(BUILD_DIR)) {
    await Deno.remove(BUILD_DIR, { recursive: true });
    console.log(`✅ Removed ${BUILD_DIR}`);
  }

  // Clean build artifacts
  const artifacts = ["main.wasm", "wasm_exec.js"];
  for (const artifact of artifacts) {
    if (await fileExists(artifact)) {
      await Deno.remove(artifact);
      console.log(`✅ Removed ${artifact}`);
    }
  }
}

async function build() {
  console.log("🏗️  Building Go WASM + React App...");

  // Clean previous build
  await clean();

  // Build WASM
  if (!(await buildWASM())) {
    console.error("❌ Build failed");
    return false;
  }

  // Copy wasm_exec.js
  if (!(await copyWasmExec())) {
    console.error("❌ Failed to copy wasm_exec.js");
    return false;
  }

  // Copy assets
  await copyAssets();

  console.log(`\n🎉 Build complete! Files in ${BUILD_DIR}/`);
  console.log(`🚀 Run 'deno run --allow-net build.ts serve' to start dev server`);
  console.log(`🐳 Or use 'docker-compose up' for production deployment`);
  return true;
}

async function serve() {
  console.log("🚀 Starting development server...");

  // Build first
  if (!(await build())) {
    console.error("❌ Build failed, cannot start server");
    return;
  }

  // Change to build directory and serve
  const server = Deno.listen({ port: 8000 });
  console.log("🚀 Server running at http://localhost:8000");
  console.log("⏹️  Press Ctrl+C to stop");

  for await (const conn of server) {
    (async () => {
      const httpConn = Deno.serveHttp(conn);
      for await (const request of httpConn) {
        try {
          const url = new URL(request.url);
          let filePath = `${BUILD_DIR}${url.pathname}`;

          // Default to index.html for root path
          if (url.pathname === "/" || url.pathname === "") {
            filePath = `${BUILD_DIR}/index.html`;
          }

          // Security: prevent directory traversal
          if (filePath.includes("..")) {
            await request.respond({ status: 403 });
            return;
          }

          // Check if file exists
          if (await fileExists(filePath)) {
            const file = await Deno.open(filePath);
            const headers = new Headers();

            // Set content type based on file extension
            if (filePath.endsWith('.wasm')) {
              headers.set('Content-Type', 'application/wasm');
            } else if (filePath.endsWith('.js')) {
              headers.set('Content-Type', 'application/javascript');
            } else if (filePath.endsWith('.html')) {
              headers.set('Content-Type', 'text/html');
            } else if (filePath.endsWith('.css')) {
              headers.set('Content-Type', 'text/css');
            }

            await request.respond({ body: file, headers });
          } else {
            // Return 404 for missing files
            await request.respond({
              status: 404,
              body: `File not found: ${url.pathname}`
            });
          }
        } catch (error) {
          console.error("Server error:", error);
          await request.respond({
            status: 500,
            body: "Internal server error"
          });
        }
      }
    })();
  }
}

// Main CLI
async function main() {
  const command = Deno.args[0] || "help";

  switch (command) {
    case "build":
      await build();
      break;
    case "serve":
      await serve();
      break;
    case "clean":
      await clean();
      break;
    case "dev":
      // Build and serve with auto-reload (simplified)
      await build();
      await serve();
      break;
    default:
      console.log(`
🚀 Go WASM + React Build System

Usage:
  deno run --allow-read --allow-write --allow-run --allow-net build.ts <command>

Commands:
  build    Build the application
  serve    Build and start development server
  dev      Build and serve with auto-reload
  clean    Clean build artifacts

Examples:
  deno run --allow-read --allow-write --allow-run --allow-net build.ts build
  deno run --allow-read --allow-write --allow-run --allow-net build.ts serve
      `);
  }
}

if (import.meta.main) {
  await main();
}
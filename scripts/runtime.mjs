import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const bundled = join(
  homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node",
);
const [major, minor] = process.versions.node.split(".").map(Number);
const supported = major > 22 || (major === 22 && minor >= 13);
const runtime = supported
  ? process.execPath
  : existsSync(bundled)
    ? bundled
    : null;
if (!runtime) {
  console.error("ReaderWeb needs Node.js 22.13 or newer.");
  process.exit(1);
}
const child = spawn(runtime, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));

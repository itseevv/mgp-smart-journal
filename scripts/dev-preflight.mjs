import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { totalmem } from "node:os";
import { resolve } from "node:path";
import net from "node:net";

const root = process.cwd();
const mode = process.env.JOURNAL_CHIP_DEV_MODE ?? "stable";
const defaultPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const lockPath = resolve(root, ".next/dev/lock");
const envPath = resolve(root, ".env.local");

const warnings = [];

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  console.error(`\nJournal Chip dev preflight failed:\n${message}\n`);
  process.exit(1);
}

function pidExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function portIsFree(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE") {
        resolvePort(false);
        return;
      }
      resolvePort(true);
    });
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();
  const entries = new Map();
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    entries.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }
  return entries;
}

function hostFromOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function checkDevLock() {
  if (!existsSync(lockPath)) return;
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    warn("Found an unreadable .next/dev/lock file. If dev startup fails, clear the generated .next dev state.");
    return;
  }

  const pid = Number(lock.pid);
  if (pidExists(pid)) {
    fail(
      `.next/dev/lock says a Next dev server is already running on port ${lock.port ?? "unknown"} with pid ${pid}.\n` +
        "Stop that server first, or use a different PORT intentionally.",
    );
  }

  try {
    unlinkSync(lockPath);
    warn(`Removed stale generated Next dev lock for missing pid ${pid || "unknown"}.`);
  } catch (error) {
    fail(
      `Found a stale generated Next dev lock for missing pid ${pid || "unknown"}, but could not remove it.\n` +
        `Path: ${lockPath}\n` +
        `Reason: ${error?.message ?? String(error)}\n` +
        "Clear this generated lock, then run npm run dev again.",
    );
  }
}

function checkNgrokEnv() {
  const env = parseEnvFile(envPath);
  const appBaseHost = hostFromOrigin(env.get("APP_BASE_URL"));
  const allowedHost = hostFromOrigin(env.get("ALLOWED_ORIGIN"));
  const allowedHosts = (env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => hostFromOrigin(value.trim()))
    .filter(Boolean);
  const ngrokHosts = [appBaseHost, allowedHost, ...allowedHosts].filter((host) =>
    host.includes("ngrok"),
  );

  if (ngrokHosts.length === 0) return;

  const uniqueHosts = new Set(ngrokHosts);
  if (uniqueHosts.size > 1) {
    warn(
      "APP_BASE_URL / ALLOWED_ORIGIN / ALLOWED_ORIGINS contain different ngrok hosts. Localhost can still work, but ngrok may fail until they match the active tunnel.",
    );
    return;
  }

  warn(
    "ngrok origin is configured in .env.local. If you start a new ngrok tunnel, update APP_BASE_URL and ALLOWED_ORIGIN before testing the public link.",
  );
}

async function main() {
  if (!Number.isInteger(defaultPort) || defaultPort <= 0) {
    fail(`PORT must be a positive integer. Received: ${process.env.PORT}`);
  }

  checkDevLock();

  if (!(await portIsFree(defaultPort))) {
    fail(
      `Port ${defaultPort} is already in use.\n` +
        "Open Activity Monitor or run lsof to identify the process before starting Journal Chip again.",
    );
  }

  checkNgrokEnv();

  const totalMemoryGb = totalmem() / 1024 / 1024 / 1024;
  if (mode === "turbo" && totalMemoryGb < 10) {
    warn(
      `Turbopack mode on this ${totalMemoryGb.toFixed(1)}GB machine can trigger heavy memory pressure. Prefer npm run dev unless you are testing Turbopack specifically.`,
    );
  }

  if (warnings.length) {
    console.warn("\nJournal Chip dev preflight warnings:");
    for (const message of warnings) console.warn(`- ${message}`);
    console.warn("");
  }
}

await main();

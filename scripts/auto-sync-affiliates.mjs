#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const SHEET_TO_JSON = {
  script: "scripts/csv-to-affiliates-json.mjs",
  source: "data/affiliates_google_sheet_template.csv",
  target: "data/affiliates.json",
  label: "sheet->json"
};

const JSON_TO_SHEET = {
  script: "scripts/affiliates-json-to-csv.mjs",
  source: "data/affiliates.json",
  target: "data/affiliates_export_google_sheet.csv",
  label: "json->sheet"
};

function parseArgs(argv) {
  const config = {
    mode: "sheet-to-json",
    source: "",
    target: "",
    once: false,
    help: false
  };

  argv.forEach((arg) => {
    if (arg === "--help" || arg === "-h") config.help = true;
    else if (arg === "--once") config.once = true;
    else if (arg.startsWith("--mode=")) config.mode = arg.split("=")[1] || config.mode;
    else if (arg.startsWith("--source=")) config.source = arg.split("=")[1] || "";
    else if (arg.startsWith("--target=")) config.target = arg.split("=")[1] || "";
  });

  return config;
}

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/auto-sync-affiliates.mjs [--mode=sheet-to-json|json-to-sheet] [--source=...] [--target=...] [--once]",
      "",
      "Examples:",
      "  node scripts/auto-sync-affiliates.mjs --mode=sheet-to-json --source=data/affiliates_google_sheet_template.csv --target=data/affiliates.json",
      "  node scripts/auto-sync-affiliates.mjs --mode=json-to-sheet --source=data/affiliates.json --target=data/affiliates_export_google_sheet.csv",
      "  node scripts/auto-sync-affiliates.mjs --once"
    ].join("\n")
  );
}

function resolveModeConfig(mode) {
  if (mode === "sheet-to-json") return SHEET_TO_JSON;
  if (mode === "json-to-sheet") return JSON_TO_SHEET;
  throw new Error("Invalid mode. Use sheet-to-json or json-to-sheet.");
}

function now() {
  return new Date().toLocaleTimeString("fr-CA", { hour12: false });
}

function existsOrThrow(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${path.relative(ROOT, filePath)}`);
  }
}

function runConverter(converterScript, sourcePath, targetPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [converterScript, sourcePath, targetPath], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || `Converter exited with code ${code}`));
    });
  });
}

async function start() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const modeCfg = resolveModeConfig(args.mode);
  const sourceRel = args.source || modeCfg.source;
  const targetRel = args.target || modeCfg.target;

  const sourceAbs = path.resolve(ROOT, sourceRel);
  const targetAbs = path.resolve(ROOT, targetRel);
  const converterAbs = path.resolve(ROOT, modeCfg.script);

  existsOrThrow(converterAbs, "Converter");
  existsOrThrow(sourceAbs, "Source");

  let running = false;
  let pending = false;
  let lastRunAt = 0;
  const minGapMs = 250;

  const execute = async (reason) => {
    const current = Date.now();
    if (running) {
      pending = true;
      return;
    }

    if (current - lastRunAt < minGapMs) {
      pending = true;
      return;
    }

    running = true;
    lastRunAt = current;

    try {
      const message = await runConverter(modeCfg.script, sourceRel, targetRel);
      console.log(`[${now()}] ${modeCfg.label} (${reason}) ok: ${message}`);
    } catch (error) {
      console.error(`[${now()}] ${modeCfg.label} (${reason}) failed: ${error.message}`);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        setTimeout(() => {
          execute("queued-change");
        }, minGapMs);
      }
    }
  };

  await execute("startup");

  if (args.once) return;

  console.log(`[${now()}] Watching ${path.relative(ROOT, sourceAbs)} -> ${path.relative(ROOT, targetAbs)}`);

  fs.watch(sourceAbs, { persistent: true }, () => {
    execute("file-change");
  });

  process.stdin.resume();
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

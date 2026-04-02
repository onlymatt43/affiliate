#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const HEADERS = [
  "id",
  "name",
  "status",
  "priority",
  "platform",
  "niche",
  "format",
  "tone",
  "primaryUrl",
  "promoCode",
  "socialUrl",
  "logo1Url",
  "logo2Url",
  "logo3Url",
  "mentions",
  "postRequirements",
  "specificities",
  "fr_tags",
  "fr_specs",
  "fr_caption",
  "en_tags",
  "en_specs",
  "en_caption",
  "lastUpdated",
  "owner",
  "notes"
];

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/affiliates-json-to-csv.mjs <input.json> [output.csv]",
      "",
      "Example:",
      "  node scripts/affiliates-json-to-csv.mjs data/affiliates.json data/affiliates_export_google_sheet.csv"
    ].join("\n")
  );
}

function toText(value) {
  return String(value ?? "").trim();
}

function csvEscape(value) {
  const str = String(value ?? "");
  const needsQuotes = /[",\n\r]/.test(str);
  if (!needsQuotes) return str;
  return `"${str.replaceAll('"', '""')}"`;
}

function normalizeRow(item) {
  const logos = Array.isArray(item?.logos) ? item.logos : [];

  return {
    id: toText(item?.id),
    name: toText(item?.name),
    status: "",
    priority: "",
    platform: toText(item?.platform),
    niche: toText(item?.niche),
    format: toText(item?.format),
    tone: toText(item?.tone),
    primaryUrl: toText(item?.primaryUrl || item?.promoUrl),
    promoCode: toText(item?.promoCode),
    socialUrl: toText(item?.socialUrl),
    logo1Url: toText(logos[0]),
    logo2Url: toText(logos[1]),
    logo3Url: toText(logos[2]),
    mentions: toText(item?.mentions),
    postRequirements: toText(item?.postRequirements),
    specificities: toText(item?.specificities),
    fr_tags: toText(item?.fr?.tags),
    fr_specs: toText(item?.fr?.specs),
    fr_caption: toText(item?.fr?.caption),
    en_tags: toText(item?.en?.tags),
    en_specs: toText(item?.en?.specs),
    en_caption: toText(item?.en?.caption),
    lastUpdated: "",
    owner: "",
    notes: ""
  };
}

function toCsv(rows) {
  const headerLine = HEADERS.join(",");
  const lines = rows.map((row) => HEADERS.map((h) => csvEscape(row[h])).join(","));
  return [headerLine, ...lines].join("\n") + "\n";
}

function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3] || "data/affiliates_export_google_sheet.csv";

  if (!inputArg) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputArg}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON input.");
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error("JSON root must be an array.");
    process.exit(1);
  }

  const rows = parsed.map(normalizeRow);
  const csv = toCsv(rows);
  fs.writeFileSync(outputPath, csv, "utf8");

  console.log(`Converted ${rows.length} affiliate(s) -> ${path.relative(process.cwd(), outputPath)}`);
}

main();

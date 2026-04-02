#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/csv-to-affiliates-json.mjs <input.csv> [output.json]",
      "",
      "Example:",
      "  node scripts/csv-to-affiliates-json.mjs data/affiliates_google_sheet_template.csv data/affiliates.json"
    ].join("\n")
  );
}

function toText(value) {
  return String(value || "").trim();
}

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = csvText[i + 1];
        if (next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    value += ch;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => toText(h));
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i];
    const obj = {};

    for (let j = 0; j < headers.length; j += 1) {
      obj[headers[j]] = current[j] ?? "";
    }

    records.push(obj);
  }

  return records;
}

function collectLogos(record) {
  const raw = [
    toText(record.logo1Url),
    toText(record.logo2Url),
    toText(record.logo3Url)
  ];

  const logos = [];
  const seen = new Set();

  raw.forEach((url) => {
    if (!isValidHttpUrl(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    logos.push(url);
  });

  return logos.slice(0, 3);
}

function toAffiliate(record, index) {
  const id = toText(record.id) || `aff-${index + 1}`;
  const name = toText(record.name);
  if (!name) return null;

  return {
    id,
    name,
    platform: toText(record.platform) || "instagram",
    niche: toText(record.niche) || "business",
    format: toText(record.format) || "short-video",
    tone: toText(record.tone) || "authority",
    primaryUrl: isValidHttpUrl(toText(record.primaryUrl || record.promoUrl)) ? toText(record.primaryUrl || record.promoUrl) : "",
    promoCode: toText(record.promoCode),
    socialUrl: isValidHttpUrl(toText(record.socialUrl)) ? toText(record.socialUrl) : "",
    mentions: toText(record.mentions),
    postRequirements: toText(record.postRequirements),
    specificities: toText(record.specificities),
    logos: collectLogos(record),
    fr: {
      tags: toText(record.fr_tags),
      specs: toText(record.fr_specs),
      caption: toText(record.fr_caption)
    },
    en: {
      tags: toText(record.en_tags),
      specs: toText(record.en_specs),
      caption: toText(record.en_caption)
    }
  };
}

function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3] || "data/affiliates.json";

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

  const csvText = fs.readFileSync(inputPath, "utf8");
  const records = parseCsv(csvText);

  const affiliates = records
    .map((record, index) => toAffiliate(record, index))
    .filter(Boolean);

  fs.writeFileSync(outputPath, JSON.stringify(affiliates, null, 2) + "\n", "utf8");
  console.log(`Converted ${affiliates.length} affiliate(s) -> ${path.relative(process.cwd(), outputPath)}`);
}

main();

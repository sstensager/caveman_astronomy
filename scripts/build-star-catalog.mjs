// One-time/occasional dev tool: fetches the HYG Database (Hipparcos-Yale-
// Gliese compiled star catalog), filters it to naked-eye-limit stars, and
// writes a compact local data file the app bundles at build time. Not part
// of `npm run build`/`dev` - re-run manually with `node
// scripts/build-star-catalog.mjs` if the catalog ever needs refreshing.
//
// Source: https://github.com/astronexus/HYG-Database (hyg/v3/hyg_v38.csv),
// licensed CC BY-SA 4.0 - see src/data/NOTICE.md for full attribution.

import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import https from "node:https";

const HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v38.csv.gz";
const MAG_LIMIT = 6.5;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "src", "data", "stars.json");

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Quote-aware CSV line splitter (RFC4180-ish) - handles quoted fields that
 *  may contain commas or escaped quotes, which a naive split(",") would
 *  corrupt. HYG's actual field content is simple in practice, but parsed
 *  defensively rather than assuming that always holds. */
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== header.length) {
      console.warn(`Skipping malformed row ${i + 1}: expected ${header.length} fields, got ${values.length}`);
      continue;
    }
    const row = {};
    header.forEach((key, idx) => (row[key] = values[idx]));
    rows.push(row);
  }
  return rows;
}

function toOptionalString(value) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function toOptionalNumber(value) {
  if (!value || value.trim().length === 0) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  console.log(`Fetching ${HYG_URL} ...`);
  const gz = await fetchBuffer(HYG_URL);
  const csvText = gunzipSync(gz).toString("utf-8");
  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} raw rows.`);

  const stars = [];
  for (const row of rows) {
    // Row id=0 is a synthetic "Sol" entry HYG includes to represent the Sun
    // itself - it has ra=0/dec=0, which collides with this app's RA=0/Dec=0
    // reference direction. Must be excluded, not just "a normal faint star".
    if (row.id === "0") continue;

    const mag = Number.parseFloat(row.mag);
    if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue;

    const ra = Number.parseFloat(row.ra);
    const dec = Number.parseFloat(row.dec);
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;

    const star = {
      ra,
      dec,
      mag,
    };
    const hip = toOptionalNumber(row.hip);
    if (hip !== undefined) star.hip = hip;
    const properName = toOptionalString(row.proper);
    if (properName !== undefined) star.properName = properName;
    const designation = toOptionalString(row.bf);
    if (designation !== undefined) star.designation = designation;
    const constellation = toOptionalString(row.con);
    if (constellation !== undefined) star.constellation = constellation;
    const colorIndex = toOptionalNumber(row.ci);
    if (colorIndex !== undefined) star.colorIndex = colorIndex;

    stars.push(star);
  }

  stars.sort((a, b) => a.mag - b.mag);

  const output = {
    meta: {
      source: "HYG-Database v3 (astronexus/HYG-Database), hyg/v3/hyg_v38.csv",
      license: "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)",
      generatedAt: new Date().toISOString().slice(0, 10),
      magLimit: MAG_LIMIT,
      count: stars.length,
    },
    stars,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output));

  const brightest = stars[0];
  const faintest = stars[stars.length - 1];
  console.log(`Wrote ${stars.length} stars (mag ${brightest.mag.toFixed(2)} to ${faintest.mag.toFixed(2)}) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

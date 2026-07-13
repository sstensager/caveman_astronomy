// One-time/occasional dev tool: fetches D3-Celestial's constellation line
// and name data, resolves every line vertex to the NEAREST star already in
// this app's own catalog (src/data/stars.json) - never embedding raw
// coordinates in the output - and writes a compact local data file the app
// bundles at build time. Not part of `npm run build`/`dev` - re-run
// manually with `node scripts/build-constellations.mjs` if the data ever
// needs refreshing.
//
// Source: https://github.com/ofrohn/d3-celestial (data/constellations.lines.json,
// data/constellations.json), licensed BSD-3-Clause - see src/data/NOTICE.md
// for full attribution.
//
// Why nearest-match instead of using D3-Celestial's coordinates directly:
// this app's architectural rule is that constellation data must reference
// stars in the shared catalog by id, never store its own copy of a
// position. D3-Celestial's raw files store each line vertex as a bare
// RA/Dec pair, not a star id, so this script's whole job is converting
// "a point in the sky" into "the star at that point, per OUR catalog" -
// once, here, so nothing downstream ever needs to do it again.

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import https from "node:https";

const LINES_URL = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json";
const NAMES_URL = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json";

// Max angular separation (degrees) allowed between a D3-Celestial line
// vertex and the catalog star it resolves to. D3-Celestial's own line
// vertices are themselves approximate/rounded, and not every star it draws
// is guaranteed to be in our mag<=6.5 catalog - a real but unmatched vertex
// should be SKIPPED (with a warning), never silently matched to an
// unrelated star just because it was the closest thing available.
const MAX_MATCH_DISTANCE_DEG = 1.0;

const __dirname = dirname(fileURLToPath(import.meta.url));
const STARS_PATH = join(__dirname, "..", "src", "data", "stars.json");
const OUTPUT_PATH = join(__dirname, "..", "src", "data", "constellations.json");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Same convention as src/astronomy/starCatalog.ts's raDecToVector3 (kept
 *  as a plain re-implementation here rather than importing the TS module,
 *  since this script runs standalone under plain Node ESM) - Dec=+90 ->
 *  +Y, RA=0h -> +X. */
function raDecToVector3(raHours, decDeg) {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.sin(dec),
    z: Math.cos(dec) * Math.sin(ra),
  };
}

/** D3-Celestial stores RA as degrees wrapped to (-180, 180], not the
 *  catalog's [0, 24) hours - verified empirically against known bright
 *  stars (e.g. Altair ~RA 19h50m/297.5deg wraps to ~-62.5deg, matching an
 *  Aquila line vertex at -63.4351) before writing this conversion. */
function wrappedDegToRaHours(wrappedDeg) {
  const normalized = ((wrappedDeg % 360) + 360) % 360;
  return normalized / 15;
}

function angularDistanceDeg(a, b) {
  const dot = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z));
  return (Math.acos(dot) * 180) / Math.PI;
}

async function main() {
  console.log(`Fetching ${LINES_URL} ...`);
  const linesGeoJson = await fetchJson(LINES_URL);
  console.log(`Fetching ${NAMES_URL} ...`);
  const namesGeoJson = await fetchJson(NAMES_URL);

  const rawStars = JSON.parse(readFileSync(STARS_PATH, "utf-8")).stars;
  const catalogDirections = rawStars.map((s) => raDecToVector3(s.ra, s.dec));

  function nearestStar(raHours, decDeg) {
    const target = raDecToVector3(raHours, decDeg);
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < rawStars.length; i++) {
      const d = angularDistanceDeg(target, catalogDirections[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    if (bestIndex === -1 || bestDistance > MAX_MATCH_DISTANCE_DEG) return undefined;
    return { star: rawStars[bestIndex], distanceDeg: bestDistance };
  }

  const namesById = new Map(namesGeoJson.features.map((f) => [f.id, f.properties.name]));

  let totalVertices = 0;
  let unmatchedVertices = 0;
  let totalSegments = 0;
  let skippedSegments = 0;

  const constellations = [];
  for (const feature of linesGeoJson.features) {
    const id = feature.id;
    const name = namesById.get(id) ?? id;
    const segments = [];

    for (const lineString of feature.geometry.coordinates) {
      // Resolve every vertex in this LineString once, then walk consecutive
      // pairs as segments - avoids re-resolving a shared vertex twice.
      const resolved = lineString.map(([raDegWrapped, decDeg]) => {
        totalVertices++;
        const match = nearestStar(wrappedDegToRaHours(raDegWrapped), decDeg);
        if (!match) unmatchedVertices++;
        return match;
      });
      for (let i = 0; i < resolved.length - 1; i++) {
        totalSegments++;
        const a = resolved[i];
        const b = resolved[i + 1];
        if (!a || !b || a.star.hip === undefined || b.star.hip === undefined) {
          skippedSegments++;
          continue;
        }
        if (a.star.hip === b.star.hip) continue; // degenerate (both ends resolved to the same star)
        segments.push([a.star.hip, b.star.hip]);
      }
    }

    const labelFeature = namesGeoJson.features.find((f) => f.id === id);
    const [labelRaDegWrapped, labelDecDeg] = labelFeature.geometry.coordinates;

    constellations.push({
      id,
      name,
      labelRaHours: wrappedDegToRaHours(labelRaDegWrapped),
      labelDecDeg,
      segments,
    });
  }

  const output = {
    meta: {
      source: "D3-Celestial (ofrohn/d3-celestial), data/constellations.lines.json + data/constellations.json",
      license: "BSD-3-Clause",
      generatedAt: new Date().toISOString().slice(0, 10),
      matchedAgainst: "src/data/stars.json (this app's own catalog)",
      maxMatchDistanceDeg: MAX_MATCH_DISTANCE_DEG,
    },
    cultures: [
      {
        id: "western",
        name: "Western (IAU)",
        constellations,
      },
    ],
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output));

  console.log(`Vertices: ${totalVertices}, unmatched: ${unmatchedVertices} (${((unmatchedVertices / totalVertices) * 100).toFixed(1)}%)`);
  console.log(`Segments: ${totalSegments}, skipped: ${skippedSegments} (${((skippedSegments / totalSegments) * 100).toFixed(1)}%)`);
  console.log(`Wrote ${constellations.length} constellations to ${OUTPUT_PATH}`);

  // Sanity check the two constellations explicitly called out for verification.
  for (const checkId of ["Ori", "UMa"]) {
    const c = constellations.find((x) => x.id === checkId);
    const starNames = new Set();
    for (const [a, b] of c.segments) {
      const starA = rawStars.find((s) => s.hip === a);
      const starB = rawStars.find((s) => s.hip === b);
      if (starA?.properName) starNames.add(starA.properName);
      if (starB?.properName) starNames.add(starB.properName);
    }
    console.log(`${c.name} (${c.id}): ${c.segments.length} segments, named stars: ${[...starNames].join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import { parquetReadObjects } from "hyparquet";
import { normalizeComposer } from "./normalize.js";

const VENDOR_DIR = "vendor/imslp-midi-by-sa/data";
const OUT_DIR = "docs/imslp-midi-by-sa";
const LIST_FILE = "src/imslp-midi-by-sa/list.json";
const LIFE_FILE = "src/imslp-midi-by-sa/composer-life.tsv";
// Longest protection period in the world (see README). No country info here,
// so the non-JP threshold applies.
const THRESHOLD_YEAR = 1925;

// Mirror build.js filterCopyright for entries that carry born/died.
// This dataset is CC-BY-SA-4.0 (NOT CC0 like imslp-midi-cc0-1.0) and includes
// modern uploader compositions, so we cannot blanket-adopt entries that lack
// life data. Instead:
// - No life data (unresolvable on Wikidata): fall back to the dataset's
//   era/year and drop clearly non-PD works (Modern / Early 20th century / year
//   past the threshold).
// - born known but died unknown ("1850-?"): they did not live to 100, so death
//   is at most born+100. Keep only if even that upper bound confirms expiry.
function passesCopyright(born, died, era, year) {
  const b = parseInt(born);
  const d = parseInt(died);
  if (isNaN(b) && isNaN(d)) {
    if (era === "Modern" || era === "Early 20th century") return false;
    if (year && parseInt(year) > THRESHOLD_YEAR) return false;
    return true;
  }
  if (!isNaN(b) && b > THRESHOLD_YEAR) return false;
  if (!isNaN(d)) return d <= THRESHOLD_YEAR;
  return b + 100 <= THRESHOLD_YEAR; // died unknown: assume death <= born+100
}

function loadLife() {
  const db = new Map();
  const tsv = Deno.readTextFileSync(LIFE_FILE);
  tsv.trimEnd().split("\n").forEach((row) => {
    const [name, born, died, wikidata] = row.split("\t");
    db.set(name, { born: born || "", died: died || "", wikidata: wikidata || "" });
  });
  return db;
}

async function readParquet(filePath) {
  const bytes = await Deno.readFile(filePath);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const file = { byteLength: ab.byteLength, slice: (s, e) => Promise.resolve(ab.slice(s, e)) };
  return await parquetReadObjects({
    file,
    columns: ["midi_source", "file_name", "title", "composer", "year", "era", "midi"],
    // Keep BYTE_ARRAY columns without a UTF8 logical type (the raw `midi`
    // bytes) as Uint8Array instead of decoding them as text.
    utf8: false,
  });
}

function midiToBytes(midi) {
  if (midi instanceof Uint8Array) return midi;
  // Fallback: hyparquet may return BYTE_ARRAY as a binary string where each
  // char code is a byte.
  return Uint8Array.from(midi, (c) => c.charCodeAt(0));
}

async function main() {
  const life = loadLife();
  // by-sa is sharded (4 train + validation + test). Pick up every parquet.
  const parquetFiles = [];
  for await (const entry of Deno.readDir(VENDOR_DIR)) {
    if (entry.name.endsWith(".parquet")) parquetFiles.push(`${VENDOR_DIR}/${entry.name}`);
  }
  parquetFiles.sort();
  await Deno.mkdir(OUT_DIR, { recursive: true });

  const db = [];
  let total = 0;
  let dropped = 0;
  for (const parquetFile of parquetFiles) {
    const rows = await readParquet(parquetFile);
    for (const row of rows) {
      total++;
      const composer = normalizeComposer(row.composer);
      const lifeInfo = life.get(composer) ?? { born: "", died: "" };
      const born = lifeInfo.born;
      const died = lifeInfo.died;
      if (!passesCopyright(born, died, row.era, row.year)) {
        dropped++;
        continue;
      }
      // Extract the raw MIDI bytes.
      const midiPath = `${OUT_DIR}/${row.file_name}`;
      const bytes = midiToBytes(row.midi);
      await Deno.writeFile(midiPath, bytes);

      const info = { title: row.title };
      if (composer) info.composer = composer;
      if (born) info.born = born;
      if (died) info.died = died;
      if (row.year) info.date = String(row.year);
      if (row.midi_source) info.source = row.midi_source;
      info.file = `imslp-midi-by-sa/${row.file_name}`;
      db.push(info);
    }
  }

  Deno.writeTextFileSync(LIST_FILE, JSON.stringify(db, null, "\t"));
  console.log(`listed ${db.length} entries (${dropped}/${total} dropped by copyright)`);
}

await main();

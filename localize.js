import { dirname } from "@std/path";

function loadComposers(langPos) {
  const db = new Map();
  const csv = Deno.readTextFileSync("composer.tsv");
  csv.trimEnd().split("\n").forEach((row) => {
    const composers = row.split("\t");
    composers.forEach((composer) => {
      db.set(composer, composers[langPos]);
      db.set(composer, composers[langPos]);
    });
  });
  return db;
}

function localizeAll() {
  const jsonFiles = [
    "docs/json/piano-midi.de/list.json",
    "docs/json/ClassicalMusicSymposium/list.json",
    "docs/json/imslp-midi-cc0-1.0/list.json",
  ];
  for (const filePath of jsonFiles) {
    const json = Deno.readTextFileSync(filePath);
    const db = JSON.parse(json);
    ["en", "ja"].forEach((lang, langPos) => {
      const composers = loadComposers(langPos);
      db.forEach((info) => {
        const composer = composers.get(info.composer);
        // Keep composers that are not listed in composer.tsv as-is (their
        // original language) instead of dropping them.
        if (composer) {
          info.composer = composer;
        }
      });
      const result = JSON.stringify(db, null, "\t");
      const dir = dirname(filePath);
      Deno.writeTextFileSync(`${dir}/${lang}.json`, result);
    });
    Deno.removeSync(filePath);
  }
}

localizeAll();

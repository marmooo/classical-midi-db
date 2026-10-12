function getThresholdYear(country) {
  if (country && country.startsWith("JP")) {
    return 1968;
  } else {
    return 1925;
  }
}

function filterCopyright(data) {
  return data.filter((info) => {
    const thresholdYear = getThresholdYear(info.country);
    const thresholdCentury = Math.floor(thresholdYear / 100);
    const born = parseInt(info.born);
    if (data.maintainer) {
      if (data.composer == data.maintainer) return true;
      if (data.arranger == data.maintainer) return true;
    }
    if (born < 100) {
      if (born > thresholdCentury) return false;
    } else {
      if (born > thresholdYear) return false;
    }
    const died = parseInt(info.died);
    if (died < 100) {
      if (died <= thresholdCentury) return true;
    } else {
      if (died <= thresholdYear) return true;
    }
    if (!born && !died) return true;
    return false;
  });
}

function minify(db) {
  db.forEach((info) => {
    for (const [k, v] of Object.entries(info)) {
      if (!v || v == "") {
        delete info[k];
      }
    }
  });
  return db;
}

function getDirName(filePath) {
  const dir = filePath.split("/")[1];
  if (filePath.endsWith("list.json")) {
    return dir;
  } else {
    return dir.slice(0, -5); // remove ".json"
  }
}

function complementTable(info, data) {
  const country = info.country;
  const composer = info.composer;
  const maintainer = info.maintainer;
  const web = info.web;
  const license = info.license;
  data.forEach((datum) => {
    if (!datum.country && country) datum.country = country;
    if (!datum.composer && composer) datum.composer = composer;
    if (!datum.maintainer && maintainer) datum.maintainer = maintainer;
    if (!datum.web) datum.web = web;
    if (!datum.license) datum.license = license;
  });
}

function getCollections() {
  const json = Deno.readTextFileSync("docs/collections.json");
  const data = JSON.parse(json);
  const collections = new Map();
  data.forEach((datum) => {
    collections.set(datum.id, datum);
  });
  return collections;
}

const collections = getCollections();
const jsonFiles = [
  "src/piano-midi.de/list.json",
  "src/ClassicalMusicSymposium.json",
];
jsonFiles.forEach((jsonFile) => {
  console.log(jsonFile);
  const dir = getDirName(jsonFile);
  const json = Deno.readTextFileSync(jsonFile);
  const originalData = JSON.parse(json);
  const data = structuredClone(originalData);
  complementTable(collections.get(dir), data);
  const usefulData = filterCopyright(data);
  const fileSet = new Set(usefulData.map((datum) => datum.file));
  const filtered = originalData.filter((datum) => fileSet.has(datum.file));
  minify(filtered);
  const result = JSON.stringify(filtered, null, "\t");
  Deno.mkdirSync(`docs/json/${dir}`, { recursive: true });
  Deno.writeTextFileSync(`docs/json/${dir}/list.json`, result);
});

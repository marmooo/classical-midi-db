const db = [];
const csv = Deno.readTextFileSync("list.tsv");
csv.trimEnd().split("\n").slice(1).forEach((line) => {
  const rows = line.split("\t");
  const composer = rows[0];
  const born = rows[1];
  const died = rows[2];
  let title = rows[3];
  const part = rows[4];
  // const tempo = rows[5];
  // const duration = rows[6];
  // const date = rows[7];
  // const size = rows[8];
  // const url = rows[9];
  const midiFile = rows[10].split("/").at(-1);
  let date = "";
  const matched = title.match(/ \(([0-9]{4,4})\)$/);
  if (matched) {
    date = matched[1];
    title = title.slice(0, -7);
  }
  const info = {
    title: title,
    composer: composer,
    born: born,
    died: died,
    opus: part,
    date: date,
    file: `piano-midi.de/${midiFile}`,
  };
  db.push(info);
});
Deno.writeTextFileSync("list.json", JSON.stringify(db, null, "\t"));

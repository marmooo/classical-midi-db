import { existsSync } from "@std/fs";

const text = Deno.readTextFileSync("list.tsv");
text.trimEnd().split("\n").forEach((line) => {
  const midiUrl = line.split("\t")[10];
  const midiFile = midiUrl.split("/").at(-1);
  if (!existsSync(`../../docs/www.piano-midi.de/${midiFile}`)) {
    console.log(midiFile);
  }
});

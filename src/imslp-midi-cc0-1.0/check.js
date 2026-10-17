import { parseMidi } from "midi-file";

function tryParse(path) {
  try {
    parseMidi(Deno.readFileSync(path));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// control: known-good file from piano-midi.de
const control = "docs/piano-midi.de/alb_esp1.mid";
console.log("control piano-midi.de:", tryParse(control));

const dir = "docs/imslp-midi-cc0-1.0";
const ok = [];
const bad = [];
for await (const e of Deno.readDir(dir)) {
  if (!e.name.endsWith(".mid")) continue;
  const msg = tryParse(`${dir}/${e.name}`);
  if (msg === null) ok.push(e.name);
  else bad.push([e.name, msg]);
}
console.log(`ok=${ok.length} bad=${bad.length}`);
const reasons = new Map();
for (const [, m] of bad) reasons.set(m, (reasons.get(m) ?? 0) + 1);
console.log("reasons:");
for (const [m, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${m}`);
console.log("sample bad:");
for (const [n, m] of bad.slice(0, 8)) console.log(`  ${n}  ::  ${m}`);

import { expandGlobSync } from "@std/fs";
import { parseMidi } from "midi-file";

function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const s = seconds % 60;
  const m = (seconds - s) / 60;
  const h = (seconds - s - 60 * m) / 3600;
  const ss = String(s).padStart(2, "0");
  const mm = (m > 9 || !h) ? `${m}:` : `0${m}:`;
  const hh = h ? `${h}:` : "";
  return `${hh}${mm}${ss}`;
}

function processMidi(buffer) {
  const parsed = parseMidi(buffer);
  const ppq = parsed.header.ticksPerBeat;
  let totalNotes = 0;
  let lastTick = 0;
  let fallbackLastTick = 0;
  let currentBpm = 120;
  let firstBpm = 120;
  let firstTempoFound = false;
  let tempoTick = 0;
  let tempoTime = 0;
  const channels = Array.from({ length: 16 }, () => ({
    bankMSB: 0,
    bankLSB: 0,
    programNumber: 0,
    isDrum: false,
    hasNotes: false,
    hasProgramChange: false,
  }));
  for (const track of parsed.tracks) {
    let tick = 0;
    let trackEndTick = 0;
    for (const event of track) {
      tick += event.deltaTime;
      fallbackLastTick = Math.max(fallbackLastTick, tick);
      if (event.type === "setTempo") {
        const bpm = 60000000 / event.microsecondsPerBeat;
        if (!firstTempoFound) {
          firstBpm = bpm;
          firstTempoFound = true;
        }
        const elapsed = tick - tempoTick;
        tempoTime += elapsed / ppq * (60 / currentBpm);
        currentBpm = bpm;
        tempoTick = tick;
      }
      if (event.type === "controller") {
        const ch = event.channel;
        if (ch !== undefined) {
          if (event.controllerType === 0) {
            channels[ch].bankMSB = event.value;
            if (event.value === 120) {
              channels[ch].isDrum = true;
            } else if (event.value === 121) {
              channels[ch].isDrum = false;
            }
          } else if (event.controllerType === 32) {
            channels[ch].bankLSB = event.value;
          }
        }
      }
      if (event.type === "programChange") {
        const ch = event.channel;
        if (ch !== undefined) {
          channels[ch].programNumber = event.programNumber;
          channels[ch].hasProgramChange = true;
        }
      }
      if (event.type === "noteOn") {
        const ch = event.channel;
        if (ch !== undefined) {
          channels[ch].hasNotes = true;
        }
        totalNotes++;
      }
      if (event.type === "endOfTrack") {
        trackEndTick = tick;
      }
    }
    lastTick = Math.max(lastTick, trackEndTick);
  }
  if (lastTick === 0) {
    lastTick = fallbackLastTick;
  }
  const instruments = new Set();
  for (const ch of channels) {
    if (ch.hasNotes) {
      if (ch.hasProgramChange) {
        instruments.add(ch.isDrum ? 128 : ch.programNumber);
      } else {
        instruments.add(0);
      }
    }
  }
  const elapsed = lastTick - tempoTick;
  const maxTime = tempoTime + elapsed / ppq * (60 / currentBpm);
  return {
    totalSeconds: maxTime,
    noteCount: totalNotes,
    bpm: Math.ceil(firstBpm),
    instruments: Array.from(instruments).sort((a, b) => a - b).join(","),
  };
}

// const jsonFiles = expandGlobSync("docs/json/**/*.json", { globstar: true });
const jsonFiles = [
  "src/piano-midi.de/list.json",
  "src/ClassicalMusicSymposium/list.json",
  "src/imslp-midi-cc0-1.0/list.json",
  "src/imslp-midi-by-sa/list.json",
];
for (const filePath of jsonFiles) {
  const json = Deno.readTextFileSync(filePath);
  const db = JSON.parse(json);
  for (const info of db) {
    const midiFile = "docs/" + info.file;
    console.log(midiFile);
    const buffer = Deno.readFileSync(midiFile);
    const result = processMidi(buffer);
    info.time = formatTime(result.totalSeconds);
    info.difficulty = result.totalSeconds > 0
      ? Math.round(result.noteCount / result.totalSeconds)
      : 0;
    info.bpm = result.bpm;
    info.instruments = result.instruments;
  }
  const filtered = db.filter((info) => info.difficulty > 0);
  Deno.writeTextFileSync(filePath, JSON.stringify(filtered, null, "\t"));
}

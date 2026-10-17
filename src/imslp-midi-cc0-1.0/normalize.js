// Normalize IMSLP composer names of the form "Last, First [Middle]" to
// "First [Middle] Last". Names without a comma (single names, "Anonymous",
// "Traditional", ...) are returned unchanged.
export function normalizeComposer(name) {
  if (!name) return name;
  const pos = name.indexOf(",");
  if (pos === -1) return name.trim();
  const last = name.slice(0, pos).trim();
  const first = name.slice(pos + 1).trim();
  if (!last || !first) return name.trim();
  return `${first} ${last}`;
}

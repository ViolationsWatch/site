// Splits the permanent archive (archive.json, written by the connector) into one file per year, so the
// archive page and the incident pages load one year at a time instead of the whole record.
// Runs on every deploy. The output (archive-data/) is not committed; archive.json and archive.csv stay
// the complete downloads. Incidents are filed by the year in their VW number (VW-2026-… -> 2026.json),
// which never changes, so a citation always points to the same file.
// Uses no packages, so it runs before `npm ci`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'archive-data');
let src = {updated: null, incidents: []};
try { src = JSON.parse(fs.readFileSync(path.join(ROOT, 'archive.json'), 'utf8')); } catch (e) { console.warn('archive.json missing or unreadable; writing an empty archive index'); }
const rows = Array.isArray(src.incidents) ? src.incidents : [];

const byYear = new Map();
for (const r of rows) {
  const m = /^VW-(\d{4})-\d{4}$/.exec(r && r.id || ''); if (!m) continue;
  if (!byYear.has(m[1])) byYear.set(m[1], []);
  byYear.get(m[1]).push(r);
}
fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
const years = [...byYear.keys()].sort().reverse().map((y) => {
  fs.writeFileSync(path.join(OUT, y + '.json'), JSON.stringify({updated: src.updated, year: Number(y), incidents: byYear.get(y)}));
  return {year: Number(y), count: byYear.get(y).length, file: '/archive-data/' + y + '.json'};
});
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({updated: src.updated, total: rows.length, years}, null, 1));
console.log(`Archive: ${rows.length} incidents in ${years.length} year file(s)`);

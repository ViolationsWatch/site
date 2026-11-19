// Weekly roundup image for social posts: a world map with this week's incidents as highlights,
// coloured by type, with totals. Not part of the site build: run it by hand or from the weekly post task.
//   node scripts/weekly-card.mjs [--to YYYY-MM-DD] [--days 7] [--out weekly.png]
// Uses the incidents in data.json first reported in the window (UTC days, ending on --to, default today).
// Deliberately left off: country borders (several are disputed), alleged perpetrators, names and legal claims.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {geoEquirectangular, geoPath, geoGraticule10} from 'd3-geo';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const {feature} = require('topojson-client');
const {Resvg} = require('@resvg/resvg-js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const days = +arg('days', 7), to = new Date((arg('to') || new Date().toISOString().slice(0, 10)) + 'T23:59:59Z');
const from = new Date(to.getTime() - days * 864e5 + 1000), out = path.resolve(arg('out', 'weekly.png'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const font = (p) => opentype.loadSync(path.join(ROOT, 'node_modules/@expo-google-fonts', p));
const F = {brand: font('archivo/800ExtraBold/Archivo_800ExtraBold.ttf'), bold: font('archivo/700Bold/Archivo_700Bold.ttf'),
  semi: font('archivo/600SemiBold/Archivo_600SemiBold.ttf'), sans: font('ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'), mono: font('ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf')};
const clean = (f, s) => [...String(s)].filter((c) => /\s/.test(c) || f.charToGlyphIndex(c) > 0).join('');
const width = (f, s, size, ls = 0) => f.getAdvanceWidth(clean(f, s), size, {letterSpacing: ls});
const text = (f, s, x, y, size, fill, ls = 0) => `<path fill="${fill}" d="${f.getPath(clean(f, s), x, y, size, {letterSpacing: ls}).toPathData(1)}"/>`;

// one colour group per incident: the first group (in this order) that any of its types falls into
const GROUPS = [
  ['Strikes and killings', '#ff7a6b', ['Mass atrocity / genocide', 'Killing of civilians', 'Air / drone / artillery strike', 'Executions']],
  ['Attacks on health, aid and schools', '#4fd1c5', ['Attacks on healthcare & aid']],
  ['Torture and sexual violence', '#f39bc6', ['Torture & ill-treatment', 'Sexual & gender-based violence']],
  ['Abductions and detention', '#ffc266', ['Abduction & hostage-taking', 'Arbitrary detention & disappearance']],
  ['Journalists and civic space', '#b9a1f5', ['Attacks on journalists', 'Persecution & repression']],
  ['Displacement, siege and property', '#7cc4f2', ['Forced displacement', 'Starvation & siege', 'Destruction of property']]];
const groupOf = (r) => { const t = r.types || []; if ((r.grave_violations || []).includes('attacks_schools_hospitals')) return 1;
  const i = GROUPS.findIndex(([, , ts]) => ts.some((x) => t.includes(x))); return i < 0 ? 0 : i; };

const all = (read('data.json').incidents || []).filter((r) => { const t = Date.parse(r.first_reported); return t >= from && t <= to; });
const placed = all.filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number');
const countries = new Set(all.map((r) => r.location && r.location.replace(/^Palestine \(.+\)$/, 'Palestine')).filter((l) => l && l !== 'Unlocated'));
const kids = all.filter((r) => r.children === true || (r.grave_violations || []).length).length;
const severe = (r) => ({Critical: 3, High: 2, Medium: 1, Low: 1}[r.priority] || 1);
const fmt = (d, o) => d.toLocaleDateString('en-GB', {timeZone: 'UTC', ...o});
const range = from.getUTCMonth() === to.getUTCMonth() ? fmt(from, {day: 'numeric'}) + '–' + fmt(to, {day: 'numeric', month: 'long', year: 'numeric'})
  : fmt(from, {day: 'numeric', month: 'long'}) + ' – ' + fmt(to, {day: 'numeric', month: 'long', year: 'numeric'});

const W = 1200, H = 1200, M = 56;
const land = feature(read('world-50m.json'), read('world-50m.json').objects.land);
// crop to the inhabited latitudes so the map fills the width
const proj = geoEquirectangular().fitExtent([[0, 330], [W, 860]], {type: 'MultiPoint', coordinates: [[-180, 72], [180, 72], [180, -52], [-180, -52]]}).precision(0.3);
const geo = geoPath(proj);
const counts = GROUPS.map(() => 0); placed.forEach((r) => counts[groupOf(r)]++); all.filter((r) => !placed.includes(r)).forEach((r) => counts[groupOf(r)]++);
// draw bigger, more serious incidents first so small ones stay visible on top
const dots = placed.slice().sort((a, b) => severe(b) - severe(a)).map((r) => { const [x, y] = proj([r.lon, r.lat]); const c = GROUPS[groupOf(r)][1], s = severe(r);
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${6 + s * 5}" fill="${c}" fill-opacity=".16"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + s * 1.6}" fill="${c}" stroke="#0b1d34" stroke-width="1.2"/>`; }).join('');

const o = [];
o.push(`<rect x="${M}" y="44" width="32" height="32" rx="6" fill="#1f5e8c"/><circle cx="${M + 16}" cy="60" r="8.5" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="${M + 16}" cy="60" r="2.8" fill="#fff"/>`);
o.push(text(F.brand, 'VIOLATIONS WATCH', M + 44, 67, 20, '#fff', 0.07));
o.push(text(F.mono, 'WEEKLY ROUNDUP', M, 136, 18, '#cdb4ea', 0.09));
o.push(text(F.bold, range, M, 196, 50, '#fff'));
const stats = [[String(all.length), all.length === 1 ? 'incident logged' : 'incidents logged'], [String(countries.size), countries.size === 1 ? 'country' : 'countries'], [String(kids), 'involving children']];
let sx = M; stats.forEach(([n, l]) => { o.push(text(F.bold, n, sx, 270, 44, '#fff')); const nw = width(F.bold, n, 44); o.push(text(F.sans, l, sx + nw + 10, 268, 22, '#c4d3e3')); sx += nw + 10 + width(F.sans, l, 22) + 44; });
// legend: two columns, only groups that occur
const used = GROUPS.map((g, i) => [g, counts[i]]).filter(([, n]) => n);
used.forEach(([[name, col], n], i) => { const x = M + (i % 2) * 560, y = 930 + Math.floor(i / 2) * 50;
  o.push(`<circle cx="${x + 9}" cy="${y - 7}" r="9" fill="${col}"/>`, text(F.semi, name, x + 30, y, 23, '#fff'), text(F.mono, String(n), x + 38 + width(F.semi, name, 23), y, 19, '#b6c8db')); });
const foot = 'Open-source leads, not legal findings', site = 'violationswatch.org';
o.push(`<rect x="${M}" y="1110" width="${W - 2 * M}" height="1" fill="#38547a"/>`, text(F.mono, foot, M, 1146, 17, '#b6c8db'), text(F.mono, site, W - M - width(F.mono, site, 17), 1146, 17, '#fff'));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a30"/><stop offset="1" stop-color="#0d2542"/></linearGradient>
<radialGradient id="violet" gradientUnits="userSpaceOnUse" cx="${W * .62}" cy="560" r="640"><stop offset="0" stop-color="#704ebe" stop-opacity=".35"/><stop offset="1" stop-color="#3c4696" stop-opacity="0"/></radialGradient>
<linearGradient id="edge" x1="0" y1="318" x2="0" y2="872" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0b1d34"/><stop offset=".1" stop-color="#0b1d34" stop-opacity="0"/><stop offset=".9" stop-color="#0b1d34" stop-opacity="0"/><stop offset="1" stop-color="#0b1d34"/></linearGradient><clipPath id="mapclip"><rect x="0" y="318" width="${W}" height="554"/></clipPath></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#violet)"/>
<g clip-path="url(#mapclip)"><path d="${geo(geoGraticule10())}" fill="none" stroke="#9fbfe0" stroke-width=".6" stroke-opacity=".12"/><path d="${geo(land)}" fill="#27496f" stroke="#58799f" stroke-width=".5"/></g>
<rect x="0" y="318" width="${W}" height="554" fill="url(#edge)"/>${dots}${o.join('')}</svg>`;
fs.writeFileSync(out, new Resvg(svg, {fitTo: {mode: 'original'}}).render().asPng());
console.log(JSON.stringify({out, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), incidents: all.length, on_map: placed.length, countries: countries.size, children: kids, groups: Object.fromEntries(used.map(([[n], c]) => [n, c]))}));

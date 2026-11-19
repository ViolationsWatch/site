// Builds a shareable page (/i/VW-YYYY-NNNN/) and a link-preview image (/og/...) for each incident.
// Runs on every deploy. The output is not committed. Social networks ignore everything after "#" in a
// link, so each incident needs its own address to get its own preview.
// Images are made only for the current log; archived incidents get a page with the standard site image.
// Deliberately left off the images: photos, country borders, alleged perpetrators and legal citations.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {geoOrthographic, geoPath, geoGraticule10} from 'd3-geo';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const {feature} = require('topojson-client');
const {Resvg} = require('@resvg/resvg-js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://violationswatch.org';
const W = 1200, H = 630, LEFT = 56, TEXT_W = 584;
const read = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return fallback; } };
const font = (p) => opentype.loadSync(path.join(ROOT, 'node_modules/@expo-google-fonts', p));
const F = {
  brand: font('archivo/800ExtraBold/Archivo_800ExtraBold.ttf'), bold: font('archivo/700Bold/Archivo_700Bold.ttf'),
  semi: font('archivo/600SemiBold/Archivo_600SemiBold.ttf'), sans: font('ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'),
  mono: font('ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
};

// The callout: a grave violation against children first, then the most serious type on the record.
const GRAVE = [['recruitment_use', 'Recruitment of children'], ['sexual_violence', 'Sexual violence against children'], ['abduction', 'Abduction of children'],
  ['attacks_schools_hospitals', 'Attack on a school or hospital'], ['killing_maiming', 'Killing and maiming of children'], ['denial_access', 'Denial of humanitarian access']];
const TYPES = [['Mass atrocity / genocide', 'Mass atrocity'], ['Sexual & gender-based violence', 'Sexual violence'], ['Executions', 'Execution'], ['Torture & ill-treatment', 'Torture or ill-treatment'],
  ['Killing of civilians', 'Killing of civilians'], ['Attacks on healthcare & aid', 'Attack on healthcare or aid'], ['Attacks on journalists', 'Attack on journalists'],
  ['Abduction & hostage-taking', 'Abduction or hostage-taking'], ['Starvation & siege', 'Starvation or siege'], ['Air / drone / artillery strike', 'Attack affecting civilians'],
  ['Arbitrary detention & disappearance', 'Arbitrary detention'], ['Forced displacement', 'Forced displacement'], ['Destruction of property', 'Destruction of civilian property'], ['Persecution & repression', 'Persecution or repression']];
function violation(r) {
  const g = Array.isArray(r.grave_violations) ? r.grave_violations : [], t = Array.isArray(r.types) ? r.types : [];
  for (const [k, label] of GRAVE) if (g.includes(k)) return {label, grave: true};
  // a journalist killed or attacked in a small incident: say so, rather than the broader 'Killing of civilians'
  const kill = Array.isArray(r.killed) ? r.killed : [], most = kill[1] != null ? kill[1] : kill[0];
  if (t.includes('Attacks on journalists') && !t.includes('Mass atrocity / genocide') && !(most > 2)) return {label: most >= 1 ? 'Killing of a journalist' : 'Attack on journalists', grave: false};
  for (const [k, label] of TYPES) if (t.includes(k)) return {label, grave: false};
  return {label: 'Reported violation', grave: false};
}
const shortLoc = (s) => String(s || '').replace(/^Palestine \((.+)\)$/, '$1');
function placeOf(r) {
  const loc = r.location && r.location !== 'Unlocated' ? shortLoc(r.location) : '';
  const p = r.place && r.place !== 'Not stated' ? r.place : '';
  return (p && loc && !p.includes(loc) ? p + ', ' + loc : p || loc) || 'Location not stated';
}
const range = (a) => !Array.isArray(a) || a[0] == null ? '' : a[1] != null && a[1] !== a[0] ? a[0] + '–' + a[1] : String(a[0]);
function reported(r) {
  const v = Array.isArray(r.victims) ? r.victims.join(', ') : r.victims;
  if (v) return v;
  const k = range(r.killed), i = range(r.injured);
  return [k && k + ' killed', i && i + ' injured'].filter(Boolean).join(', ');
}
function dateOf(r) {
  const s = String(r.incident_date || r.first_reported || '').slice(0, 10); if (!s) return '';
  const month = s.length === 7, d = new Date(month ? s + '-01T00:00:00Z' : s + 'T00:00:00Z'); if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', {...(month ? {} : {day: 'numeric'}), month: 'long', year: 'numeric', timeZone: 'UTC'});
}
const statusOf = (r) => r.verification === 'verified' ? ['VERIFIED', '#9fe3bd', '#4f9672'] : r.status === 'confirmed' ? ['CONFIRMED', '#9fe3bd', '#4f9672'] : ['LEAD: UNVERIFIED', '#ffd58a', '#a9863f'];

/* ---------- drawing ---------- */
const clean = (f, s) => [...String(s)].filter((c) => /\s/.test(c) || f.charToGlyphIndex(c) > 0).join('');
const width = (f, s, size, ls = 0) => f.getAdvanceWidth(clean(f, s), size, {letterSpacing: ls});
const text = (f, s, x, y, size, fill, ls = 0) => `<path fill="${fill}" d="${f.getPath(clean(f, s), x, y, size, {letterSpacing: ls}).toPathData(1)}"/>`;
function wrap(f, s, size, max, maxLines) {
  const lines = []; let cur = '';
  for (const w of String(s).trim().split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (width(f, t, size) <= max || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { let l = lines.slice(0, maxLines).pop(); while (l && width(f, l + '…', size) > max) l = l.replace(/\s*\S+$/, ''); return [...lines.slice(0, maxLines - 1), l + '…']; }
  return lines;
}
const land = feature(read('world-50m.json'), read('world-50m.json').objects.land);
function svgFor(r) {
  const has = typeof r.lat === 'number' && typeof r.lon === 'number', cx = 955, cy = 322;
  const zoom = {town: [760, 22, true], district: [760, 22, true], region: [460, 42, false]}[r.precision] || [300, 64, false];
  const [scale, ring, solid] = has ? zoom : [300, 0, false];
  const proj = geoOrthographic().rotate(has ? [-r.lon, -r.lat] : [-20, -10]).scale(scale).translate([cx, cy]).clipAngle(90).precision(0.4);
  const geo = geoPath(proj), v = violation(r), [st, stC, stB] = statusOf(r);
  const heads = wrap(F.bold, v.label, 60, TEXT_W, 3), plc = wrap(F.semi, placeOf(r), 28, TEXT_W, 2), rep = reported(r), reps = rep ? wrap(F.sans, 'Reported: ' + rep, 22, TEXT_W, 2) : [];
  const note = v.grave ? 'One of six grave violations against children monitored by the UN' : '';
  // stack the main block, centred between the status label and the footer
  const h = 16 + 14 + heads.length * 64 + 22 + plc.length * 34 + (reps.length ? 6 + reps.length * 29 : 0) + (note ? 30 : 0);
  let y = Math.max(166, 150 + (400 - h) / 2) + 14; const o = [];
  o.push(text(F.mono, 'POSSIBLE VIOLATION', LEFT, y, 16, '#cdb4ea', 0.09)); y += 14;
  for (const l of heads) { y += 60; o.push(text(F.bold, l, LEFT, y, 60, '#fff')); y += 4; }
  y += 18; for (const l of plc) { y += 30; o.push(text(F.semi, l, LEFT, y, 28, '#fff')); y += 4; }
  if (reps.length) { y += 6; for (const l of reps) { y += 24; o.push(text(F.sans, l, LEFT, y, 22, '#c4d3e3')); y += 5; } }
  if (note) { y += 26; o.push(text(F.mono, note, LEFT, y, 14, '#cdb4ea')); }
  if (y > 548) throw new Error('text block too tall: ' + Math.round(y));
  const stW = width(F.mono, st, 14, 0.05) + 22, site = 'violationswatch.org', siteW = width(F.mono, site, 14);
  let foot = [r.id, shortLoc(r.location === 'Unlocated' ? '' : r.location), dateOf(r)].filter(Boolean).join(' · ');
  if (width(F.mono, foot, 14) > TEXT_W - siteW - 16) foot = [r.id, dateOf(r)].filter(Boolean).join(' · ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a30"/><stop offset="1" stop-color="#0d2542"/></linearGradient>
<radialGradient id="violet" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="520"><stop offset="0" stop-color="#704ebe" stop-opacity=".5"/><stop offset=".62" stop-color="#3c4696" stop-opacity=".2"/><stop offset="1" stop-color="#3c4696" stop-opacity="0"/></radialGradient>
<radialGradient id="corner" gradientUnits="userSpaceOnUse" cx="0" cy="${H}" r="620"><stop offset="0" stop-color="#1b5c96" stop-opacity=".28"/><stop offset="1" stop-color="#1b5c96" stop-opacity="0"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#e6d6f8" stop-opacity=".8"/><stop offset=".55" stop-color="#cdb4ea" stop-opacity=".32"/><stop offset="1" stop-color="#cdb4ea" stop-opacity="0"/></radialGradient>
<linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#0b1d34"/><stop offset=".47" stop-color="#0b1d34" stop-opacity=".92"/><stop offset=".55" stop-color="#0b1d34" stop-opacity=".6"/><stop offset=".64" stop-color="#0b1d34" stop-opacity=".18"/><stop offset=".72" stop-color="#0b1d34" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#violet)"/><rect width="${W}" height="${H}" fill="url(#corner)"/>
<path d="${geo({type: 'Sphere'})}" fill="#0d2542" fill-opacity=".72" stroke="#5d7da3" stroke-width="1.2"/><path d="${geo(geoGraticule10())}" fill="none" stroke="#9fbfe0" stroke-width=".7" stroke-opacity=".17"/><path d="${geo(land)}" fill="#27496f" stroke="#58799f" stroke-width=".6"/>
${has ? `<circle cx="${cx}" cy="${cy}" r="${ring * 1.7}" fill="url(#glow)"/><circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="#e6d6f8" stroke-width="2"${solid ? '' : ' stroke-dasharray="5 6"'}/><circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>` : ''}
<rect width="${W}" height="${H}" fill="url(#fade)"/>
<rect x="${LEFT}" y="42" width="32" height="32" rx="6" fill="#1f5e8c"/><circle cx="${LEFT + 16}" cy="58" r="8.5" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="${LEFT + 16}" cy="58" r="2.8" fill="#fff"/>
${text(F.brand, 'VIOLATIONS WATCH', LEFT + 44, 65, 20, '#fff', 0.07)}
<rect x="${LEFT + .5}" y="102.5" width="${stW}" height="31" rx="4" fill="${stC}" fill-opacity=".09" stroke="${stB}"/>${text(F.mono, st, LEFT + 11, 123, 14, stC, 0.05)}
${o.join('')}<rect x="${LEFT}" y="560" width="${TEXT_W}" height="1" fill="#38547a"/>${text(F.mono, foot, LEFT, 590, 14, '#b6c8db')}${text(F.mono, site, LEFT + TEXT_W - siteW, 590, 14, '#fff')}</svg>`;
}

/* ---------- pages ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function page(r, image, target) {
  const v = violation(r), title = 'Possible violation: ' + v.label + ', ' + placeOf(r), url = `${SITE}/i/${r.id}/`;
  const status = r.status === 'confirmed' || r.verification === 'verified' ? 'Reviewed by an analyst.' : 'Unverified lead, not a finding.';
  const lead = String(r.headline || '').trim(), desc = (lead ? lead.replace(/[.;:,]?$/, '.') + ' ' : '') + status, img = image ? `${SITE}/og/${image}` : `${SITE}/og.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · Violations Watch</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${url}"><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Violations Watch"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title + '. ' + status)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
<script>location.replace(${JSON.stringify(target)});</script></head><body><p><a href="${target}">Open ${esc(r.id)} on Violations Watch</a></p></body></html>`;
}

/* ---------- build ---------- */
const VALID = /^VW-\d{4}-\d{4}$/;
for (const d of ['i', 'og']) { fs.rmSync(path.join(ROOT, d), {recursive: true, force: true}); fs.mkdirSync(path.join(ROOT, d), {recursive: true}); }
const live = (read('data.json', {}).incidents || []).filter((r) => r && VALID.test(r.id)), archived = (read('archive.json', {}).incidents || []).filter((r) => r && VALID.test(r.id));
const put = (r, html) => { const d = path.join(ROOT, 'i', r.id); fs.mkdirSync(d, {recursive: true}); fs.writeFileSync(path.join(d, 'index.html'), html); };
let ok = 0, failed = 0; const t0 = Date.now();
for (const r of live) {
  let image = null;
  try {
    const svg = svgFor(r);
    image = `${r.id}-${crypto.createHash('sha1').update(svg).digest('hex').slice(0, 8)}.png`; // a new name whenever the image changes, so networks fetch the new one
    fs.writeFileSync(path.join(ROOT, 'og', image), new Resvg(svg, {fitTo: {mode: 'original'}}).render().asPng()); ok++;
  } catch (e) { image = null; failed++; console.warn('preview image failed for', r.id, e.message); }
  put(r, page(r, image, '/#' + r.id));
}
for (const r of archived) put(r, page(r, null, '/archive#' + r.id));
console.log(`Previews: ${ok} images, ${failed} failed, ${live.length + archived.length} pages, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

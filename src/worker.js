// Violations Watch Worker. Everything is still served from the static files in this repository, except:
//   /i/VW-YYYY-NNNN/        a real, indexable page for one incident, rendered from data.json or the archive
//   /sitemap-incidents.xml  every published incident, for search engines
// and a redirect from www.violationswatch.org to violationswatch.org for the paths that reach this code.
// wrangler.jsonc sends only those paths here first ("run_worker_first"); all other requests go straight to the files.
// The data is read from the deployed static files (env.ASSETS), so the daily data commit updates these pages too.

const SITE = 'https://violationswatch.org';
const ID = /^VW-\d{4}-\d{4}$/;
const TTL = 60 * 1000; // re-read the data files at most once a minute per Worker instance

// the same security headers as _headers (which only applies to static files)
const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/* ---------- data ---------- */
const cache = new Map();
async function asset(env, origin, p) {
  const hit = cache.get(p);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value = null;
  try { const r = await env.ASSETS.fetch(new Request(origin + p)); if (r.ok) value = await r.json(); } catch (e) { value = null; }
  cache.set(p, {at: Date.now(), value});
  return value;
}
// an incident in the current log, or in the archive file for its year (archive.json if the per-year files are missing)
async function findIncident(env, origin, id) {
  const live = await asset(env, origin, '/data.json');
  const r = live && (live.incidents || []).find((x) => x && x.id === id);
  if (r) return {r, archived: false, updated: live.updated};
  const year = id.slice(3, 7), idx = await asset(env, origin, '/archive-data/index.json'), split = idx && Array.isArray(idx.years);
  const ar = !split ? await asset(env, origin, '/archive.json') : idx.years.some((y) => String(y.year) === year) ? await asset(env, origin, '/archive-data/' + year + '.json') : null;
  const a = ar && (ar.incidents || []).find((x) => x && x.id === id);
  return a ? {r: a, archived: true, updated: ar.updated} : null;
}
async function allIncidents(env, origin) {
  const live = await asset(env, origin, '/data.json'), idx = await asset(env, origin, '/archive-data/index.json');
  let archived = [];
  if (idx && Array.isArray(idx.years)) for (const y of idx.years) { const f = await asset(env, origin, '/archive-data/' + y.year + '.json'); archived = archived.concat((f && f.incidents) || []); }
  else { const f = await asset(env, origin, '/archive.json'); archived = (f && f.incidents) || []; }
  const seen = new Set(), out = [];
  for (const r of [...((live && live.incidents) || []), ...archived]) if (r && ID.test(r.id) && !seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out;
}

/* ---------- formatting ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fd = (s) => { if (!s) return ''; const month = /^\d{4}-\d{2}$/.test(s), d = new Date(month ? s + '-01T00:00:00Z' : s); return isNaN(d) ? String(s) : d.toLocaleDateString('en-GB', {...(month ? {} : {day: 'numeric'}), month: 'long', year: 'numeric', timeZone: 'UTC'}); };
const rng = (r) => { r = Array.isArray(r) ? r : []; return r[0] == null && r[1] == null ? '' : r[0] === r[1] || r[1] == null ? String(r[0]) + (r[1] == null && r[0] != null && r[0] > 0 ? '+' : '') : (r[0] ?? '?') + '–' + r[1]; };
const txt = (v) => Array.isArray(v) ? v.join(', ') : (v || '');
const shortLoc = (s) => String(s || '').replace(/^Palestine \((.+)\)$/, 'Palestine: $1');
const GV = {killing_maiming: 'Killing and maiming', recruitment_use: 'Recruitment and use', sexual_violence: 'Rape and other sexual violence', attacks_schools_hospitals: 'Attacks on schools and hospitals', abduction: 'Abduction', denial_access: 'Denial of humanitarian access'};
const STATUS = {
  lead: ['Lead', 'st-lead', 'Unverified lead, not a finding.', 'This entry records what was reported, by whom and when. It has not been checked by an analyst. Read the original reports before relying on it.'],
  confirmed: ['Confirmed', 'st-confirmed', 'Reviewed by an analyst.', 'An analyst has reviewed the reports: they describe a real event within scope, with the details as given. It has not been independently verified.'],
  verified: ['Verified', 'st-verified', 'Independently verified by an analyst.', 'An analyst has checked this independently, for example by geolocating footage or corroborating it with independent sources.'],
};
const statusOf = (r) => STATUS[r.verification === 'verified' ? 'verified' : r.status] || STATUS.lead;

function sourceType(table, u) {
  if (!table || !table.domains) return null;
  let h = ''; try { h = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return null; }
  const p = h.split('.');
  for (let i = 0; i < p.length - 1; i++) { const k = table.domains[p.slice(i).join('.')]; if (k && table.types[k]) return {key: k, ...table.types[k]}; }
  return {key: 'unclassified', label: 'Unclassified', note: 'Not yet in our list of source types. Check who published it.'};
}

/* ---------- pages ---------- */
function shell({title, desc, canonical, image, robots, body, extraHead = ''}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots ? `<meta name="robots" content="${robots}">\n` : ''}${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="Violations Watch: new incidents" href="/feed.xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Violations Watch">
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${image}">
<meta name="theme-color" content="#0b1d33">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,600..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/site.css">
${extraHead}</head>
<body>
<div class="dark top">
<div class="sysbar">
  <div class="wrap">
    <a class="brand" href="/"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#1f5e8c"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16" r="2.8" fill="#fff"/></svg>VIOLATIONS WATCH</a>
    <nav aria-label="Sections"><a href="/">Latest 28 days</a><a href="/archive">Archive</a><a href="/#method">Method</a><a href="/mechanisms">Mechanisms</a><a href="/blog/">Blog</a></nav>
  </div>
</div>
${body}
</body>
</html>`;
}

const FOOTER = `<footer><span>Violations Watch links to third-party reporting and does not endorse the sources it lists. Method, status labels and corrections: <a href="/#method">see the main page</a>.</span><span class="follow">Follow: <a href="https://bsky.app/profile/violationswatch.bsky.social" target="_blank" rel="noopener me">Bluesky</a> · <a href="https://www.linkedin.com/company/violations-watch-osint-for-human-rights/" target="_blank" rel="noopener me">LinkedIn</a> · <a href="/feed.xml">RSS</a></span></footer>`;

function incidentPage(found, sources, ogIndex) {
  const {r, archived} = found, url = `${SITE}/i/${r.id}/`, [stLabel, stClass, stShort, stLong] = statusOf(r);
  const place = [r.place && r.place !== 'Not stated' ? r.place : '', r.subregion, r.location && r.location !== 'Unlocated' ? r.location : ''].filter(Boolean).filter((x, i, a) => !a.slice(0, i).some((y) => y.includes(x))).join(', ');
  const headline = String(r.headline || r.id).trim();
  const cut = headline.length > 110 ? headline.slice(0, 107).replace(/\s+\S*$/, '') + '…' : headline;
  const title = `${cut} · ${r.id} · Violations Watch`;
  const desc = `${headline.replace(/[.;:,]?$/, '.')} ${stShort} Reported ${fd(r.first_reported)}${place ? ' · ' + place : ''}.`;
  const image = ogIndex && ogIndex[r.id] ? `${SITE}/og/${ogIndex[r.id]}` : `${SITE}/og.png`;
  const gv = (Array.isArray(r.grave_violations) ? r.grave_violations : []).filter((g) => GV[g]);
  const k = rng(r.killed), j = rng(r.injured), ck = rng(r.children_killed), cj = rng(r.children_injured);
  const facts = [
    ['Location', place ? place + (typeof r.lat === 'number' && typeof r.lon === 'number' ? ` · ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}` : '') + (r.precision && r.precision !== 'town' ? ` (${r.precision} level)` : '') : 'Not stated'],
    ['Date of incident', r.incident_date ? fd(r.incident_date) : 'Not stated in reports'],
    ['Reported', fd(r.first_reported) + (r.last_reported && r.last_reported !== r.first_reported ? ' to ' + fd(r.last_reported) : '')],
    ['Alleged perpetrator', r.perpetrator ? r.perpetrator + (r.actor_type ? ` (${r.actor_type} actor)` : '') : 'Not stated'],
    ['Victims', txt(r.victims)],
    ['Reported casualties', [k && k + ' killed', j && j + ' injured'].filter(Boolean).join(', ') || 'Not stated'],
    ['Violation types', (r.types || []).join(', ')],
    ['Priority', r.priority],
    ...(gv.length ? [['Grave violations against children', gv.map((g) => GV[g]).join(', ')]] : []),
    ...(gv.length && (ck || cj) ? [['Children among casualties', [ck && ck + ' killed', cj && cj + ' injured'].filter(Boolean).join(', ')]] : []),
    ['Sources', (r.sources ?? (r.links || []).length) + ((r.sources ?? (r.links || []).length) === 1 ? ' outlet or account' : ' outlets or accounts') + (r.cumulative ? ' · aggregate or period report' : '')],
  ].filter(([, v]) => v != null && v !== '');
  const arch = new Map((r.archives || []).map((a) => [a.url, a]));
  const links = (r.links || []).map((u) => {
    const t = sourceType(sources, u), a = arch.get(u);
    return `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(u)}</a>${t ? ` <span class="srct srct-${esc(t.key)}" title="${esc(t.note)}">${esc(t.label)}</span>` : ''}${a ? ` · <a href="${esc(a.archived_url)}" target="_blank" rel="noopener noreferrer nofollow">archived ${esc(fd(a.at))}</a>` : ''}</li>`;
  }).join('\n');
  const where = archived ? `/archive#${r.id}` : `/#${r.id}`;
  // structured data: a plain description of the page, with no claims beyond what the page shows
  const ld = {'@context': 'https://schema.org', '@type': 'WebPage', name: cut, url, description: desc, datePublished: r.first_reported, dateModified: r.last_reported || r.first_reported,
    isPartOf: {'@type': 'Dataset', name: 'Violations Watch', url: SITE + '/'}, identifier: r.id};
  const body = `<div class="wrap">
  <header class="mast incident">
    <p class="period"><span class="k">${esc(r.id)}</span> <span class="st ${stClass}">${esc(stLabel)}</span>${r.priority ? ` <span class="pr ${esc(r.priority)}">${esc(r.priority)}</span>` : ''}${gv.length ? ' <span class="cv">Children</span>' : ''}${archived ? ' <span class="k">In the archive</span>' : ''}</p>
    <h1>${esc(headline)}</h1>
    <div class="warn" role="note"><b>${esc(stShort)}</b> ${esc(stLong)}</div>
  </header>
</div>
</div>
<div class="wrap">
<main class="incident-page">
  <dl class="facts">
${facts.map(([a, b]) => `    <div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('\n')}
  </dl>
${r.disputed ? `  <section><h2 class="sub">Disputed or caveats</h2><p>${esc(r.disputed)}</p></section>\n` : ''}  <section><h2 class="sub">Original reports</h2>
  <p class="note">Each link is labelled with the type of outlet that published it. The label describes the outlet, not the accuracy of this report.</p>
  <ul class="links">
${links || '<li>No links recorded.</li>'}
  </ul></section>
  <section class="permalink"><p>Cite as: <i>Violations Watch</i>, ${esc(r.id)}, accessed [date], ${esc(url)}</p>
  <p><a href="${where}">Open ${esc(r.id)} in the ${archived ? 'archive' : 'interactive log'}</a> for the map, legal frameworks and treaty status. Spotted an error? Email <a href="mailto:violationswatch@proton.me?subject=${encodeURIComponent('Correction: ' + r.id)}">violationswatch@proton.me</a> with the VW number and a source.</p></section>
</main>
${FOOTER}
</div>`;
  return shell({title, desc, canonical: url, image, robots: 'index, follow, max-image-preview:large', body,
    extraHead: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n`});
}

function notFoundPage(id) {
  const body = `<div class="wrap"><header class="mast incident"><h1>${esc(id || 'Incident')} is not in the log</h1>
  <div class="warn" role="note">This incident is not in the current log or the archive. It may have been withdrawn after review, merged into another entry, or the number may be mistyped. Search the <a href="/">latest 28 days</a> or the <a href="/archive">archive</a>, or email violationswatch@proton.me.</div></header></div>
</div>
<div class="wrap">${FOOTER}</div>`;
  return shell({title: `${id || 'Incident'} not found · Violations Watch`, desc: 'This incident is not in the Violations Watch log.', image: `${SITE}/og.png`, robots: 'noindex', body});
}

function sitemap(rows) {
  const day = (s) => { const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
  const urls = rows.map((r) => { const m = day(r.last_reported || r.first_reported); return `  <url><loc>${SITE}/i/${r.id}/</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`; });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const html = (body, status = 200, extra = {}) => new Response(body, {status, headers: {'Content-Type': 'text/html; charset=utf-8', ...SECURITY, ...extra}});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith('www.')) { url.hostname = url.hostname.slice(4); url.protocol = 'https:'; return Response.redirect(url.toString(), 301); }
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    const origin = url.origin;

    if (url.pathname === '/sitemap-incidents.xml') {
      const rows = await allIncidents(env, origin);
      return new Response(request.method === 'HEAD' ? null : sitemap(rows), {headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'}});
    }

    const m = /^\/i\/([^/]+)\/?$/.exec(url.pathname);
    if (m) {
      const id = decodeURIComponent(m[1]).toUpperCase();
      if (!ID.test(id)) return html(notFoundPage(''), 404, {'Cache-Control': 'public, max-age=300'});
      if (url.pathname !== `/i/${id}/`) return Response.redirect(`${origin}/i/${id}/${url.search}`, 301); // one address per incident
      const found = await findIncident(env, origin, id);
      if (!found) return html(notFoundPage(id), 404, {'Cache-Control': 'public, max-age=300'});
      const [sources, ogIndex] = await Promise.all([asset(env, origin, '/sources.json'), asset(env, origin, '/og/index.json')]);
      const page = incidentPage(found, sources, ogIndex);
      return html(request.method === 'HEAD' ? null : page, 200, {'Cache-Control': 'public, max-age=300'});
    }
    return env.ASSETS.fetch(request);
  },
};

// Source-type labels for the "Original reports" lists: looks up each link's domain in sources.json.
// Used by index.html and archive.html; the Worker's incident pages read the same file.
// Exposes window.VWSources: load() fetches the table once, tag(url) returns a <span> label (or null before loading).
(() => {
  let table = null;
  const host = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
  // a subdomain inherits its parent's type: m.youtube.com -> youtube.com, en.prothomalo.com -> prothomalo.com
  function typeOf(u) {
    if (!table) return null;
    const p = host(u).split('.');
    for (let i = 0; i < p.length - 1; i++) { const k = table.domains[p.slice(i).join('.')]; if (k && table.types[k]) return {key: k, ...table.types[k]}; }
    return {key: 'unclassified', label: 'Unclassified', note: 'Not yet in our list of source types. Check who published it.'};
  }
  function tag(u) {
    const t = typeOf(u); if (!t) return null;
    const s = document.createElement('span'); s.className = 'srct srct-' + t.key; s.textContent = t.label; s.title = t.note; return s;
  }
  function load() { return fetch('/sources.json').then((r) => r.ok ? r.json() : null).then((j) => { if (j && j.domains && j.types) table = j; return table; }).catch(() => null); }
  window.VWSources = {load, typeOf, tag};
})();

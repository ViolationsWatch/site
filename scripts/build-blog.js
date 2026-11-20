// Builds blog/posts.json and sitemap.xml from the Markdown files in blog/posts/ (runs automatically on every deploy).
// Each post starts with front matter between --- lines: title, date (YYYY-MM-DD), summary, author, tags, draft.
// Files starting with "_" (like _template.md) are ignored. Drafts are left out of the sitemap.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'blog', 'posts');
const out = path.join(root, 'blog', 'posts.json');
const posts = [];
for (const file of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  if (!file.endsWith('.md') || file.startsWith('_')) continue;
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const m = src.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) { console.warn('skipped (no front matter):', file); continue; }
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (k) meta[k] = v;
  }
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '')) { console.warn('skipped (needs title and date YYYY-MM-DD):', file); continue; }
  posts.push({
    slug: file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''), file,
    title: meta.title, date: meta.date, summary: meta.summary || '', author: meta.author || '',
    tags: (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean),
    draft: /^(true|yes)$/i.test(meta.draft || ''),
  });
}
posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
fs.writeFileSync(out, JSON.stringify({built: new Date().toISOString(), posts}, null, 2));
console.log('blog: ' + posts.length + ' posts (' + posts.filter((p) => p.draft).length + ' drafts)');

// sitemap.xml: the fixed pages plus every published post, so new posts are listed without editing it by hand
const SITE = 'https://violationswatch.org';
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toISOString().slice(0, 10);
const published = posts.filter((p) => !p.draft);
const urls = [
  {loc: SITE + '/', lastmod: today, changefreq: 'daily', priority: '1.0'},
  {loc: SITE + '/archive', lastmod: today, changefreq: 'daily', priority: '0.7'},
  {loc: SITE + '/mechanisms', changefreq: 'monthly', priority: '0.8'},
  {loc: SITE + '/blog/', lastmod: published.length ? published[0].date : undefined, changefreq: 'weekly', priority: '0.6'},
  ...published.map((p) => ({loc: SITE + '/blog/post.html?p=' + encodeURIComponent(p.slug), lastmod: p.date, priority: '0.6'})),
];
const body = urls.map((u) => '  <url><loc>' + xml(u.loc) + '</loc>' + (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '')
  + (u.changefreq ? '<changefreq>' + u.changefreq + '</changefreq>' : '') + '<priority>' + u.priority + '</priority></url>').join('\n');
fs.writeFileSync(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n');
console.log('sitemap: ' + urls.length + ' urls');

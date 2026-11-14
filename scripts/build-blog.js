// Builds blog/posts.json from the Markdown files in blog/posts/ (runs automatically on every deploy).
// Each post starts with front matter between --- lines: title, date (YYYY-MM-DD), summary, author, tags, draft.
// Files starting with "_" (like _template.md) are ignored.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'blog', 'posts');
const out = path.join(__dirname, '..', 'blog', 'posts.json');
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

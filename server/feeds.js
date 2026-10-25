'use strict';
/* Ilm bo'limi: YouTube kanallaridan yangi podkastlarni avtomatik yig'ish ("o'rgimchak").
   API kalit kerak emas — YouTube'ning ochiq RSS lentasi ishlatiladi. */
const DEFAULT_CHANNELS = [
  { channel_id: 'UCyg6mw1ZvTOFJ-DAnn4CUHQ', title: 'Maqsad', url: 'https://www.youtube.com/@maqsadclub', category: 'podkast' },
];
const UA = { 'User-Agent': 'Mozilla/5.0 (Isloh podcast reader)', 'Accept-Language': 'uz,en' };
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function create(db, log = console.log) {
  for (const c of DEFAULT_CHANNELS) {
    db.run('INSERT OR IGNORE INTO channels (channel_id,title,url,category) VALUES (?,?,?,?)', c.channel_id, c.title, c.url, c.category);
  }

  /* Havola, @handle yoki kanal ID'sidan kanalni aniqlash */
  async function resolve(input) {
    input = String(input || '').trim();
    let m = input.match(/(UC[\w-]{22})/);
    if (m && !/youtube\.com\/@/.test(input)) return { channel_id: m[1], url: `https://www.youtube.com/channel/${m[1]}` };
    let url;
    if ((m = input.match(/^@?([\w.\-]{3,})$/))) url = `https://www.youtube.com/@${m[1]}`;
    else if (/^https?:\/\/(www\.|m\.)?youtube\.com\//.test(input)) url = input.replace('//m.', '//www.');
    else throw new Error("YouTube kanal havolasini kiriting, masalan https://www.youtube.com/@maqsadclub");
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error('Kanal topilmadi');
    const t = await r.text();
    const id = (t.match(/"channelId":"(UC[\w-]{22})"/) || t.match(/\/channel\/(UC[\w-]{22})/) || [])[1];
    if (!id) throw new Error('Kanal topilmadi');
    const title = decode((t.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '');
    return { channel_id: id, title, url };
  }

  async function fetchChannel(ch) {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channel_id}`, { headers: UA });
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    const xml = await r.text();
    const title = decode((xml.match(/<title>([^<]*)<\/title>/) || [])[1] || ch.title);
    let n = 0;
    for (const e of xml.split('<entry>').slice(1)) {
      const id = (e.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/) || [])[1];
      if (!id) continue;
      const vt = decode((e.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
      const pub = Date.parse((e.match(/<published>([^<]*)<\/published>/) || [])[1] || '') || Date.now();
      const desc = decode((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '').slice(0, 600);
      const isShort = /#shorts?\b/i.test(vt + ' ' + desc);
      if (isShort) continue;
      n += db.run('INSERT OR IGNORE INTO videos (id,channel_id,title,published,description) VALUES (?,?,?,?,?)', id, ch.channel_id, vt, pub, desc).changes;
    }
    db.run('UPDATE channels SET title=?, last_fetch=? WHERE channel_id=?', title, Date.now(), ch.channel_id);
    return n;
  }

  async function crawl(force = false) {
    const due = db.all('SELECT * FROM channels WHERE ? OR last_fetch < ?', force ? 1 : 0, Date.now() - 30 * 60e3);
    let added = 0;
    for (const ch of due) {
      try { added += await fetchChannel(ch); } catch (e) { log('feed', ch.channel_id, e.message); }
    }
    return added;
  }

  async function addChannel(user, input, category = 'podkast') {
    const c = await resolve(input);
    db.run('INSERT OR IGNORE INTO channels (channel_id,title,url,category,added_by) VALUES (?,?,?,?,?)', c.channel_id, c.title || '', c.url, category, user.id);
    const ch = db.get('SELECT * FROM channels WHERE channel_id=?', c.channel_id);
    await fetchChannel(ch);
    return db.get('SELECT * FROM channels WHERE channel_id=?', c.channel_id);
  }

  function feed(user, { channel, before, limit = 24, q } = {}) {
    const args = [user.id];
    let where = '1=1';
    if (channel) { where += ' AND v.channel_id=?'; args.push(channel); }
    if (before) { where += ' AND v.published<?'; args.push(+before); }
    if (q) { where += ' AND lower(v.title) LIKE ?'; args.push(`%${String(q).toLowerCase()}%`); }
    args.push(Math.min(60, +limit || 24));
    const items = db.all(`SELECT v.*, c.title channel_title, w.at watched_at FROM videos v JOIN channels c ON c.channel_id=v.channel_id
      LEFT JOIN watched w ON w.video_id=v.id AND w.user_id=? WHERE ${where} ORDER BY v.published DESC LIMIT ?`, ...args);
    const channels = db.all('SELECT c.*, (SELECT COUNT(*) FROM videos v WHERE v.channel_id=c.channel_id) videos FROM channels c ORDER BY title');
    return { items, channels };
  }
  const watched = (user, id) => db.run('INSERT OR IGNORE INTO watched (user_id,video_id,at) VALUES (?,?,?)', user.id, id, Date.now());

  return { resolve, crawl, addChannel, feed, watched };
}

module.exports = { create };

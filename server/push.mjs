// Phone notifications (Web Push): one message when a character left training reaches the reset level while its
// player is away. The signing key is derived from the server's own secret, so there is nothing more to configure.
// A subscription may only point at the browser makers' push services; nothing else is ever contacted.
import { createECDH, createHmac } from 'node:crypto';
import webpush from 'web-push';

const HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|mozilla\.com|notify\.windows\.com)\/[^\s]{1,700}$/;
const B64 = /^[A-Za-z0-9_-]{10,200}$/;
const plain = (o) => JSON.parse(JSON.stringify(o));

export function makePush(admin, secret, G, rnd, { clock = Date.now, sender } = {}) {
  const priv = createHmac('sha256', String(secret)).update('vapid-key-v1').digest(), ec = createECDH('prime256v1'); ec.setPrivateKey(priv);
  const key = ec.getPublicKey().toString('base64url');
  const vapid = { subject: 'https://eternal-cycle.onrender.com', publicKey: key, privateKey: priv.toString('base64url') };
  const sendOne = sender || ((sub, body) => webpush.sendNotification(sub, body, { vapidDetails: vapid, TTL: 6 * 3600 }));
  const row = async (uid) => (await admin.from('push_subs').select('user_id,endpoint,p256dh,auth,lang,name,notify_at').eq('user_id', uid).maybeSingle()).data;

  async function on(uid, sub, lang) {
    const ep = String(sub && sub.endpoint || ''), k = sub && sub.keys || {};
    if (!HOSTS.test(ep) || !B64.test(String(k.p256dh || '')) || !B64.test(String(k.auth || ''))) return { ok: false, msg: 'bad_sub' };
    const r = await admin.from('push_subs').upsert({ user_id: uid, endpoint: ep, p256dh: String(k.p256dh), auth: String(k.auth), lang: lang === 'en' ? 'en' : 'he', notify_at: null });
    return r.error ? { ok: false, msg: 'server' } : { ok: true };
  }
  async function off(uid) { await admin.from('push_subs').update({ endpoint: '', p256dh: '', auth: '', notify_at: null }).eq('user_id', uid); return { ok: true }; }
  async function status(uid) { const r = await row(uid); return { ok: true, on: !!(r && r.endpoint), key }; }
  // The player left: work out when the character will stand at the reset level, if it will within the away limit.
  async function away(uid) {
    const r = await row(uid); if (!r || !r.endpoint) return null;
    const acc = (await admin.from('accounts').select('state').eq('user_id', uid).maybeSingle()).data; if (!acc) return null;
    const A = G.adopt(plain(acc.state)); if (!A) return null; G.setEnv(rnd, () => clock());
    const S = A.chars[A.cur], eta = G.afkEta(A), at = eta != null && eta >= 60 ? new Date(clock() + eta * 1000).toISOString() : null;
    await admin.from('push_subs').update({ notify_at: at, name: S ? String(S.name).slice(0, 14) : '' }).eq('user_id', uid); return at;
  }
  async function back(uid) { await admin.from('push_subs').update({ notify_at: null }).eq('user_id', uid); }
  async function tick() {
    const now = clock(), rows = (await admin.from('push_subs').select('user_id,endpoint,p256dh,auth,lang,name,notify_at').order('notify_at', { ascending: true }).limit(200)).data || []; let sent = 0;
    for (const r of rows) {
      if (!r.notify_at || !r.endpoint || new Date(r.notify_at).getTime() > now) continue;
      await admin.from('push_subs').update({ notify_at: null }).eq('user_id', r.user_id);
      const en = r.lang === 'en', body = JSON.stringify({ title: en ? 'Eternal Cycle' : 'מעגל הנצח', body: en ? r.name + ' reached level ' + G.CAP + ' and is ready to reset' : r.name + ' הגיע לרמה ' + G.CAP + ' ומוכן לריסט', url: './' });
      try { await sendOne({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body); sent++; }
      catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await off(r.user_id); else console.error('push failed', e && e.statusCode); }
    }
    return sent;
  }
  return { key, on, off, status, away, back, tick };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Metal Maniacs — Competition Host Server
   Express + SQLite + JWT + Nodemailer (magic link auth)
══════════════════════════════════════════════════════════════════════════════ */
require('dotenv').config();

const express    = require('express');
const path       = require('path');
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db         = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod-' + crypto.randomBytes(16).toString('hex');
const BASE_URL   = process.env.BASE_URL   || `http://localhost:${PORT}`;

/** Derive the public base URL from the incoming request, overriding BASE_URL.
 *  This ensures email links work regardless of how the server is exposed
 *  (localhost, a tunnel, a deployed domain, a Codespace forwarded port, etc.) */
function getBaseUrl(req) {
  // If BASE_URL is still the default placeholder, use the request host instead
  const configured = process.env.BASE_URL;
  if (configured && configured !== `http://localhost:${PORT}` && configured !== `http://localhost:3000`) {
    return configured.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host  = req.headers['x-forwarded-host']  || req.get('host');
  return `${proto}://${host}`;
}

app.use(express.json({ limit: '25mb' })); // large limit for base64 map images

// ─── Email ────────────────────────────────────────────────────────────────────
const mailer = process.env.GMAIL_USER
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
  : null;

async function sendMail(to, subject, html) {
  if (!mailer) {
    console.log(`\n📧 [EMAIL — no GMAIL_USER configured]\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g,'')}\n`);
    return;
  }
  await mailer.sendMail({ from: `"Competition Host" <${process.env.GMAIL_USER}>`, to, subject, html });
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(header.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

function softAuth(req, _res, next) {
  const header = req.headers['authorization'];
  if (header?.startsWith('Bearer ')) try { req.user = jwt.verify(header.slice(7), JWT_SECRET); } catch {}
  next();
}

function uid() { return crypto.randomUUID(); }

// ─── API: Auth ────────────────────────────────────────────────────────────────

// POST /api/auth/magic-link  { email, name? }
app.post('/api/auth/magic-link', (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const normalEmail = email.toLowerCase().trim();

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalEmail);
  if (!user) {
    if (!name?.trim()) return res.status(400).json({ error: 'Enter your name to create an account.', needsName: true });
    const id = uid();
    db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)').run(id, name.trim(), normalEmail);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (name?.trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), user.id);
  }

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  db.prepare('UPDATE users SET magic_token = ?, magic_token_expires = ? WHERE id = ?').run(token, expires, user.id);

  const link = `${getBaseUrl(req)}/tools/competition/verify?token=${token}`;
  sendMail(normalEmail, 'Sign in to Competition Host', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#111;color:#eee;border-radius:8px;">
      <h2 style="color:#ff0000;margin-top:0;">Metal Maniacs Competition Host</h2>
      <p>Hey ${user.name}, click the button below to sign in. This link expires in <strong>15 minutes</strong>.</p>
      <a href="${link}" style="display:inline-block;background:#ff0000;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:1rem 0;">Sign In →</a>
      <p style="color:#888;font-size:.78rem;margin-top:1.5rem;">If you didn't request this, ignore it.<br>Link: <a href="${link}" style="color:#ff6060;">${link}</a></p>
    </div>`).catch(e => console.error('Email error:', e));
  res.json({ ok: true });
});

// GET /api/auth/verify?token=...
app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token missing.' });
  const user = db.prepare('SELECT * FROM users WHERE magic_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'This link is invalid or has already been used.' });
  if (user.magic_token_expires < Math.floor(Date.now() / 1000))
    return res.status(400).json({ error: 'This link has expired. Please request a new one.' });
  db.prepare('UPDATE users SET magic_token = NULL, magic_token_expires = NULL WHERE id = ?').run(user.id);
  const jwtToken = jwt.sign({ sub: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email } });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

// ─── API: Events ──────────────────────────────────────────────────────────────
const EVENT_LIST_COLS = 'id, name, hosting_team, description, event_date, location, owner_id, invite_code, team_count, match_count, created_at';

// GET /api/events
app.get('/api/events', authMiddleware, (req, res) => {
  const userId  = req.user.sub;
  const owned   = db.prepare(`SELECT ${EVENT_LIST_COLS}, 'owner' AS my_role FROM events WHERE owner_id = ? ORDER BY created_at DESC`).all(userId);
  const membered = db.prepare(`SELECT e.${EVENT_LIST_COLS}, em.role AS my_role FROM events e JOIN event_members em ON em.event_id = e.id WHERE em.user_id = ? AND em.status = 'accepted' ORDER BY e.created_at DESC`).all(userId);
  const seen = new Set(owned.map(e => e.id));
  res.json([...owned, ...membered.filter(e => !seen.has(e.id))]);
});

// POST /api/events
app.post('/api/events', authMiddleware, (req, res) => {
  const { name, hosting_team, description, event_date, location } = req.body;
  if (!name?.trim() || !hosting_team?.trim()) return res.status(400).json({ error: 'Event name and hosting team are required.' });
  const id = uid(), invite_code = crypto.randomBytes(6).toString('hex');
  db.prepare('INSERT INTO events (id, name, hosting_team, description, event_date, location, owner_id, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name.trim(), hosting_team.trim(), (description||'').trim(), (event_date||'').trim(), (location||'').trim(), req.user.sub, invite_code);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.status(201).json({ ...event, my_role: 'owner', is_owner: true });
});

// GET /api/events/:id
app.get('/api/events/:id', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const userId = req.user.sub, isOwner = event.owner_id === userId;
  const membership = db.prepare(`SELECT * FROM event_members WHERE event_id = ? AND user_id = ? AND status = 'accepted'`).get(req.params.id, userId);
  if (!isOwner && !membership) return res.status(403).json({ error: 'You are not a member of this event.' });
  const members = db.prepare(`SELECT em.id, em.invited_email, em.role, em.status, em.invited_at, em.accepted_at, u.id AS user_id, u.name, u.email FROM event_members em LEFT JOIN users u ON u.id = em.user_id WHERE em.event_id = ? ORDER BY em.invited_at ASC`).all(req.params.id);
  const owner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(event.owner_id);
  res.json({ ...event, my_role: isOwner ? 'owner' : membership.role, is_owner: isOwner, members, owner });
});

// PATCH /api/events/:id
app.patch('/api/events/:id', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const userId = req.user.sub, isOwner = event.owner_id === userId;
  const member = db.prepare(`SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ? AND status = 'accepted'`).get(req.params.id, userId);
  if (!isOwner && !member) return res.status(403).json({ error: 'Access denied.' });
  const ownerOnly = new Set(['name','hosting_team','description','event_date','location']);
  const allowed   = new Set([...ownerOnly,'team_count','match_count','schedule_data','queue_data','volunteers_data','map_image','map_pins','leaderboard_data','packing_data','banners_data']);
  const updates = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (!allowed.has(k) || (ownerOnly.has(k) && !isOwner)) continue;
    updates[k] = typeof v === 'object' ? JSON.stringify(v) : v;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields.' });
  db.prepare(`UPDATE events SET ${Object.keys(updates).map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json({ ok: true });
});

// DELETE /api/events/:id
app.delete('/api/events/:id', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  if (event.owner_id !== req.user.sub) return res.status(403).json({ error: 'Only the owner can delete this event.' });
  db.prepare('DELETE FROM event_members WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API: Invitations ─────────────────────────────────────────────────────────

// POST /api/events/:id/invite  { email }
app.post('/api/events/:id/invite', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  if (event.owner_id !== req.user.sub) return res.status(403).json({ error: 'Only the owner can invite members.' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const normalEmail = email.toLowerCase().trim();
  if (normalEmail === req.user.email.toLowerCase()) return res.status(400).json({ error: 'You cannot invite yourself.' });
  const existing = db.prepare('SELECT * FROM event_members WHERE event_id = ? AND invited_email = ?').get(req.params.id, normalEmail);
  if (existing?.status === 'accepted') return res.status(400).json({ error: 'This person is already a member.' });
  if (!existing) {
    const invitedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(normalEmail);
    db.prepare(`INSERT INTO event_members (id, event_id, invited_email, user_id, status) VALUES (?, ?, ?, ?, 'pending')`).run(uid(), req.params.id, normalEmail, invitedUser?.id ?? null);
  } else {
    db.prepare(`UPDATE event_members SET status = 'pending' WHERE event_id = ? AND invited_email = ?`).run(req.params.id, normalEmail);
  }
  const joinLink = `${getBaseUrl(req)}/tools/competition/join?code=${event.invite_code}`;
  sendMail(normalEmail, `You're invited to help host: ${event.name}`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#111;color:#eee;border-radius:8px;">
      <h2 style="color:#ff0000;margin-top:0;">You're Invited!</h2>
      <p><strong>${req.user.name}</strong> from <strong>${event.hosting_team}</strong> has invited you to help host:</p>
      <h3 style="color:#fff;margin:.5rem 0;">${event.name}</h3>
      ${event.event_date ? `<p>📅 ${event.event_date}</p>` : ''}${event.location ? `<p>📍 ${event.location}</p>` : ''}
      <a href="${joinLink}" style="display:inline-block;background:#ff0000;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:1rem 0;">Accept Invitation →</a>
      <p style="color:#888;font-size:.78rem;">Or go to <a href="${getBaseUrl(req)}/tools/competition/join" style="color:#ff6060;">${getBaseUrl(req)}/tools/competition/join</a> and enter code: <strong style="color:#fff;">${event.invite_code}</strong></p>
    </div>`).catch(e => console.error('Email error:', e));
  res.json({ ok: true });
});

// GET /api/invite/:code — public event lookup by invite code
app.get('/api/invite/:code', softAuth, (req, res) => {
  const event = db.prepare('SELECT id, name, hosting_team, description, event_date, location, invite_code FROM events WHERE invite_code = ?').get(req.params.code);
  if (!event) return res.status(404).json({ error: 'Invalid or expired invite code.' });
  let already_member = false;
  if (req.user) {
    const isOwner = db.prepare('SELECT 1 FROM events WHERE id = ? AND owner_id = ?').get(event.id, req.user.sub);
    const member  = db.prepare(`SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ? AND status = 'accepted'`).get(event.id, req.user.sub);
    already_member = !!(isOwner || member);
  }
  res.json({ ...event, already_member });
});

// POST /api/invite/:code — accept invitation
app.post('/api/invite/:code', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE invite_code = ?').get(req.params.code);
  if (!event) return res.status(404).json({ error: 'Invalid invite code.' });
  const userId = req.user.sub, userEmail = req.user.email.toLowerCase();
  if (event.owner_id === userId) return res.json({ ok: true, event_id: event.id, status: 'owner' });
  let invite = db.prepare('SELECT * FROM event_members WHERE event_id = ? AND (user_id = ? OR invited_email = ?)').get(event.id, userId, userEmail);
  if (invite?.status === 'accepted') return res.json({ ok: true, event_id: event.id, status: 'already_member' });
  if (invite) {
    db.prepare(`UPDATE event_members SET status = 'accepted', user_id = ?, accepted_at = unixepoch() WHERE id = ?`).run(userId, invite.id);
  } else {
    db.prepare(`INSERT INTO event_members (id, event_id, invited_email, user_id, status, accepted_at) VALUES (?, ?, ?, ?, 'accepted', unixepoch())`).run(uid(), event.id, userEmail, userId);
  }
  res.json({ ok: true, event_id: event.id, status: 'accepted' });
});

// GET /api/events/:id/public — no auth required; returns only public-safe fields
app.get('/api/events/:id/public', (req, res) => {
  const event = db.prepare('SELECT id, name, hosting_team, description, event_date, location, team_count, match_count, queue_data, map_image, map_pins, leaderboard_data FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json(event);
});

// GET /api/events/:id/members
app.get('/api/events/:id/members', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const userId = req.user.sub, isOwner = event.owner_id === userId;
  const member = db.prepare(`SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ? AND status = 'accepted'`).get(req.params.id, userId);
  if (!isOwner && !member) return res.status(403).json({ error: 'Access denied.' });
  res.json(db.prepare(`SELECT em.id, em.invited_email, em.role, em.status, em.invited_at, em.accepted_at, u.id AS user_id, u.name, u.email FROM event_members em LEFT JOIN users u ON u.id = em.user_id WHERE em.event_id = ? ORDER BY em.invited_at ASC`).all(req.params.id));
});

// DELETE /api/events/:id/members/me — authenticated member leaves themselves
app.delete('/api/events/:id/members/me', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  if (event.owner_id === req.user.sub) return res.status(400).json({ error: 'The owner cannot leave their own event. Close/delete it instead.' });
  db.prepare(`DELETE FROM event_members WHERE event_id = ? AND user_id = ?`).run(req.params.id, req.user.sub);
  res.json({ ok: true });
});

// DELETE /api/events/:id/members/:memberId
app.delete('/api/events/:id/members/:memberId', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event || event.owner_id !== req.user.sub) return res.status(403).json({ error: 'Owner only.' });
  db.prepare('DELETE FROM event_members WHERE id = ? AND event_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true });
});

// ─── Page Routes ──────────────────────────────────────────────────────────────
const pageRoutes = {
  '/':                             'index.html',
  '/about':                        'about.html',
  '/team':                         'team.html',
  '/robot':                        'robot.html',
  '/sponsors':                     'sponsors.html',
  '/outreach':                     'outreach.html',
  '/get-involved':                 'get-involved.html',
  '/tools':                        'tools.html',
  '/tools/signin':                 'tools-signin.html',
  '/tools/signup':                 'tools-signup.html',
  '/tools/competition':            'tools/competition/index.html',
  '/tools/competition/login':      'tools/competition/login.html',
  '/tools/competition/verify':     'tools/competition/verify.html',
  '/tools/competition/dashboard':  'tools/competition/dashboard.html',
  '/tools/competition/new':        'tools/competition/new-event.html',
  '/tools/competition/join':       'tools/competition/join.html',
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, file)));
  if (route !== '/') app.get(route + '/', (_req, res) => res.redirect(301, route));
});

app.get('/tools/competition/event/:id([^/.]+)/view', (_req, res) => {
  res.sendFile(path.join(__dirname, 'tools/competition/event/guest.html'));
});
app.get('/tools/competition/event/:id([^/.]+)/view/', (req, res) => {
  res.redirect(301, `/tools/competition/event/${req.params.id}/view`);
});
app.get('/tools/competition/event/:id([^/.]+)', (_req, res) => {
  res.sendFile(path.join(__dirname, 'tools/competition/event/index.html'));
});
app.get('/tools/competition/event/:id([^/.]+)/', (req, res) => {
  res.redirect(301, `/tools/competition/event/${req.params.id}`);
});

// ─── Static Assets ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), { index: false, redirect: false }));

// 404
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Metal Maniacs server running at http://localhost:${PORT}`));

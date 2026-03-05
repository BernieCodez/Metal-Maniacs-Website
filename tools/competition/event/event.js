/* event.js — API-backed competition tool for a single event */
'use strict';

// ── Event ID from URL path: /tools/competition/event/:id ──
const EVENT_ID = window.location.pathname.split('/')[4];

// ── In-memory event state ──
let eventData = {};
let currentUser = null;

// ── Defaults applied on first load if backend data is empty ──
const DEFAULT_SCHEDULE = [
  { id: uid(), time: '07:00', name: 'Volunteer Setup / Load-In', notes: '' },
  { id: uid(), time: '08:00', name: 'Team Check-in + Pit Setup', notes: '' },
  { id: uid(), time: '09:00', name: 'Opening Ceremony', notes: '' },
  { id: uid(), time: '09:30', name: 'Practice Rounds Begin', notes: '' },
  { id: uid(), time: '11:30', name: 'Qualifying Matches Begin', notes: '' },
  { id: uid(), time: '12:00', name: 'Lunch Break (staggered)', notes: '' },
  { id: uid(), time: '15:00', name: 'Alliance Selection', notes: '' },
  { id: uid(), time: '15:30', name: 'Playoff Matches', notes: '' },
  { id: uid(), time: '17:00', name: 'Awards Ceremony', notes: '' },
  { id: uid(), time: '17:30', name: 'Tear-Down Begins', notes: '' },
];
const DEFAULT_VOLUNTEERS = [
  { id: uid(), name: 'Head Referee',     role: 'Referee',          status: 'not_arrived' },
  { id: uid(), name: 'Field Supervisor', role: 'Field Control',    status: 'not_arrived' },
  { id: uid(), name: 'Queueing Lead',    role: 'Queue Manager',    status: 'not_arrived' },
  { id: uid(), name: 'Score Keeper',     role: 'Scoring Table',    status: 'not_arrived' },
  { id: uid(), name: 'Emcee',            role: 'Announcer',        status: 'not_arrived' },
  { id: uid(), name: 'Pit Admin',        role: 'Pit Administration', status: 'not_arrived' },
];
const DEFAULT_PACKING = [
  { id: uid(), cat: 'Field Elements',  item: 'Game pieces (full set)', packed: false },
  { id: uid(), cat: 'Field Elements',  item: 'Field perimeter / tiles', packed: false },
  { id: uid(), cat: 'Electronics',     item: 'Scoring laptop',         packed: false },
  { id: uid(), cat: 'Electronics',     item: 'Projector + HDMI cable', packed: false },
  { id: uid(), cat: 'Electronics',     item: 'Extension cords (×3)',   packed: false },
  { id: uid(), cat: 'Supplies',        item: 'Tape + markers',         packed: false },
  { id: uid(), cat: 'Supplies',        item: 'First aid kit',          packed: false },
  { id: uid(), cat: 'Referee',         item: 'Referee flags',          packed: false },
  { id: uid(), cat: 'Referee',         item: 'Referee uniforms',       packed: false },
  { id: uid(), cat: 'Networking',      item: 'Router + Ethernet cables', packed: false },
];

// ── Utility ──
function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Save-status indicator ──
let saveTimer = null;
function setSaveStatus(state) {
  const el = document.getElementById('save-status');
  if (!el) return;
  clearTimeout(saveTimer);
  if (state === 'saving') {
    el.textContent = '⏳ Saving…';
    el.className = 'save-status saving';
  } else if (state === 'saved') {
    el.textContent = '✓ Saved';
    el.className = 'save-status saved';
    saveTimer = setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 3000);
  } else if (state === 'error') {
    el.textContent = '⚠ Save failed';
    el.className = 'save-status error';
  }
}

// ── Core patch function ──
async function patchEvent(updates) {
  setSaveStatus('saving');
  const res = await apiFetch('/api/events/' + EVENT_ID, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  setSaveStatus(res && res.ok ? 'saved' : 'error');
  return res && res.ok;
}

// ── Load event from API ──
async function loadEventFromAPI() {
  const res = await apiFetch('/api/events/' + EVENT_ID);
  if (!res || !res.ok) {
    showError('Could not load event. You may not have access.');
    return false;
  }
  const d = await res.json();
  eventData = {
    id:            d.id,
    name:          d.name,
    hosting_team:  d.hosting_team,
    description:   d.description || '',
    event_date:    d.event_date   || '',
    location:      d.location     || '',
    owner_id:      d.owner_id,
    invite_code:   d.invite_code,
    team_count:    d.team_count   || 0,
    match_count:   d.match_count  || 0,
    is_owner:      d.is_owner,
    owner_name:    d.owner?.name || '',
    members:       d.members      || [],
    schedule:   safeJSON(d.schedule_data,   []),
    queue:      safeJSON(d.queue_data,      []),
    volunteers: safeJSON(d.volunteers_data, []),
    map_image:  d.map_image   || null,
    map_pins:   safeJSON(d.map_pins,        []),
    leaderboard:safeJSON(d.leaderboard_data,[]),
    packing:    safeJSON(d.packing_data,    []),
    banners:    safeJSON(d.banners_data,    []),
  };
  // Prepend owner into members list so they appear in the roster
  if (d.owner && !eventData.members.some(m => m.user_id === d.owner.id)) {
    eventData.members.unshift({ id: null, name: d.owner.name, email: d.owner.email, role: 'owner', status: 'accepted', user_id: d.owner.id });
  }

  // Apply defaults on first use
  const patches = {};
  if (!eventData.schedule.length)   { eventData.schedule   = DEFAULT_SCHEDULE;   patches.schedule_data   = eventData.schedule; }
  if (!eventData.volunteers.length) { eventData.volunteers = DEFAULT_VOLUNTEERS; patches.volunteers_data = eventData.volunteers; }
  if (!eventData.packing.length)    { eventData.packing    = DEFAULT_PACKING;    patches.packing_data    = eventData.packing; }
  if (Object.keys(patches).length) {
    // Stringify arrays for server
    const p2 = {};
    for (const [k, v] of Object.entries(patches)) p2[k] = JSON.stringify(v);
    await patchEvent(p2);
  }
  return true;
}

function safeJSON(str, def) {
  if (!str) return def;
  try { return JSON.parse(str); } catch { return def; }
}

function showError(msg) {
  document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;gap:1rem;font-family:'Orbitron',sans-serif;">
    <i class="fas fa-triangle-exclamation" style="font-size:3rem;color:#e74c3c;"></i>
    <h2 style="color:#e74c3c;">${escHtml(msg)}</h2>
    <a href="/tools/competition/dashboard" class="cbtn cbtn-ghost"><i class="fas fa-arrow-left"></i> Dashboard</a>
  </div>`;
}

// ── Initialise page ──
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth();
  if (!currentUser) return;

  document.getElementById('auth-pill-label').textContent = currentUser.name || currentUser.email;

  const ok = await loadEventFromAPI();
  if (!ok) return;

  // Header
  document.title = escHtml(eventData.name) + ' — Competition Host';
  document.getElementById('header-event-name').innerHTML =
    `<i class="fas fa-trophy"></i> ${escHtml(eventData.name)}`;
  document.getElementById('hosting-team-label').textContent = 'Hosted by ' + eventData.hosting_team;
  document.getElementById('teams-display').textContent  = eventData.team_count || 0;
  document.getElementById('matches-display').textContent = eventData.match_count || 0;

  // Status bar team/match inputs
  if (document.getElementById('teams-input'))   document.getElementById('teams-input').value   = eventData.team_count || '';
  if (document.getElementById('matches-input')) document.getElementById('matches-input').value = eventData.match_count || '';

  // Show/hide member-only toolbars
  const canEdit = true; // all members can edit (server enforces access)
  ['schedule','queue','volunteers','map','lb'].forEach(t => {
    const el = document.getElementById(t + '-member-tools');
    if (el) el.style.display = canEdit ? 'flex' : 'none';
  });
  const guestIds = ['guest-schedule-notice','guest-queue-notice','guest-map-notice'];
  guestIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // Volunteers / packing full access
  document.getElementById('vol-member-view').style.display   = 'block';
  document.getElementById('vol-guest-view').style.display    = 'none';
  document.getElementById('packing-member-view').style.display = 'block';
  document.getElementById('packing-guest-view').style.display  = 'none';

  // Owner-only
  if (eventData.is_owner) {
    document.getElementById('invite-section').style.display    = 'flex';
    document.getElementById('edit-event-section').style.display = 'block';
    document.getElementById('close-event-section').style.display = 'block';
    fillEditEventForm();
  } else {
    // Non-owner members get a Leave button
    const leaveBtn = document.getElementById('leave-btn');
    if (leaveBtn) leaveBtn.style.display = 'inline-flex';
  }

  renderMembersTab();
  renderAll();
  startClock();
  renderBannerStrip();
});

function renderAll() {
  renderSchedule();
  renderQueue();
  renderVolunteers();
  renderMap();
  renderLeaderboard();
  renderPacking();
}

// ══════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════
function startClock() {
  function tick() {
    const now = new Date();
    let h = now.getHours(), m = now.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const padM = String(m).padStart(2, '0');
    document.getElementById('clock-display').textContent = `${h}:${padM} ${ap}`;
    if (document.getElementById('fs-clock')) document.getElementById('fs-clock').textContent = `${h}:${padM} ${ap}`;
  }
  tick();
  setInterval(tick, 10000);
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.comp-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
}

// ══════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden')); cancelPin(); } });

// ══════════════════════════════════════════
// SCHEDULE
// ══════════════════════════════════════════
function renderSchedule() {
  const list = eventData.schedule;
  const el = document.getElementById('schedule-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state-small">No schedule events yet.</div>'; return; }
  const sorted = [...list].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  el.innerHTML = sorted.map(ev => `
    <div class="sched-item" id="sched-${ev.id}">
      <div class="sched-time">${escHtml(ev.time || '--:--')}</div>
      <div class="sched-content">
        <div class="sched-name">${escHtml(ev.name)}</div>
        ${ev.notes ? `<div class="sched-notes">${escHtml(ev.notes)}</div>` : ''}
      </div>
      <div class="sched-actions">
        <button class="icon-btn" title="Edit"   onclick="editScheduleEvent('${ev.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn danger" title="Delete" onclick="deleteScheduleEvent('${ev.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function openAddScheduleModal() {
  document.getElementById('sched-edit-id').value = '';
  document.getElementById('sched-modal-title').textContent = 'ADD EVENT';
  document.getElementById('sched-time').value = '';
  document.getElementById('sched-name').value = '';
  document.getElementById('sched-notes').value = '';
  openModal('sched-modal');
  setTimeout(() => document.getElementById('sched-time').focus(), 50);
}

function editScheduleEvent(id) {
  const ev = eventData.schedule.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('sched-edit-id').value = id;
  document.getElementById('sched-modal-title').textContent = 'EDIT EVENT';
  document.getElementById('sched-time').value  = ev.time  || '';
  document.getElementById('sched-name').value  = ev.name  || '';
  document.getElementById('sched-notes').value = ev.notes || '';
  openModal('sched-modal');
}

async function saveScheduleEvent() {
  const editId = document.getElementById('sched-edit-id').value;
  const time   = document.getElementById('sched-time').value.trim();
  const name   = document.getElementById('sched-name').value.trim();
  const notes  = document.getElementById('sched-notes').value.trim();
  if (!name) { alert('Event name is required.'); return; }
  if (editId) {
    const ev = eventData.schedule.find(e => e.id === editId);
    if (ev) { ev.time = time; ev.name = name; ev.notes = notes; }
  } else {
    eventData.schedule.push({ id: uid(), time, name, notes });
  }
  closeModal('sched-modal');
  renderSchedule();
  await patchEvent({ schedule_data: JSON.stringify(eventData.schedule) });
}

async function deleteScheduleEvent(id) {
  if (!confirm('Delete this schedule event?')) return;
  eventData.schedule = eventData.schedule.filter(e => e.id !== id);
  renderSchedule();
  await patchEvent({ schedule_data: JSON.stringify(eventData.schedule) });
}

async function saveTeamCount(val) {
  const n = parseInt(val, 10) || 0;
  eventData.team_count = n;
  document.getElementById('teams-display').textContent = n;
  await patchEvent({ team_count: n });
}
async function saveMatchCount(val) {
  const n = parseInt(val, 10) || 0;
  eventData.match_count = n;
  document.getElementById('matches-display').textContent = n;
  await patchEvent({ match_count: n });
}

// ══════════════════════════════════════════
// QUEUE
// ══════════════════════════════════════════
const Q_STATUS = {
  needs_queue: { label: 'Needs Queue', cls: 'q-status-needs' },
  in_queue:    { label: 'In Queue',    cls: 'q-status-in' },
  checked_in:  { label: 'Checked In', cls: 'q-status-checked' },
};

function renderQueue() {
  const list = eventData.queue;
  const el = document.getElementById('queue-list');
  document.getElementById('q-needs-count').textContent    = list.filter(t => t.status === 'needs_queue').length;
  document.getElementById('q-inqueue-count').textContent  = list.filter(t => t.status === 'in_queue').length;
  document.getElementById('q-checkedin-count').textContent = list.filter(t => t.status === 'checked_in').length;
  if (!list.length) { el.innerHTML = '<div class="empty-state-small">No teams in queue yet.</div>'; return; }
  const sorted = [...list].sort((a, b) => {
    const order = { checked_in: 0, in_queue: 1, needs_queue: 2 };
    const od = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    if (od !== 0) return od;
    return (a.queue_num || 999) - (b.queue_num || 999);
  });
  el.innerHTML = sorted.map(t => {
    const s = Q_STATUS[t.status] || { label: t.status, cls: '' };
    return `<div class="queue-card ${s.cls}">
      <div class="queue-card-top">
        <div class="queue-team-num">${escHtml(t.number || '—')}</div>
        <div class="queue-team-name">${escHtml(t.name || '')}</div>
        <div class="queue-badge ${s.cls}">${s.label}</div>
      </div>
      <div class="queue-card-meta">
        ${t.field ? `<span><i class="fas fa-border-all"></i> Field ${escHtml(String(t.field))}</span>` : ''}
        ${t.queue_num ? `<span><i class="fas fa-hashtag"></i> Queue ${escHtml(String(t.queue_num))}</span>` : ''}
        ${t.time ? `<span><i class="fas fa-clock"></i> ${escHtml(t.time)}</span>` : ''}
      </div>
      <div class="queue-card-actions">
        <select class="cinput cinput-sm" onchange="changeQueueStatus('${t.id}', this.value)">
          ${Object.entries(Q_STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <button class="icon-btn" onclick="editQueueTeam('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn danger" onclick="deleteQueueTeam('${t.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openAddQueueModal() {
  document.getElementById('queue-edit-id').value = '';
  document.getElementById('queue-modal-title').textContent = 'ADD TEAM TO QUEUE';
  ['q-number','q-name','q-field','q-queue-num','q-time'].forEach(id => document.getElementById(id).value = '');
  openModal('queue-modal');
  setTimeout(() => document.getElementById('q-number').focus(), 50);
}

function editQueueTeam(id) {
  const t = eventData.queue.find(t => t.id === id);
  if (!t) return;
  document.getElementById('queue-edit-id').value = id;
  document.getElementById('queue-modal-title').textContent = 'EDIT TEAM';
  document.getElementById('q-number').value    = t.number    || '';
  document.getElementById('q-name').value      = t.name      || '';
  document.getElementById('q-field').value     = t.field     || '';
  document.getElementById('q-queue-num').value = t.queue_num || '';
  document.getElementById('q-time').value      = t.time      || '';
  openModal('queue-modal');
}

async function saveQueueTeam() {
  const editId = document.getElementById('queue-edit-id').value;
  const data = {
    number:    document.getElementById('q-number').value.trim(),
    name:      document.getElementById('q-name').value.trim(),
    field:     parseInt(document.getElementById('q-field').value) || null,
    queue_num: parseInt(document.getElementById('q-queue-num').value) || null,
    time:      document.getElementById('q-time').value.trim(),
    status:    'needs_queue',
  };
  if (!data.number && !data.name) { alert('Team number or name is required.'); return; }
  if (editId) {
    const t = eventData.queue.find(t => t.id === editId);
    if (t) Object.assign(t, data);
  } else {
    eventData.queue.push({ id: uid(), ...data });
  }
  closeModal('queue-modal');
  renderQueue();
  await patchEvent({ queue_data: JSON.stringify(eventData.queue) });
}

async function changeQueueStatus(id, status) {
  const t = eventData.queue.find(t => t.id === id);
  if (t) t.status = status;
  renderQueue();
  await patchEvent({ queue_data: JSON.stringify(eventData.queue) });
}

async function deleteQueueTeam(id) {
  if (!confirm('Remove this team from the queue?')) return;
  eventData.queue = eventData.queue.filter(t => t.id !== id);
  renderQueue();
  await patchEvent({ queue_data: JSON.stringify(eventData.queue) });
}

// ══════════════════════════════════════════
// VOLUNTEERS
// ══════════════════════════════════════════
const VOL_STATUS = {
  present:     { label: 'Present',     cls: 'vol-status-present'  },
  not_arrived: { label: 'Not Arrived', cls: 'vol-status-absent'   },
  left:        { label: 'Left',        cls: 'vol-status-left'     },
};

function renderVolunteers() {
  const list = eventData.volunteers;
  const el = document.getElementById('vol-list');
  document.getElementById('vol-total').textContent   = list.length;
  document.getElementById('vol-present').textContent = list.filter(v => v.status === 'present').length;
  document.getElementById('vol-left').textContent    = list.filter(v => v.status === 'left').length;
  document.getElementById('vol-absent').textContent  = list.filter(v => v.status === 'not_arrived').length;
  if (!list.length) { el.innerHTML = '<div class="empty-state-small">No volunteers added yet.</div>'; return; }
  el.innerHTML = list.map(v => {
    const s = VOL_STATUS[v.status] || { label: v.status, cls: '' };
    return `<div class="vol-row">
      <div class="vol-info">
        <div class="vol-name">${escHtml(v.name)}</div>
        <div class="vol-role">${escHtml(v.role || '')}</div>
      </div>
      <div class="vol-actions">
        <select class="cinput cinput-sm ${s.cls}" onchange="changeVolStatus('${v.id}', this.value)">
          ${Object.entries(VOL_STATUS).map(([k, sv]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${sv.label}</option>`).join('')}
        </select>
        <button class="icon-btn" onclick="editVolunteer('${v.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn danger" onclick="deleteVolunteer('${v.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openAddVolModal() {
  document.getElementById('vol-edit-id').value = '';
  document.getElementById('vol-name-input').value = '';
  document.getElementById('vol-role-input').value = '';
  openModal('vol-modal');
  setTimeout(() => document.getElementById('vol-name-input').focus(), 50);
}

function editVolunteer(id) {
  const v = eventData.volunteers.find(v => v.id === id);
  if (!v) return;
  document.getElementById('vol-edit-id').value = id;
  document.getElementById('vol-name-input').value = v.name || '';
  document.getElementById('vol-role-input').value = v.role || '';
  openModal('vol-modal');
}

async function saveVolunteer() {
  const editId = document.getElementById('vol-edit-id').value;
  const name   = document.getElementById('vol-name-input').value.trim();
  const role   = document.getElementById('vol-role-input').value.trim();
  if (!name) { alert('Volunteer name is required.'); return; }
  if (editId) {
    const v = eventData.volunteers.find(v => v.id === editId);
    if (v) { v.name = name; v.role = role; }
  } else {
    eventData.volunteers.push({ id: uid(), name, role, status: 'not_arrived' });
  }
  closeModal('vol-modal');
  renderVolunteers();
  await patchEvent({ volunteers_data: JSON.stringify(eventData.volunteers) });
}

async function changeVolStatus(id, status) {
  const v = eventData.volunteers.find(v => v.id === id);
  if (v) v.status = status;
  renderVolunteers();
  await patchEvent({ volunteers_data: JSON.stringify(eventData.volunteers) });
}

async function deleteVolunteer(id) {
  if (!confirm('Remove this volunteer?')) return;
  eventData.volunteers = eventData.volunteers.filter(v => v.id !== id);
  renderVolunteers();
  await patchEvent({ volunteers_data: JSON.stringify(eventData.volunteers) });
}

// ══════════════════════════════════════════
// MAP
// ══════════════════════════════════════════
let pinModeActive = false;
let pendingPin = null;

function renderMap() {
  const img = document.getElementById('map-image');
  const empty = document.getElementById('map-empty-state');
  const mtools = document.getElementById('map-member-tools');
  if (mtools) mtools.style.display = 'flex';
  if (eventData.map_image) {
    img.src = eventData.map_image;
    img.style.display = 'block';
    empty.style.display = 'none';
    document.getElementById('map-container').style.cursor = pinModeActive ? 'crosshair' : 'default';
  } else {
    img.style.display = 'none';
    empty.style.display = 'flex';
    document.getElementById('map-container').style.cursor = 'default';
  }
  renderMapPins();
}

function renderMapPins() {
  const layer = document.getElementById('map-pins-layer');
  layer.style.pointerEvents = pinModeActive ? 'none' : 'auto';
  layer.innerHTML = eventData.map_pins.map(p => `
    <div class="map-pin" style="left:${p.x}%;top:${p.y}%;" title="${escHtml(p.label)}">
      <i class="fas fa-map-pin" style="color:var(--red);font-size:1.2rem;filter:drop-shadow(0 1px 2px #000);"></i>
      <div class="map-pin-label">${escHtml(p.label)}</div>
      <button class="map-pin-remove" onclick="removePin('${p.id}')"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function togglePinMode() {
  if (!eventData.map_image) { alert('Please upload a map image first.'); return; }
  pinModeActive = !pinModeActive;
  const btn = document.getElementById('pin-mode-btn');
  const notice = document.getElementById('map-pin-mode-notice');
  if (pinModeActive) {
    btn.classList.add('cbtn-active');
    btn.innerHTML = '<i class="fas fa-times"></i> Cancel Pin';
    document.getElementById('map-container').style.cursor = 'crosshair';
    notice.style.display = 'block';
  } else {
    btn.classList.remove('cbtn-active');
    btn.innerHTML = '<i class="fas fa-map-pin"></i> Add Pin';
    document.getElementById('map-container').style.cursor = 'default';
    notice.style.display = 'none';
  }
  renderMapPins();
}

function handleMapClick(e) {
  if (!pinModeActive || !eventData.map_image) return;
  const container = document.getElementById('map-container');
  const rect = container.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  pendingPin = { x, y };
  document.getElementById('pin-label-input').value = '';
  openModal('pin-modal');
  setTimeout(() => document.getElementById('pin-label-input').focus(), 50);
}

async function confirmPin() {
  if (!pendingPin) return;
  const label = document.getElementById('pin-label-input').value.trim() || 'Pin';
  eventData.map_pins.push({ id: uid(), x: pendingPin.x, y: pendingPin.y, label });
  pendingPin = null;
  closeModal('pin-modal');
  pinModeActive = false;
  const btn = document.getElementById('pin-mode-btn');
  btn.classList.remove('cbtn-active');
  btn.innerHTML = '<i class="fas fa-map-pin"></i> Add Pin';
  document.getElementById('map-pin-mode-notice').style.display = 'none';
  document.getElementById('map-container').style.cursor = 'default';
  renderMapPins();
  await patchEvent({ map_pins: JSON.stringify(eventData.map_pins) });
}

function cancelPin() { pendingPin = null; if (pinModeActive) togglePinMode(); }

async function removePin(id) {
  eventData.map_pins = eventData.map_pins.filter(p => p.id !== id);
  renderMapPins();
  await patchEvent({ map_pins: JSON.stringify(eventData.map_pins) });
}

function handleMapUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Map image must be under 10MB.'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    eventData.map_image = e.target.result;
    eventData.map_pins  = [];
    renderMap();
    await patchEvent({ map_image: e.target.result, map_pins: '[]' });
  };
  reader.readAsDataURL(file);
}

async function clearMap() {
  if (!confirm('Remove map image and all pins?')) return;
  eventData.map_image = null;
  eventData.map_pins  = [];
  renderMap();
  await patchEvent({ map_image: null, map_pins: '[]' });
}

// ══════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════
let lbScrolling = false;
let lbScrollInterval = null;

function renderLeaderboard() {
  const sorted = [...eventData.leaderboard].sort((a, b) => {
    const sd = (b.score||0) - (a.score||0);
    if (sd !== 0) return sd;
    return (b.wins||0) - (a.wins||0);
  });
  const html = sorted.map((t, i) => `
    <div class="lb-row ${i === 0 ? 'lb-gold' : i === 1 ? 'lb-silver' : i === 2 ? 'lb-bronze' : ''}">
      <div class="lb-rank">${i + 1}</div>
      <div class="lb-team-cell">
        <div class="lb-team-num">${escHtml(t.number || '')}</div>
        <div class="lb-team-name">${escHtml(t.name || '')}</div>
      </div>
      <div class="lb-score">${t.score ?? '—'}</div>
      <div class="lb-wins">${t.wins ?? '—'}</div>
      <div class="lb-losses">${t.losses ?? '—'}</div>
      <div class="lb-rp">${t.rp ?? '—'}</div>
      <div class="lb-edit-col">
        <button class="icon-btn" onclick="editLbTeam('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="icon-btn danger" onclick="deleteLbTeam('${t.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
  document.getElementById('lb-track').innerHTML = html;
  if (document.getElementById('fs-lb-track')) document.getElementById('fs-lb-track').innerHTML = html;
  const mtools = document.getElementById('lb-member-tools');
  if (mtools) mtools.style.display = 'flex';
}

function openAddTeamModal() {
  document.getElementById('lb-edit-id').value = '';
  document.getElementById('lb-team-modal-title').textContent = 'ADD TEAM';
  ['lb-num','lb-name','lb-score','lb-wins','lb-losses','lb-rp'].forEach(id => document.getElementById(id).value = '');
  openModal('lb-team-modal');
  setTimeout(() => document.getElementById('lb-num').focus(), 50);
}

function editLbTeam(id) {
  const t = eventData.leaderboard.find(t => t.id === id);
  if (!t) return;
  document.getElementById('lb-edit-id').value = id;
  document.getElementById('lb-team-modal-title').textContent = 'EDIT TEAM';
  document.getElementById('lb-num').value    = t.number ?? '';
  document.getElementById('lb-name').value   = t.name   ?? '';
  document.getElementById('lb-score').value  = t.score  ?? '';
  document.getElementById('lb-wins').value   = t.wins   ?? '';
  document.getElementById('lb-losses').value = t.losses ?? '';
  document.getElementById('lb-rp').value     = t.rp     ?? '';
  openModal('lb-team-modal');
}

async function saveLbTeam() {
  const editId = document.getElementById('lb-edit-id').value;
  const data = {
    number: document.getElementById('lb-num').value.trim(),
    name:   document.getElementById('lb-name').value.trim(),
    score:  parseFloat(document.getElementById('lb-score').value)  || 0,
    wins:   parseInt(document.getElementById('lb-wins').value,10)   || 0,
    losses: parseInt(document.getElementById('lb-losses').value,10) || 0,
    rp:     parseFloat(document.getElementById('lb-rp').value)      || 0,
  };
  if (!data.number && !data.name) { alert('Team number or name is required.'); return; }
  if (editId) {
    const t = eventData.leaderboard.find(t => t.id === editId);
    if (t) Object.assign(t, data);
  } else {
    eventData.leaderboard.push({ id: uid(), ...data });
  }
  closeModal('lb-team-modal');
  renderLeaderboard();
  await patchEvent({ leaderboard_data: JSON.stringify(eventData.leaderboard) });
}

async function deleteLbTeam(id) {
  if (!confirm('Remove this team from the leaderboard?')) return;
  eventData.leaderboard = eventData.leaderboard.filter(t => t.id !== id);
  renderLeaderboard();
  await patchEvent({ leaderboard_data: JSON.stringify(eventData.leaderboard) });
}

function toggleLbScroll() {
  lbScrolling = !lbScrolling;
  const btn = document.getElementById('scroll-toggle-btn');
  if (lbScrolling) {
    btn.innerHTML = '<i class="fas fa-stop"></i> Stop Scroll';
    startLbScroll();
  } else {
    btn.innerHTML = '<i class="fas fa-play"></i> Start Scroll';
    clearInterval(lbScrollInterval);
  }
}

function updateScrollSpeed() {
  if (lbScrolling) { clearInterval(lbScrollInterval); startLbScroll(); }
}

function startLbScroll() {
  const speed = parseInt(document.getElementById('scroll-speed')?.value || 4, 10);
  const delay = Math.round(1100 - speed * 100);
  lbScrollInterval = setInterval(() => {
    const win = document.getElementById('lb-scroll-window');
    if (!win) return;
    const max = win.scrollHeight - win.clientHeight;
    if (win.scrollTop >= max) win.scrollTop = 0;
    else win.scrollTop += 40;
  }, delay);
}

// Fullscreen
function openFullscreen() {
  renderLeaderboard();
  document.getElementById('fs-event-name').textContent   = eventData.name;
  document.getElementById('fs-hosting-team').textContent = eventData.hosting_team;
  document.getElementById('fullscreen-overlay').style.display = 'flex';
}
function closeFullscreen() {
  document.getElementById('fullscreen-overlay').style.display = 'none';
}

// ══════════════════════════════════════════
// PACKING
// ══════════════════════════════════════════
function renderPacking() {
  const list = eventData.packing;
  const packed = list.filter(i => i.packed).length;
  const pct = list.length ? Math.round(packed / list.length * 100) : 0;
  document.getElementById('pack-progress-bar').style.width = pct + '%';
  document.getElementById('pack-progress-label').textContent = `${packed} / ${list.length} packed (${pct}%)`;

  const cats = [...new Set(list.map(i => i.cat).filter(Boolean))];
  const catList = document.getElementById('pack-cat-list');
  if (catList) catList.innerHTML = cats.map(c => `<option value="${escHtml(c)}">`).join('');

  const el = document.getElementById('packing-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state-small">No packing items yet.</div>'; return; }

  const byCat = {};
  list.forEach(item => {
    const c = item.cat || 'Uncategorised';
    (byCat[c] = byCat[c] || []).push(item);
  });

  el.innerHTML = Object.entries(byCat).map(([cat, items]) => `
    <div class="pack-category">
      <div class="pack-cat-header">${escHtml(cat)}</div>
      ${items.map(i => `
        <div class="pack-item ${i.packed ? 'packed' : ''}">
          <label class="pack-check">
            <input type="checkbox" ${i.packed ? 'checked' : ''} onchange="togglePack('${i.id}', this.checked)">
            <span class="pack-item-name">${escHtml(i.item)}</span>
          </label>
          <button class="icon-btn danger" onclick="deletePackItem('${i.id}')"><i class="fas fa-trash"></i></button>
        </div>`).join('')}
    </div>`).join('');
}

function openAddPackModal() {
  document.getElementById('pack-cat-input').value  = '';
  document.getElementById('pack-item-input').value = '';
  openModal('pack-modal');
  setTimeout(() => document.getElementById('pack-cat-input').focus(), 50);
}

async function savePackItem() {
  const cat  = document.getElementById('pack-cat-input').value.trim()  || 'Uncategorised';
  const item = document.getElementById('pack-item-input').value.trim();
  if (!item) { alert('Item name is required.'); return; }
  eventData.packing.push({ id: uid(), cat, item, packed: false });
  closeModal('pack-modal');
  renderPacking();
  await patchEvent({ packing_data: JSON.stringify(eventData.packing) });
}

async function togglePack(id, checked) {
  const i = eventData.packing.find(i => i.id === id);
  if (i) i.packed = checked;
  renderPacking();
  await patchEvent({ packing_data: JSON.stringify(eventData.packing) });
}

async function deletePackItem(id) {
  if (!confirm('Remove this packing item?')) return;
  eventData.packing = eventData.packing.filter(i => i.id !== id);
  renderPacking();
  await patchEvent({ packing_data: JSON.stringify(eventData.packing) });
}

// ══════════════════════════════════════════
// BANNERS
// ══════════════════════════════════════════
function renderBannerStrip() {
  const el = document.getElementById('banner-strip');
  if (!eventData.banners.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const texts = eventData.banners.map(b => `<span class="banner-item">${escHtml(b.text)}</span>`).join('<span class="banner-sep">•</span>');
  el.innerHTML = `<div class="banner-scroll">${texts}${texts}</div>`;
  renderBannerModal();
}

function renderBannerModal() {
  const list = document.getElementById('banner-list-modal');
  if (!list) return;
  list.innerHTML = eventData.banners.map(b => `
    <div style="display:flex;align-items:center;gap:.5rem;">
      <span style="flex:1;font-size:.85rem;color:var(--text-muted);">${escHtml(b.text)}</span>
      <button class="icon-btn danger" onclick="removeBanner('${b.id}')"><i class="fas fa-trash"></i></button>
    </div>`).join('') || '<div style="color:#555;font-size:.8rem;">No announcements.</div>';
}

function openBannerModal() {
  document.getElementById('banner-text-input').value = '';
  renderBannerModal();
  openModal('banner-modal');
}

async function addBanner() {
  const text = document.getElementById('banner-text-input').value.trim();
  if (!text) { alert('Enter announcement text.'); return; }
  eventData.banners.push({ id: uid(), text });
  document.getElementById('banner-text-input').value = '';
  renderBannerStrip();
  await patchEvent({ banners_data: JSON.stringify(eventData.banners) });
}

async function removeBanner(id) {
  eventData.banners = eventData.banners.filter(b => b.id !== id);
  renderBannerStrip();
  renderBannerModal();
  await patchEvent({ banners_data: JSON.stringify(eventData.banners) });
}

// ══════════════════════════════════════════
// MEMBERS TAB
// ══════════════════════════════════════════
function renderMembersTab() {
  // Fill event info box
  document.getElementById('eif-name').textContent     = eventData.name || '—';
  document.getElementById('eif-team').textContent     = eventData.hosting_team || '—';
  document.getElementById('eif-date').textContent     = eventData.event_date || 'TBD';
  document.getElementById('eif-location').textContent = eventData.location || 'TBD';
  document.getElementById('eif-code').textContent     = eventData.invite_code || '';

  // Members list
  const el = document.getElementById('members-list');
  const members = eventData.members || [];
  if (!members.length) { el.innerHTML = '<div class="empty-state-small">No members yet.</div>'; return; }

  const roleLabels = { owner: 'Owner', member: 'Member' };
  const statusLabels = { accepted: 'Accepted', pending: 'Pending' };

  el.innerHTML = members.map(m => `
    <div class="member-row">
      <div class="member-avatar">${(m.name || m.email || '?')[0].toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${escHtml(m.name || m.email || 'Invited user')}</div>
        <div class="member-email">${escHtml(m.email || '')}</div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <span class="badge ${m.role === 'owner' ? 'badge-red' : 'badge-blue'}">${roleLabels[m.role] || m.role}</span>
        <span class="badge ${m.status === 'accepted' ? 'badge-green' : 'badge-gray'}">${statusLabels[m.status] || m.status}</span>
        ${(eventData.is_owner && m.role !== 'owner') ? `<button class="icon-btn danger" title="Remove member" onclick="removeMember('${m.id}')"><i class="fas fa-user-xmark"></i></button>` : ''}
      </div>
    </div>`).join('');
}

async function inviteMember() {
  const email = document.getElementById('invite-email-input').value.trim();
  if (!email) { alert('Enter an email address.'); return; }
  const res = await apiFetch(`/api/events/${EVENT_ID}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (res && res.ok) {
    document.getElementById('invite-email-input').value = '';
    alert(`Invitation sent to ${email}.`);
  } else {
    const body = await res?.json().catch(() => ({}));
    alert('Failed to send invite: ' + (body?.error || 'Unknown error'));
  }
}

async function removeMember(memberId) {
  if (!confirm('Remove this member from the event?')) return;
  const res = await apiFetch(`/api/events/${EVENT_ID}/members/${memberId}`, { method: 'DELETE' });
  if (res && res.ok) {
    eventData.members = eventData.members.filter(m => m.id !== memberId);
    renderMembersTab();
  } else {
    alert('Failed to remove member.');
  }
}

function copyInviteLink() {
  const url = `${window.location.origin}/tools/competition/join?code=${encodeURIComponent(eventData.invite_code)}`;
  navigator.clipboard.writeText(url).then(() => {
    alert('Invite link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

function shareGuestLink() {
  const url = `${window.location.origin}/tools/competition/event/${EVENT_ID}/view`;
  navigator.clipboard.writeText(url).then(() => {
    alert('Public viewer link copied to clipboard!\n\nAnyone with this link can view the queue, map, and leaderboard without signing in.');
  }).catch(() => {
    prompt('Share this link with guests (no sign-in required):', url);
  });
}

async function closeEvent() {
  if (!confirm('Close this event? All event data will be permanently deleted and cannot be recovered.')) return;
  if (!confirm('Are you absolutely sure? This will delete the event for everyone.')) return;
  const res = await apiFetch('/api/events/' + EVENT_ID, { method: 'DELETE' });
  if (res && res.ok) {
    window.location.replace('/tools/competition/dashboard');
  } else {
    const body = await res?.json().catch(() => ({}));
    alert('Failed to close event: ' + (body?.error || 'Unknown error'));
  }
}

async function leaveEvent() {
  if (!confirm('Leave this event? You will lose access and will need a new invite to rejoin.')) return;
  const res = await apiFetch(`/api/events/${EVENT_ID}/members/me`, { method: 'DELETE' });
  if (res && res.ok) {
    window.location.replace('/tools/competition/dashboard');
  } else {
    const body = await res?.json().catch(() => ({}));
    alert('Failed to leave event: ' + (body?.error || 'Unknown error'));
  }
}

// ══════════════════════════════════════════
// EDIT EVENT DETAILS (OWNER)
// ══════════════════════════════════════════
function fillEditEventForm() {
  document.getElementById('edit-ev-name').value     = eventData.name           || '';
  document.getElementById('edit-ev-team').value     = eventData.hosting_team   || '';
  document.getElementById('edit-ev-date').value     = eventData.event_date     || '';
  document.getElementById('edit-ev-location').value = eventData.location       || '';
  document.getElementById('edit-ev-desc').value     = eventData.description    || '';
}

async function saveEventDetails() {
  const updates = {
    name:         document.getElementById('edit-ev-name').value.trim(),
    hosting_team: document.getElementById('edit-ev-team').value.trim(),
    event_date:   document.getElementById('edit-ev-date').value.trim(),
    location:     document.getElementById('edit-ev-location').value.trim(),
    description:  document.getElementById('edit-ev-desc').value.trim(),
  };
  if (!updates.name || !updates.hosting_team) { alert('Competition name and hosting team are required.'); return; }
  const res = await apiFetch('/api/events/' + EVENT_ID, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (res && res.ok) {
    Object.assign(eventData, updates);
    document.title = escHtml(eventData.name) + ' — Competition Host';
    document.getElementById('header-event-name').innerHTML = `<i class="fas fa-trophy"></i> ${escHtml(eventData.name)}`;
    document.getElementById('hosting-team-label').textContent = 'Hosted by ' + eventData.hosting_team;
    renderMembersTab();
    setSaveStatus('saved');
  } else {
    setSaveStatus('error');
    alert('Failed to save event details. Please try again.');
  }
}

/* ══════════════════════════════════════════
   Competition Tool — Shared Auth Utilities
   Loaded on every competition tool page
   ══════════════════════════════════════════ */

const AUTH_KEY = 'mm_comp_jwt';

function getJWT() {
  return localStorage.getItem(AUTH_KEY);
}

function setJWT(token) {
  localStorage.setItem(AUTH_KEY, token);
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/** Decode JWT payload (no signature check — server validates on API calls) */
function getCurrentUser() {
  try {
    const token = getJWT();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearAuth();
      return null;
    }
    return payload; // { sub, name, email, iat, exp }
  } catch {
    return null;
  }
}

/**
 * Redirect to login if not authenticated.
 * Call at the top of any page that requires auth.
 * Returns the current user, or null if redirected.
 */
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    const dest = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('/tools/competition/login?redirect=' + dest);
    return null;
  }
  return user;
}

/**
 * Fetch wrapper that attaches Authorization header and handles 401s.
 */
async function apiFetch(url, options = {}) {
  const token = getJWT();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearAuth();
      window.location.replace('/tools/competition/login');
      return null;
    }
    return res;
  } catch (e) {
    console.error('API fetch error:', e);
    return null;
  }
}

/** Format a unix timestamp to a human-readable date string */
function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Escape HTML to prevent XSS */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

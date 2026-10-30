/**
 * admin/js/connect.js - the Profile page's "Connect Claude" card (apikeys-api.php).
 */
const keyEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const keyWhen = d => d ? new Date(d.replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never';

async function loadKeys() {
  const box = document.getElementById('keyList');
  if (!box) return;
  try {
    const d = await csrfFetch('apikeys-api.php').then(r => r.json());
    if (d.error) { box.textContent = d.error; return; }
    box.innerHTML = d.keys.length
      ? d.keys.map(k => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border);">
          <div style="flex:1;min-width:0;"><b>${keyEsc(k.label)}</b><div style="color:var(--text-muted);font-size:12px;">made ${keyWhen(k.created_at)} · last used ${keyWhen(k.last_used_at)}</div></div>
          <button class="btn btn-ghost" type="button" onclick="revokeKey(${k.id})">Revoke</button></div>`).join('')
      : '<div style="color:var(--text-muted);">No connector links yet.</div>';
  } catch (e) { box.textContent = 'Could not load keys.'; }
}
async function makeKey() {
  const label = document.getElementById('keyLabel').value;
  const d = await csrfFetch('apikeys-api.php', { method: 'POST', body: JSON.stringify({ label }) }).then(r => r.json());
  if (d.error) { showToast ? showToast(d.error, 'error') : alert(d.error); return; }
  document.getElementById('newKeyUrl').value = d.url;
  document.getElementById('newKey').hidden = false;
  document.getElementById('keyLabel').value = '';
  loadKeys();
}
function copyKey() {
  const el = document.getElementById('newKeyUrl');
  navigator.clipboard.writeText(el.value).then(() => showToast && showToast('Link copied', 'success')).catch(() => el.select());
}
async function revokeKey(id) {
  if (!confirm('Revoke this link? Claude will lose access through it at once.')) return;
  await csrfFetch('apikeys-api.php?id=' + id, { method: 'DELETE' });
  loadKeys();
}

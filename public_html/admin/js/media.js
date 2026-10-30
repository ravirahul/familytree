// admin/js/media.js

let mediaItems = [];
let filteredMedia = [];
let mediaTagsSelected = []; // member_id array
let selectedMediaId = null;
let mediaEditMode = false;

// ---------- FETCH & FILTER ----------

async function fetchMedia(query = '') {
    try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());

        const res = await csrfFetch('media-api.php?' + params.toString());
        if (!res.ok) return;
        mediaItems = await res.json();
        applyMediaFilters();
    } catch (err) {
        console.error('Failed to fetch media', err);
    }
}

function applyMediaFilters() {
    const text = (document.getElementById('mediaSearch')?.value || '').trim().toLowerCase();
    filteredMedia = mediaItems.filter(m => {
        if (!text) return true;

        const parts = [
            m.title || '',
            m.description || '',
            m.url || '',
            m.uploaded_by_display_name || ''
        ];

        if (Array.isArray(m.tags)) {
            m.tags.forEach(t => {
                parts.push(
                    String(t.member_id || ''),
                    t.member_name || '',
                    t.member_nickname || ''
                );
            });
        }

        const hay = parts.join(' ').toLowerCase();
        return hay.includes(text);
    });

    renderMediaGrid();
}

// ---------- GRID RENDERING ----------

function renderMediaGrid() {
    const grid = document.getElementById('mediaGrid');
    const badge = document.getElementById('mediaCountBadge');
    const subtitle = document.getElementById('mediaSubtitle');
    if (!grid) return;

    grid.innerHTML = '';

    if (!filteredMedia.length) {
        grid.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-muted);">No photos found. Upload or adjust search.</div>';
        if (badge) badge.textContent = '0';
        if (subtitle) subtitle.textContent = 'No photos found';
        // also hide detail panel if nothing selected
        const editor = document.getElementById('mediaEditor');
        if (editor) editor.style.display = 'none';
        selectedMediaId = null;
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
    wrap.style.gap = '10px';

    filteredMedia.forEach(m => {
        const item = document.createElement('div');
        item.style.cursor = 'pointer';
        item.style.borderRadius = '12px';
        item.style.overflow = 'hidden';
        item.style.border = '1px solid ' + (m.id === selectedMediaId ? 'var(--accent)' : 'var(--border)');
        item.style.background = 'var(--bg-stripe)';
        item.style.boxShadow = m.id === selectedMediaId ? '0 0 0 1px rgba(var(--accent-rgb),.5)' : 'none';
        item.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease';

        item.onmouseenter = () => {
            item.style.transform = 'translateY(-1px)';
        };
        item.onmouseleave = () => {
            item.style.transform = 'none';
        };

        const created = formatMediaDate(m.created_at);
        const tagCount = Array.isArray(m.tags) ? m.tags.length : 0;

        item.innerHTML = `
            <div style="position:relative;padding-top:65%;overflow:hidden;">
                ${mediaThumbHtml(m)}
            </div>
            <div style="padding:6px 8px 8px;">
                <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${m.title ? m.title : 'Untitled'}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${tagCount ? (tagCount + ' tagged') : 'No tags'}${created ? ' · ' + created : ''}
                </div>
            </div>
        `;
        item.onclick = () => selectMedia(m.id);
        wrap.appendChild(item);
    });

    grid.appendChild(wrap);

    if (badge) badge.textContent = String(filteredMedia.length);
    if (subtitle) subtitle.textContent = `Showing ${filteredMedia.length} photo${filteredMedia.length !== 1 ? 's' : ''}`;

    // If nothing selected yet, auto-select first
    if (selectedMediaId === null && filteredMedia.length) {
        selectedMediaId = filteredMedia[0].id;
        mediaEditMode = false;
        renderMediaDetail();
        renderMediaGrid(); // refresh selection visuals
    }
}

// ---------- SELECTION & DETAIL PANEL ----------

function formatMediaDate(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
}

function formatMediaDateTime(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function selectMedia(id) {
    selectedMediaId = id;
    mediaEditMode = false;
    renderMediaDetail();
    renderMediaGrid();
}

function getSelectedMedia() {
    if (selectedMediaId == null) return null;
    return mediaItems.find(m => m.id == selectedMediaId) || null;
}

function renderMediaDetail() {
    const editor = document.getElementById('mediaEditor');
    if (!editor) return;

    const m = getSelectedMedia();
    if (!m) {
        editor.style.display = 'none';
        return;
    }

    editor.style.display = 'block';

    // Preview
    setMediaPreview(m.url || '', m.type || 'image');

    // Hidden id
    const idInput = document.getElementById('mediaId');
    if (idInput) idInput.value = m.id;

    // Header
    const titleEl = document.getElementById('mediaFormTitle');
    const subEl = document.getElementById('mediaFormSubtitle');
    if (titleEl) titleEl.textContent = 'Photo details';
    if (subEl) subEl.textContent = 'ID: ' + m.id;

    // View wrappers
    const titleViewWrapper = document.getElementById('mediaTitleViewWrapper');
    const descViewWrapper = document.getElementById('mediaDescriptionViewWrapper');
    const titleView = document.getElementById('mediaTitleView');
    const descView = document.getElementById('mediaDescriptionView');

    // Edit wrappers
    const titleEditWrapper = document.getElementById('mediaTitleEditWrapper');
    const descEditWrapper = document.getElementById('mediaDescriptionEditWrapper');
    const titleInput = document.getElementById('mediaTitle');
    const descInput = document.getElementById('mediaDescription');

    // Edit actions
    const editActions = document.getElementById('mediaEditActions');
    const editBtn = document.getElementById('mediaEditBtn');

    if (mediaEditMode) {
        // show inputs
        if (titleViewWrapper) titleViewWrapper.style.display = 'none';
        if (descViewWrapper) descViewWrapper.style.display = 'none';
        if (titleEditWrapper) titleEditWrapper.style.display = 'block';
        if (descEditWrapper) descEditWrapper.style.display = 'block';
        if (titleInput) titleInput.value = m.title || '';
        if (descInput) descInput.value = m.description || '';
        if (editActions) {
            editActions.style.display = 'flex';
        }
        if (editBtn) {
            editBtn.disabled = true;
            editBtn.style.opacity = '0.5';
        }
    } else {
        // show read-only view
        if (titleViewWrapper) titleViewWrapper.style.display = 'block';
        if (descViewWrapper) descViewWrapper.style.display = 'block';
        if (titleEditWrapper) titleEditWrapper.style.display = 'none';
        if (descEditWrapper) descEditWrapper.style.display = 'none';
        if (titleView) titleView.textContent = m.title || 'Untitled';
        if (descView) descView.textContent = m.description || '—';
        if (editActions) {
            editActions.style.display = 'none';
        }
        if (editBtn) {
            editBtn.disabled = false;
            editBtn.style.opacity = '1';
        }
    }

    // Uploader info
    renderMediaUploaderInfo(m);

    // Tags
    renderMediaTagsView(m);
    if (mediaEditMode) {
        mediaTagsSelected = Array.isArray(m.tags) ? m.tags.map(t => t.member_id) : [];
        renderMediaTagChips();
    }

    // Toggle tag wrappers
    const tagsViewWrapper = document.getElementById('mediaTagsViewWrapper');
    const tagsEditWrapper = document.getElementById('mediaTagsEditWrapper');
    if (tagsViewWrapper && tagsEditWrapper) {
        if (mediaEditMode) {
            tagsViewWrapper.style.display = 'none';
            tagsEditWrapper.style.display = 'block';
        } else {
            tagsViewWrapper.style.display = 'block';
            tagsEditWrapper.style.display = 'none';
        }
    }
}

function renderMediaUploaderInfo(m) {
    const container = document.getElementById('mediaUploaderInfo');
    if (!container) return;

    container.innerHTML = '';

    const name = m.uploaded_by_display_name || 'Unknown uploader';
    const avatar = m.uploaded_by_avatar || null;
    const created = formatMediaDateTime(m.created_at);

    const pill = document.createElement('div');
    pill.style.display = 'inline-flex';
    pill.style.alignItems = 'center';
    pill.style.gap = '6px';

    const avatarEl = document.createElement('div');
    avatarEl.style.width = '24px';
    avatarEl.style.height = '24px';
    avatarEl.style.borderRadius = '999px';
    avatarEl.style.overflow = 'hidden';
    avatarEl.style.border = '1px solid var(--border)';
    avatarEl.style.display = 'flex';
    avatarEl.style.alignItems = 'center';
    avatarEl.style.justifyContent = 'center';
    avatarEl.style.fontSize = '11px';
    avatarEl.style.background = 'var(--bg-stripe)';
    avatarEl.style.color = 'var(--text-primary)';

    if (avatar) {
        const img = document.createElement('img');
        img.src = avatar;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        avatarEl.appendChild(img);
    } else {
        avatarEl.textContent = name.trim().charAt(0).toUpperCase();
    }

    const text = document.createElement('div');
    text.style.display = 'flex';
    text.style.flexDirection = 'column';
    text.style.fontSize = '11px';

    const line1 = document.createElement('span');
    line1.textContent = name;

    const line2 = document.createElement('span');
    line2.style.color = 'var(--text-muted)';
    line2.textContent = created ? ('Uploaded on ' + created) : '';

    text.appendChild(line1);
    if (created) text.appendChild(line2);

    pill.appendChild(avatarEl);
    pill.appendChild(text);

    container.appendChild(pill);
}

// ---------- TAGS (VIEW MODE) ----------

function renderMediaTagsView(m) {
    const container = document.getElementById('mediaTagsView');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(m.tags) || m.tags.length === 0) {
        const span = document.createElement('span');
        span.style.fontSize = '11px';
        span.style.color = 'var(--text-muted)';
        span.textContent = 'No tagged members yet.';
        container.appendChild(span);
        return;
    }

    m.tags.forEach(t => {
        const pill = document.createElement('div');
        pill.style.display = 'inline-flex';
        pill.style.alignItems = 'center';
        pill.style.gap = '6px';
        pill.style.padding = '2px 8px';
        pill.style.borderRadius = '999px';
        pill.style.border = '1px solid var(--border)';

        const avatar = document.createElement('div');
        avatar.style.width = '20px';
        avatar.style.height = '20px';
        avatar.style.borderRadius = '999px';
        avatar.style.overflow = 'hidden';
        avatar.style.border = '1px solid var(--border)';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.fontSize = '10px';
        avatar.style.background = 'var(--bg-stripe)';
        avatar.style.color = 'var(--text-primary)';

        if (t.member_avatar) {
            const img = document.createElement('img');
            img.src = t.member_avatar;
            img.alt = '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            avatar.appendChild(img);
        } else {
            const base = (t.member_name || '').trim();
            avatar.textContent = base ? base.charAt(0).toUpperCase() : '?';
        }

        const label = document.createElement('span');
        label.textContent = (t.member_name || 'Unknown') + (t.member_nickname ? ` (${t.member_nickname})` : '');

        pill.appendChild(avatar);
        pill.appendChild(label);
        container.appendChild(pill);
    });
}

// ---------- EDIT MODE TOGGLING ----------

function enterMediaEditMode() {
    const m = getSelectedMedia();
    if (!m) return;
    mediaEditMode = true;
    // init selected tags from current media
    mediaTagsSelected = Array.isArray(m.tags) ? m.tags.map(t => t.member_id) : [];
    renderMediaDetail();
}

function exitMediaEditMode(revert) {
    if (revert) {
        // just re-render from current mediaItems
        mediaEditMode = false;
        renderMediaDetail();
    } else {
        mediaEditMode = false;
        renderMediaDetail();
    }
}

// ---------- TAG SELECTION (EDIT MODE) ----------

function renderMediaTagChips() {
    const chips = document.getElementById('mediaTagChips');
    if (!chips) return;
    chips.innerHTML = '';

    if (!mediaTagsSelected.length) return;

    const byId = Object.fromEntries(members.map(m => [m.id, m]));
    mediaTagsSelected.forEach(id => {
        const m = byId[id];
        const name = m ? (m.name || '') : ('ID ' + id);
        const nick = m && m.nickname ? ` (${m.nickname})` : '';
        const chip = document.createElement('div');
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '4px';
        chip.style.padding = '2px 8px';
        chip.style.borderRadius = '999px';
        chip.style.border = '1px solid var(--border)';
        chip.style.fontSize = '11px';

        chip.innerHTML = `
            <span>${name}${nick}</span>
            <button type="button" style="border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;">×</button>
        `;
        chip.querySelector('button').onclick = () => {
            mediaTagsSelected = mediaTagsSelected.filter(x => x !== id);
            renderMediaTagChips();
        };
        chips.appendChild(chip);
    });
}

function searchMediaTagCandidates(query) {
    const resContainer = document.getElementById('mediaTagResults');
    if (!resContainer) return;
    const q = query.trim().toLowerCase();
    if (!q) {
        resContainer.innerHTML = '';
        return;
    }
    const results = members.filter(m => {
        const hay = [
            m.id,
            m.name || '',
            m.nickname || ''
        ].join(' ').toLowerCase();
        return hay.includes(q) && !mediaTagsSelected.includes(m.id);
    }).slice(0, 8);

    if (!results.length) {
        resContainer.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">No matching members</div>';
        return;
    }

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '4px';

    results.forEach(m => {
        const name = m.name || '';
        const nick = m.nickname ? ` (${m.nickname})` : '';
        const item = document.createElement('button');
        item.type = 'button';
        item.style.border = '1px solid var(--border)';
        item.style.borderRadius = '999px';
        item.style.padding = '4px 8px';
        item.style.background = 'var(--bg-stripe)';
        item.style.color = 'var(--text-primary)';
        item.style.fontSize = '11px';
        item.style.textAlign = 'left';
        item.style.cursor = 'pointer';
        item.textContent = `${name}${nick} [${m.id}]`;
        item.onclick = () => {
            mediaTagsSelected.push(m.id);
            document.getElementById('mediaTagSearch').value = '';
            resContainer.innerHTML = '';
            renderMediaTagChips();
        };
        list.appendChild(item);
    });

    resContainer.innerHTML = '';
    resContainer.appendChild(list);
}

// ---------- SAVE & DELETE ----------

async function saveMedia(e) {
    e.preventDefault();
    const id = document.getElementById('mediaId').value || null;
    const preview = document.getElementById('mediaPreview');
    const url = preview.dataset.url || preview.src || '';
    const title = document.getElementById('mediaTitle')?.value.trim() || '';
    const desc = document.getElementById('mediaDescription')?.value.trim() || '';

    if (!url) return;

    const payload = {
        url,
        type: preview.dataset.type || 'image',
        title: title || null,
        description: desc || null,
        tags: mediaTagsSelected
    };

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? ('media-api.php?id=' + encodeURIComponent(id)) : 'media-api.php';

    try {
        const res = await csrfFetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok && res.status !== 201) {
            console.error('Save media failed', res.status);
            return;
        }
        const saved = await res.json();

        // Update local list
        const idx = mediaItems.findIndex(m => m.id == saved.id);
        if (idx >= 0) mediaItems[idx] = saved;
        else mediaItems.unshift(saved);

        selectedMediaId = saved.id;
        mediaEditMode = false;

        applyMediaFilters(); // re-renders grid and detail via selection
    } catch (err) {
        console.error('Save media error', err);
    }
}

async function deleteMediaConfirmed() {
    const id = document.getElementById('mediaId').value;
    if (!id) return;
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
        const res = await csrfFetch('media-api.php?id=' + encodeURIComponent(id), {
            method: 'DELETE'
        });
        if (!res.ok && res.status !== 204) {
            console.error('Delete media failed', res.status);
            return;
        }
        // Remove from local list
        mediaItems = mediaItems.filter(m => m.id != id);
        selectedMediaId = null;
        mediaEditMode = false;
        applyMediaFilters();
    } catch (err) {
        console.error('Delete media error', err);
    }
}

// ---------- UPLOAD ENTRY POINT ----------

function openMediaUploader() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/mp4,video/webm,video/quicktime,audio/*';
    // Must be in the DOM or some browsers garbage-collect it before the
    // user finishes picking a file, causing onchange to never fire.
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;pointer-events:none;';
    document.body.appendChild(input);

    input.onchange = async e => {
        // Remove the hidden input right away – we have what we need
        if (input.parentNode) input.parentNode.removeChild(input);

        const file = e.target.files[0];
        if (!file) return;

        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(14,36,27,.94);color:#F7F4EC;padding:20px 28px;border-radius:12px;z-index:9999;font-size:14px;';
        const isImage = file.type.startsWith('image/');
        loadingMsg.textContent = isImage ? 'Uploading image…' : 'Uploading ' + (file.type.startsWith('video/') ? 'video' : 'voice note') + '…';
        document.body.appendChild(loadingMsg);

        const formData = new FormData();
        formData.append(isImage ? 'image' : 'media', file);

        try {
            const res = await csrfFetch(isImage ? 'upload-image.php' : 'upload-media.php', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                alert('Upload failed: ' + (errorData.error || res.statusText));
                return;
            }

            const data = await res.json();
            if (data.url) {
                startNewMedia(data.url, data.type || 'image');
            } else {
                alert('Upload failed: no URL returned');
            }
        } catch (err) {
            console.error('Upload media error', err);
            alert('Upload failed: ' + err.message);
        } finally {
            if (loadingMsg.parentNode) loadingMsg.parentNode.removeChild(loadingMsg);
        }
    };

    input.click();
}

// Show the right preview element for a media type and remember url/type for saveMedia()
function setMediaPreview(url, type) {
    const img = document.getElementById('mediaPreview');
    const vid = document.getElementById('mediaPreviewVideo');
    const aud = document.getElementById('mediaPreviewAudio');
    if (!img) return;
    img.dataset.url = url; img.dataset.type = type || 'image';
    img.hidden = type !== 'image' && type !== undefined && type !== '';
    if (vid) { vid.hidden = type !== 'video'; vid.src = type === 'video' ? url : ''; }
    if (aud) { aud.hidden = type !== 'audio'; aud.src = type === 'audio' ? url : ''; }
    img.src = (type === 'image' || !type) ? url : '';
}

function mediaThumbHtml(m) {
    const t = m.type || 'image';
    if (t === 'video') return `<video src="${m.url}" muted preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video><span style="position:absolute;right:6px;bottom:6px;font-size:10px;background:rgba(0,0,0,.6);color:#fff;padding:2px 6px;border-radius:6px;">VIDEO</span>`;
    if (t === 'audio') return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--sb-bg);color:#DCE8E1;font-size:12px;letter-spacing:.08em;">🎙 VOICE NOTE</div>`;
    return `<img src="${m.url}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`;
}

function startNewMedia(url, type = 'image') {
    mediaTagsSelected = [];
    selectedMediaId = null;  // no saved ID yet
    mediaEditMode = true;

    // Directly set up the editor UI – we can't call renderMediaDetail()
    // here because selectedMediaId is null and it would immediately hide the editor.
    const editor = document.getElementById('mediaEditor');
    if (editor) editor.style.display = 'block';

    const idInput = document.getElementById('mediaId');
    if (idInput) idInput.value = '';

    setMediaPreview(url || '', type);

    const titleEl = document.getElementById('mediaFormTitle');
    if (titleEl) titleEl.textContent = 'New Photo';

    const subEl = document.getElementById('mediaFormSubtitle');
    if (subEl) subEl.textContent = 'Add a title, description and tagged members, then save';

    // Show edit fields, hide view fields
    const show = ['mediaTitleEditWrapper', 'mediaDescriptionEditWrapper', 'mediaTagsEditWrapper'];
    const hide = ['mediaTitleViewWrapper',  'mediaDescriptionViewWrapper',  'mediaTagsViewWrapper'];
    show.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; });
    hide.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none';  });

    const titleInput = document.getElementById('mediaTitle');
    if (titleInput) titleInput.value = '';

    const descInput = document.getElementById('mediaDescription');
    if (descInput) descInput.value = '';

    const editActions = document.getElementById('mediaEditActions');
    if (editActions) editActions.style.display = 'flex';

    const editBtn = document.getElementById('mediaEditBtn');
    if (editBtn) { editBtn.disabled = true; editBtn.style.opacity = '0.5'; }

    renderMediaTagChips();
}

// ---------- EVENT LISTENERS ----------

document.getElementById('mediaSearch')?.addEventListener('input', () => {
    applyMediaFilters();
});

document.getElementById('mediaTagSearch')?.addEventListener('input', e => {
    searchMediaTagCandidates(e.target.value);
});

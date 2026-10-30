<?php if (!empty($_SESSION['admin_logged_in'])): ?>
<div class="page-title-bar">
    <h2>Photos &amp; Media</h2>
</div>
<div id="tabPhotosContent">
    <div class="grid">
        <!-- GRID / LIST PANEL -->
        <section class="table-wrap">
            <div class="table-toolbar">
                <div class="table-toolbar-left">
                    <div>
                        <strong>Photos</strong>
                        <span id="mediaCountBadge" class="badge">0</span>
                    </div>
                    <span id="mediaSubtitle">All uploaded photos, videos and voice notes</span>
                </div>
                <div class="table-toolbar-right">
                    <input
                        id="mediaSearch"
                        type="text"
                        class="input-chip"
                        placeholder="Search title, description, people, uploader"
                    >
                    <!-- Optional future filters: uploader / member -->
                    <!--
                    <select id="mediaFilterUploader" class="input-chip">
                        <option value="">All uploaders</option>
                    </select>
                    <select id="mediaFilterMember" class="input-chip">
                        <option value="">All tagged members</option>
                    </select>
                    -->
                    <button
                        type="button"
                        class="btn btn-primary"
                        onclick="openMediaUploader()"
                    >
                        Upload photo
                    </button>
                </div>
            </div>

            <div class="table-scroll" id="mediaGrid" data-sk="grid" data-n="8">
                <!-- Thumbnails will be rendered here by media.js -->
            </div>
        </section>

        <!-- DETAIL / EDITOR PANEL -->
        <section class="form-wrap" id="mediaEditor" style="display:none;">
            <div class="form-header">
                <div class="form-header-text">
                    <h3 id="mediaFormTitle">Photo details</h3>
                    <small id="mediaFormSubtitle"></small>
                </div>
                <div style="margin-left:auto;display:flex;gap:6px;">
                    <button
                        type="button"
                        class="btn btn-ghost"
                        id="mediaEditBtn"
                        onclick="enterMediaEditMode()"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        class="btn btn-danger"
                        id="mediaDeleteBtn"
                        onclick="deleteMediaConfirmed()"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <p class="form-note">
                Click a photo from the grid to see its details. Use Edit to change title, description or tagged members.
            </p>

            <form id="mediaForm" onsubmit="saveMedia(event)">
                <input type="hidden" id="mediaId">

                <!-- PREVIEW -->
                <div class="form-section">
                    <div class="section-title">Preview</div>
                    <div class="form-row">
                        <div class="form-group full">
                            <img
                                id="mediaPreview"
                                src=""
                                alt=""
                                style="max-width:100%;border-radius:12px;border:1px solid var(--border);background:var(--bg-stripe);"
                            >
                            <video id="mediaPreviewVideo" controls preload="metadata" playsinline hidden style="max-width:100%;border-radius:12px;background:var(--bg-stripe);"></video>
                            <audio id="mediaPreviewAudio" controls preload="metadata" hidden style="width:100%;"></audio>
                        </div>
                    </div>
                </div>

                <!-- DETAILS (VIEW + EDIT) -->
                <div class="form-section">
                    <div class="section-title">Details</div>
                    <div class="form-row">
                        <!-- View mode title -->
                        <div class="form-group full" id="mediaTitleViewWrapper">
                            <label>Title</label>
                            <div id="mediaTitleView" style="font-size:13px;"></div>
                        </div>
                        <!-- Edit mode title -->
                        <div class="form-group full" id="mediaTitleEditWrapper" style="display:none;">
                            <label for="mediaTitle">Title</label>
                            <input id="mediaTitle" type="text">
                        </div>

                        <!-- View mode description -->
                        <div class="form-group full" id="mediaDescriptionViewWrapper">
                            <label>Description</label>
                            <div id="mediaDescriptionView" style="font-size:12px;white-space:pre-wrap;"></div>
                        </div>
                        <!-- Edit mode description -->
                        <div class="form-group full" id="mediaDescriptionEditWrapper" style="display:none;">
                            <label for="mediaDescription">Description</label>
                            <textarea id="mediaDescription" rows="3"></textarea>
                        </div>
                    </div>
                </div>

                <!-- UPLOADER INFO -->
                <div class="form-section">
                    <div class="section-title">Uploaded info</div>
                    <div class="form-row">
                        <div class="form-group full">
                            <div id="mediaUploaderInfo" style="display:flex;align-items:center;gap:8px;font-size:12px;">
                                <!-- JS will render: uploader pill + date/time -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAGS (VIEW + EDIT) -->
                <div class="form-section">
                    <div class="section-title">Tagged members</div>
                    <div class="form-row">
                        <!-- View mode pills -->
                        <div class="form-group full" id="mediaTagsViewWrapper">
                            <div id="mediaTagsView" style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;">
                                <!-- JS: member pills -->
                            </div>
                        </div>

                        <!-- Edit mode pills + search -->
                        <div class="form-group full" id="mediaTagsEditWrapper" style="display:none;">
                            <label for="mediaTagSearch">Search &amp; add members</label>
                            <input
                                id="mediaTagSearch"
                                type="text"
                                placeholder="Type to search members by name or ID"
                            >
                            <div id="mediaTagResults" style="margin-top:6px;font-size:12px;"></div>
                            <div
                                id="mediaTagChips"
                                style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;"
                            ></div>
                        </div>
                    </div>
                </div>

                <!-- EDIT ACTIONS (only visible in edit mode) -->
                <div id="mediaEditActions" style="display:none;gap:8px;margin-top:16px;justify-content:flex-start;">
                    <button class="btn btn-primary" type="submit">Save changes</button>
                    <button class="btn btn-ghost" type="button" onclick="exitMediaEditMode(true)">Cancel</button>
                </div>
            </form>
        </section>
    </div>
</div>
<?php endif; ?>

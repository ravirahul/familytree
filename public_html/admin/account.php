<?php /* account.php – included by index.php, session already started */ ?>
<div class="page-header">
    <h2>My Profile</h2>
    <p>Update your name and change your password</p>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">

    <!-- Profile Details -->
    <div class="card">
        <div class="card-header"><h3>Profile Details</h3></div>
        <div class="card-body">
            <div id="accountAlert" style="margin-bottom:12px;display:none;"></div>
            <div class="form-grid cols1">
                <div class="form-group">
                    <label class="form-label">Display Name</label>
                    <input type="text" id="accDisplayName" class="form-control"
                           placeholder="Your name"
                           value="<?= htmlspecialchars($_SESSION['admin_user']['display_name'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" id="accEmail" class="form-control"
                           placeholder="your@email.com"
                           value="<?= htmlspecialchars($_SESSION['admin_user']['email'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label class="form-label">Role</label>
                    <input type="text" class="form-control" disabled
                           value="<?= htmlspecialchars($_SESSION['admin_user']['role'] ?? 'admin') ?>">
                    <span class="form-hint">Role is managed by the system administrator.</span>
                </div>
            </div>
            <div style="margin-top:16px;">
                <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
            </div>
        </div>
    </div>

    <!-- Change Password -->
    <div class="card">
        <div class="card-header"><h3>Change Password</h3></div>
        <div class="card-body">
            <div id="pwAlert" style="margin-bottom:12px;display:none;"></div>
            <div class="form-grid cols1">
                <div class="form-group">
                    <label class="form-label">Current Password</label>
                    <input type="password" id="accCurrentPw" class="form-control" placeholder="••••••••">
                </div>
                <div class="form-group">
                    <label class="form-label">New Password</label>
                    <input type="password" id="accNewPw" class="form-control" placeholder="Min. 8 characters">
                </div>
                <div class="form-group">
                    <label class="form-label">Confirm New Password</label>
                    <input type="password" id="accConfirmPw" class="form-control" placeholder="Repeat new password">
                </div>
            </div>
            <div style="margin-top:16px;">
                <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
            </div>
        </div>
    </div>

</div>

<!-- Connect Claude: keys for the MCP connector (mcp.php) -->
<div class="card" id="digestCard" style="margin-top:24px;">
    <div class="card-header"><h3>Weekly email</h3></div>
    <div class="card-body">
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:14px;cursor:pointer;">
            <input type="checkbox" id="digestOn" onchange="saveDigest(this.checked)" style="margin-top:3px;width:18px;height:18px;accent-color:var(--border-focus);">
            <span>Every Monday, email me the week's birthdays, anniversaries, remembrance days and tithi days in my family trees.<br>
            <small style="color:var(--text-muted)">Only sent when something is coming up.</small></span>
        </label>
    </div>
</div>

<div class="card" id="claudeCard" style="margin-top:24px;">
    <div class="card-header"><h3>Connect Claude</h3></div>
    <div class="card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;line-height:1.6;">
            Let Claude read and edit your family trees: ask "how is Ravi related to Kamla?", "add my cousin Neha, born 3 May 1994 in Patna, daughter of Arun",
            or paste a GEDCOM file to import. Make a key, then add the link in claude.ai or Claude Desktop under
            <b>Settings &gt; Connectors &gt; Add custom connector</b>, or in Claude Code with
            <code>claude mcp add --transport http familytree "&lt;link&gt;"</code>.
            Claude gets your role in each tree, nothing more.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
            <input id="keyLabel" class="form-control" placeholder="Name this key, e.g. Claude Desktop" maxlength="100" style="max-width:280px;">
            <button class="btn btn-primary" type="button" onclick="makeKey()">Make a connector link</button>
        </div>
        <div id="newKey" hidden style="border:1px solid var(--border-focus);border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:12px;font-weight:600;margin-bottom:6px;">Copy this link now: it is shown only once.</div>
            <div style="display:flex;gap:8px;"><input id="newKeyUrl" class="form-control" readonly style="flex:1;font-family:ui-monospace,Consolas,monospace;font-size:12px;"><button class="btn btn-ghost" type="button" onclick="copyKey()">Copy</button></div>
        </div>
        <div id="keyList" style="font-size:13px;" data-sk="rows" data-n="2"></div>
    </div>
</div>

<!-- Danger Zone -->
<div class="card" style="margin-top:24px;border-color:color-mix(in srgb,var(--red) 30%,transparent);">
    <div class="card-header">
        <h3 style="color:var(--red);">Danger Zone</h3>
    </div>
    <div class="card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
            These actions are permanent. Please be careful.
        </p>
        <button class="btn btn-danger-ghost" onclick="confirmLogoutAll()">
            Log out of all sessions
        </button>

    </div>
</div>

<!-- Delete my account -->
<div class="card" id="deleteAccountCard" style="margin-top:24px;border-color:color-mix(in srgb,var(--red) 30%,transparent);">
    <div class="card-header"><h3 style="color:var(--red);">Delete my account</h3></div>
    <div class="card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 14px;line-height:1.6;">
            Deletes your login, your Claude connector keys and your memberships of other people's trees.
            For each tree you own, you choose: delete it, or hand it to one of its editors.
            This can't be undone.
        </p>
        <button class="btn btn-danger-ghost" type="button" id="delStart" onclick="startDeleteAccount()">Delete my account…</button>
        <div id="delForm" hidden>
            <div id="delTrees"></div>
            <div class="form-grid cols1" style="max-width:420px;margin-top:12px;">
                <div class="form-group">
                    <label class="form-label" for="delConfirm">Type DELETE to confirm</label>
                    <input type="text" id="delConfirm" class="form-control" autocomplete="off" spellcheck="false">
                </div>
                <div class="form-group">
                    <label class="form-label" for="delPw">Your password</label>
                    <input type="password" id="delPw" class="form-control" autocomplete="current-password">
                </div>
            </div>
            <div id="delAlert" style="margin:12px 0;display:none;"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
                <button class="btn btn-danger" type="button" id="delGo" onclick="deleteAccount()">Delete my account for good</button>
                <button class="btn btn-ghost" type="button" onclick="cancelDeleteAccount()">Cancel</button>
            </div>
        </div>
    </div>
</div>

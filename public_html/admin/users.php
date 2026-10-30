<?php // admin/users.php ?>
<div class="page-title-bar">
    <h2>Users</h2>
</div>
<div id="tabUsersContent">
    <section class="table-wrap">
        <div class="table-toolbar">
            <div class="table-toolbar-left">
                <div>
                    <strong>Users</strong>
                    <span id="userCountBadge" class="badge">0</span>
                </div>
                <span>Manage access &amp; roles</span>
            </div>
            <div class="table-toolbar-right">
                <input id="userSearch" type="text" class="input-chip" placeholder="Search email, name">
                <button class="btn btn-primary" type="button" onclick="startNewUser()">New User</button>
            </div>
        </div>
        <div class="table-scroll">
            <table id="usersTable">
                <thead>
                    <tr>
                        <th data-ucol="id">ID</th>
                        <th data-ucol="display_name">Name</th>
                        <th data-ucol="email">Email</th>
                        <th data-ucol="role">Role</th>
                        <th data-ucol="member">Linked Member</th>
                        <th data-ucol="last_login_at">Last Login</th>
                    </tr>
                </thead>
                <tbody data-sk="table" data-n="5"></tbody>
            </table>
        </div>
    </section>

    <section class="form-wrap" style="margin-top:12px;">
        <div class="form-header">
            <div class="form-header-text">
                <h3 id="userFormTitle">Add User</h3>
                <small id="userFormSubtitle"></small>
            </div>
        </div>
        <p class="form-note">Create login accounts for family or external users. Password is never shown once saved.</p>

        <form id="userForm" onsubmit="saveUser(event)">
            <input type="hidden" id="userId">

            <div class="form-section">
                <div class="section-title">Basic</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="userDisplayName">Display Name</label>
                        <input id="userDisplayName" required>
                    </div>
                    <div class="form-group">
                        <label for="userEmail">Email</label>
                        <input id="userEmail" type="email" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="userRole">Role</label>
                        <select id="userRole">
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="owner">Owner</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="userMemberId">Linked Member</label>
                        <select id="userMemberId">
                            <option value="">None</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="section-title">Permissions</div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Capabilities</label>
                        <div class="checkbox-group">
                            <input type="checkbox" id="permEditMembers">
                            <label for="permEditMembers" style="margin:0;">Can edit members</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="permViewStats">
                            <label for="permViewStats" style="margin:0;">Can view stats</label>
                        </div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="permManageMedia">
                            <label for="permManageMedia" style="margin:0;">Can manage media</label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="section-title">Password</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="userPassword">Password</label>
                        <input id="userPassword" type="password" autocomplete="new-password">
                        <small style="font-size:10px;color:var(--text-muted);" id="userPasswordHelp">
                            For new users this is required. For existing users, fill only to change password.
                        </small>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="btn btn-primary" type="submit">Save User</button>
                <button class="btn btn-ghost" type="button" onclick="startNewUser()">Clear</button>
                <button class="btn btn-danger" type="button" onclick="deleteUser()" id="deleteUserBtn" style="margin-left:auto;display:none;">Delete</button>
            </div>
        </form>
    </section>
</div>

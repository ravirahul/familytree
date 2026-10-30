-- FamilyTree schema (MySQL / MariaDB). Generated from the production structure, no data.
-- Apply once: mysql -u user -p dbname < schema.sql   (the installer does this for you)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `family_activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id',
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `changes` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_marriages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id',
  `member_id_1` int(11) NOT NULL COMMENT 'FK → family_tree_data.id (lower id of the pair)',
  `member_id_2` int(11) NOT NULL COMMENT 'FK → family_tree_data.id (higher id of the pair)',
  `marriage_date` date DEFAULT NULL COMMENT 'Wedding date (NULL if unknown)',
  `divorce_date` date DEFAULT NULL COMMENT 'Divorce/separation date (NULL if still together)',
  `is_current` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = current/active partnership',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Explicit marriage/partnership rows, replaces pids VARCHAR';

CREATE TABLE IF NOT EXISTS `family_media` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id',
  `url` varchar(255) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `uploaded_by_user_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_media_tags` (
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id (denormalised for fast per-tenant queries)',
  `media_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_tree_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id',
  `name` varchar(255) DEFAULT NULL,
  `nickname` varchar(255) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `birth_location` varchar(255) DEFAULT NULL,
  `gender` varchar(50) DEFAULT NULL,
  `img` varchar(255) DEFAULT NULL,
  `fid` int(11) DEFAULT NULL,
  `mid` int(11) DEFAULT NULL,
  `pids` text DEFAULT NULL,
  `current_location` varchar(255) DEFAULT NULL,
  `insta_url` varchar(255) DEFAULT NULL,
  `fb_url` varchar(255) DEFAULT NULL,
  `anniversary_date` date DEFAULT NULL,
  `death_date` date DEFAULT NULL,
  `death_location` varchar(255) DEFAULT NULL,
  `is_alive` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Alive, 0=Dead',
  `wiki` text DEFAULT NULL COMMENT 'Wiki/bio text (max 750 chars)',
  `wiki_preview` text GENERATED ALWAYS AS (case when octet_length(`wiki`) > 100 then concat(left(`wiki`,100),'...') else `wiki` end) STORED COMMENT 'Auto-generated preview (first 100 chars)',
  `is_private` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'P3.4: 1 = show as redacted placeholder on public tree',
  `privacy_override` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'P3.3: 1 = living person has consented; skip auto-protection',
  `extra` longtext DEFAULT NULL COMMENT 'JSON: newer details, see ft_extra()'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL COMMENT 'FK → tenants.id',
  `member_id` int(11) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `role` enum('owner','editor','viewer') DEFAULT 'viewer',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login_at` datetime DEFAULT NULL,
  `password_reset_token` char(64) DEFAULT NULL COMMENT 'Random hex token emailed for password reset. NULL = no active request',
  `password_reset_expires_at` datetime DEFAULT NULL COMMENT 'Token expires 1 hour after generation'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `privacy_settings` (
  `tenant_id` char(36) NOT NULL,
  `field_key` varchar(64) NOT NULL,
  `visibility` enum('public','members','private') NOT NULL DEFAULT 'members',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='P3.2 per-field visibility settings per tenant';

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `run_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- keys and indexes (from the production structure)
ALTER TABLE `family_activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_fal_tenant` (`tenant_id`);
ALTER TABLE `family_marriages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_marriage_pair` (`tenant_id`,`member_id_1`,`member_id_2`),
  ADD KEY `idx_mar_tenant` (`tenant_id`),
  ADD KEY `idx_mar_member1` (`tenant_id`,`member_id_1`),
  ADD KEY `idx_mar_member2` (`tenant_id`,`member_id_2`),
  ADD KEY `fk_mar_member1` (`member_id_1`),
  ADD KEY `fk_mar_member_2` (`member_id_2`);
ALTER TABLE `family_media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_uploaded_by` (`uploaded_by_user_id`),
  ADD KEY `idx_fm_tenant` (`tenant_id`);
ALTER TABLE `family_media_tags`
  ADD PRIMARY KEY (`media_id`,`member_id`),
  ADD KEY `fk_media_tags_member` (`member_id`),
  ADD KEY `idx_fmt_tenant` (`tenant_id`);
ALTER TABLE `family_tree_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fid` (`fid`),
  ADD KEY `idx_mid` (`mid`),
  ADD KEY `idx_is_alive` (`is_alive`),
  ADD KEY `idx_gender` (`gender`),
  ADD KEY `idx_birth_date` (`birth_date`),
  ADD KEY `idx_ftd_tenant` (`tenant_id`);
ALTER TABLE `family_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_family_users_member` (`member_id`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_last_login` (`last_login_at`),
  ADD KEY `idx_fu_tenant` (`tenant_id`),
  ADD KEY `idx_fu_tenant_email` (`tenant_id`,`email`),
  ADD KEY `idx_fu_reset_token` (`password_reset_token`);
ALTER TABLE `feature_flags`
  ADD PRIMARY KEY (`tenant_id`,`feature_key`);
ALTER TABLE `privacy_settings`
  ADD PRIMARY KEY (`tenant_id`,`field_key`);
ALTER TABLE `schema_migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_filename` (`filename`);
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_slug` (`slug`),
  ADD KEY `idx_owner` (`owner_user_id`);


-- who can open the tree, and as what
CREATE TABLE IF NOT EXISTS `tenant_users` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`   CHAR(36) NOT NULL COMMENT 'FK → tenants.id',
  `user_id`     INT(11) NOT NULL COMMENT 'FK → family_users.id',
  `role`        ENUM('owner','editor','viewer') NOT NULL DEFAULT 'viewer',
  `permissions` LONGTEXT DEFAULT NULL CHECK (json_valid(`permissions`)),
  `member_id`   INT(11) DEFAULT NULL COMMENT 'This user''s own member card in THIS tree',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_tu_user` (`user_id`),
  KEY `idx_tu_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Who can use the tree: owner, editors, viewers';

-- from features-migration.sql
-- Events / Map / Memories feature migration (2026-09-15)
-- Run once against the production DB.

-- 1. Media type: image | video | audio (existing rows default to image)
ALTER TABLE `family_media`
  ADD COLUMN IF NOT EXISTS `type` VARCHAR(10) NOT NULL DEFAULT 'image' AFTER `url`;

-- 2. Geocode cache shared by all tenants (place text -> lat/lng)
CREATE TABLE IF NOT EXISTS `geo_cache` (
  `place`       VARCHAR(255) NOT NULL,
  `lat`         DECIMAL(9,6) DEFAULT NULL,
  `lng`         DECIMAL(9,6) DEFAULT NULL,
  `resolved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`place`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2026-10-28: keys for the Claude connector (mcp.php); only a hash of each key is kept
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_key_hash` (`key_hash`),
  KEY `idx_api_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2026-10-29: every change to a person, so it can be undone; deleted people sit here as the bin
CREATE TABLE IF NOT EXISTS `member_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL,
  `batch` char(16) NOT NULL COMMENT 'one request or one undo-able action',
  `member_id` int(11) DEFAULT NULL,
  `action` varchar(12) NOT NULL COMMENT 'create | update | delete | import | restore',
  `before_json` longtext DEFAULT NULL,
  `after_json` longtext DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `undone` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_hist_tenant` (`tenant_id`, `created_at`),
  KEY `idx_hist_member` (`tenant_id`, `member_id`),
  KEY `idx_hist_batch` (`batch`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2026-10-29: weekly email of birthdays, anniversaries and remembrance days (on unless turned off)
ALTER TABLE `family_users` ADD COLUMN IF NOT EXISTS `digest` tinyint(1) NOT NULL DEFAULT 1;

-- 2026-10-31: events the family adds by hand (festivals, pujas, reunions, a wedding), shown beside birthdays
CREATE TABLE IF NOT EXISTS `family_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` char(36) NOT NULL,
  `title` varchar(120) NOT NULL,
  `kind` varchar(20) NOT NULL DEFAULT 'other' COMMENT 'celebration | remembrance | milestone | gathering | other',
  `event_date` varchar(10) NOT NULL COMMENT 'YYYY-MM-DD, or --MM-DD for a yearly date whose year is not known',
  `yearly` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = comes round every year',
  `people` text DEFAULT NULL COMMENT 'JSON array of member ids',
  `place` varchar(255) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_fe_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2026-10-27: per-tree settings (emblem, colours) and the tree's data home
ALTER TABLE `tenants` ADD COLUMN IF NOT EXISTS `settings` LONGTEXT NULL;
ALTER TABLE `tenants` ADD COLUMN IF NOT EXISTS `data_source` TEXT NULL;

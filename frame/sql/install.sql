-- FRAME v1.0 initial schema draft
CREATE TABLE IF NOT EXISTS frame_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  owner_identifier VARCHAR(128) NOT NULL,
  organizer_name VARCHAR(100) NOT NULL,
  organizer_type VARCHAR(32) NOT NULL DEFAULT 'individual',
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  category VARCHAR(64) NULL,
  cover_media_ref VARCHAR(512) NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'public',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  publish_at DATETIME NULL,
  starts_at DATETIME NULL,
  submissions_open_at DATETIME NULL,
  submissions_close_at DATETIME NULL,
  judging_starts_at DATETIME NULL,
  results_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_frame_events_status_time (status, starts_at, ends_at),
  INDEX idx_frame_events_owner (owner_identifier)
);

CREATE TABLE IF NOT EXISTS frame_event_rules (
  event_id BIGINT UNSIGNED PRIMARY KEY,
  participation_required BOOLEAN NOT NULL DEFAULT TRUE,
  submission_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  judging_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ranking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  voting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  awards_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_submissions SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  allow_submission_edit BOOLEAN NOT NULL DEFAULT FALSE,
  allow_submission_delete BOOLEAN NOT NULL DEFAULT TRUE,
  comment_mode VARCHAR(16) NOT NULL DEFAULT 'optional',
  approval_mode VARCHAR(24) NOT NULL DEFAULT 'auto',
  extra_rules JSON NULL,
  CONSTRAINT fk_rules_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_event_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_event_participant (event_id, player_identifier),
  CONSTRAINT fk_participant_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  submission_slot SMALLINT UNSIGNED NULL,
  caption TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submission_event (event_id, submitted_at),
  INDEX idx_submission_owner (player_identifier),
  UNIQUE KEY uq_submission_slot (event_id, player_identifier, submission_slot),
  CONSTRAINT fk_submission_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_submission_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'lbphone',
  media_ref VARCHAR(1024) NOT NULL,
  media_type VARCHAR(16) NOT NULL DEFAULT 'image',
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_media_submission FOREIGN KEY (submission_id) REFERENCES frame_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_organizers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_identifier VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  organizer_type VARCHAR(32) NOT NULL DEFAULT 'individual',
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frame_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_identifier VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  scope VARCHAR(64) NOT NULL DEFAULT 'global',
  granted_by VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permission (player_identifier, role, scope)
);

CREATE TABLE IF NOT EXISTS frame_awards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  prize_text TEXT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  sponsor_id BIGINT UNSIGNED NULL,
  CONSTRAINT fk_award_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  award_id BIGINT UNSIGNED NULL,
  submission_id BIGINT UNSIGNED NOT NULL,
  placement SMALLINT UNSIGNED NULL,
  comment TEXT NULL,
  published_at DATETIME NULL,
  UNIQUE KEY uq_result_award_submission (event_id, award_id, submission_id),
  UNIQUE KEY uq_result_award (event_id, award_id),
  CONSTRAINT fk_result_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_award FOREIGN KEY (award_id) REFERENCES frame_awards(id) ON DELETE SET NULL,
  CONSTRAINT fk_result_submission FOREIGN KEY (submission_id) REFERENCES frame_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_sponsors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  logo_media_ref VARCHAR(512) NULL,
  link_value VARCHAR(255) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_sponsor_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_promotions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  promotion_type VARCHAR(32) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  price_paid BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_promotion_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  player_identifier VARCHAR(128) NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  transaction_type VARCHAR(32) NOT NULL,
  amount BIGINT NOT NULL,
  status VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transaction_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS frame_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by VARCHAR(128) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frame_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_identifier VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NULL,
  event_id BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_event_time (event_id, created_at),
  INDEX idx_audit_actor_time (actor_identifier, created_at)
);

CREATE TABLE IF NOT EXISTS frame_event_access_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  rule_type VARCHAR(32) NOT NULL,
  rule_value VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_access_event (event_id),
  CONSTRAINT fk_access_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_event_favorites (
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, player_identifier),
  INDEX idx_favorite_player (player_identifier, created_at),
  CONSTRAINT fk_favorite_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_event_collaborators (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  display_name VARCHAR(100) NULL,
  phone_number VARCHAR(32) NULL,
  added_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_collaborator (event_id, player_identifier),
  INDEX idx_collaborator_player (player_identifier, created_at),
  CONSTRAINT fk_collaborator_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_event_invites (
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  invited_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, player_identifier),
  CONSTRAINT fk_invite_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_judges (
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  assigned_by VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, player_identifier),
  CONSTRAINT fk_judge_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_votes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  submission_id BIGINT UNSIGNED NOT NULL,
  voter_identifier VARCHAR(128) NOT NULL,
  score SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vote (event_id, submission_id, voter_identifier),
  UNIQUE KEY uq_vote_event_voter (event_id, voter_identifier),
  INDEX idx_votes_event_submission (event_id, submission_id),
  CONSTRAINT fk_vote_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_vote_submission FOREIGN KEY (submission_id) REFERENCES frame_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_notification_deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  player_identifier VARCHAR(128) NOT NULL,
  notification_type VARCHAR(48) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  phone_number VARCHAR(32) NULL,
  notification_id BIGINT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME NULL,
  UNIQUE KEY uq_frame_notification (event_id, player_identifier, notification_type),
  INDEX idx_frame_notification_status (status, attempted_at),
  CONSTRAINT fk_frame_notification_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frame_ad_products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  placement VARCHAR(32) NOT NULL,
  base_price BIGINT NOT NULL DEFAULT 0,
  duration_hours INT UNSIGNED NULL,
  requires_review BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frame_ads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  creator_identifier VARCHAR(128) NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  advertiser_name VARCHAR(120) NOT NULL,
  title VARCHAR(160) NULL,
  media_ref VARCHAR(1024) NOT NULL,
  link_type VARCHAR(24) NOT NULL DEFAULT 'event',
  link_value VARCHAR(512) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending_review',
  review_reason VARCHAR(500) NULL,
  reviewed_by VARCHAR(128) NULL,
  reviewed_at DATETIME NULL,
  price_snapshot BIGINT NOT NULL DEFAULT 0,
  transaction_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ads_status_window (status, starts_at, ends_at),
  INDEX idx_ads_creator (creator_identifier),
  CONSTRAINT fk_ad_event FOREIGN KEY (event_id) REFERENCES frame_events(id) ON DELETE SET NULL,
  CONSTRAINT fk_ad_product FOREIGN KEY (product_id) REFERENCES frame_ad_products(id),
  CONSTRAINT fk_ad_transaction FOREIGN KEY (transaction_id) REFERENCES frame_transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS frame_ad_daily_stats (
  ad_id BIGINT UNSIGNED NOT NULL,
  stat_date DATE NOT NULL,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, stat_date),
  CONSTRAINT fk_ad_stats_ad FOREIGN KEY (ad_id) REFERENCES frame_ads(id) ON DELETE CASCADE
);

ALTER TABLE frame_ads ADD COLUMN IF NOT EXISTS review_token VARCHAR(64) NULL AFTER reviewed_at;
INSERT INTO frame_ad_products(code,name,placement,base_price,duration_hours,requires_review,active) VALUES
 ('home_banner','Home Banner','home_banner',0,168,1,1),
 ('category_banner','Category Banner','category_banner',0,168,1,1),
 ('featured','Featured Event','featured',0,168,1,1),
 ('top_placement','Top Placement','top_placement',0,168,1,1)
ON DUPLICATE KEY UPDATE name=VALUES(name),placement=VALUES(placement),active=VALUES(active);

ALTER TABLE frame_awards ADD COLUMN IF NOT EXISTS sponsor_id BIGINT UNSIGNED NULL AFTER sort_order;

CREATE TABLE IF NOT EXISTS `weazel_photo_diary_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_identifier` VARCHAR(100) NOT NULL,
  `entry_date` DATE NOT NULL,
  `title` VARCHAR(60) NOT NULL DEFAULT '',
  `body` TEXT NOT NULL,
  `mood` VARCHAR(20) NOT NULL DEFAULT '',
  `photos` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_owner_date` (`owner_identifier`,`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `weazel_photo_diary_shares` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entry_id` BIGINT UNSIGNED NOT NULL,
  `owner_identifier` VARCHAR(100) NOT NULL,
  `recipient_phone` VARCHAR(32) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uniq_entry_recipient` (`entry_id`,`recipient_phone`), KEY `idx_recipient` (`recipient_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `weazel_photo_diary_entitlements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_identifier` VARCHAR(100) NOT NULL,
  `product_id` VARCHAR(32) NOT NULL,
  `slots` INT NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `purchased_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_owner_active` (`owner_identifier`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

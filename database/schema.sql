-- Family Expense & Debt Tracker: Phase 1 schema (MySQL 8+)
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS family_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE family_tracker;

-- 1. USERS ---------------------------------------------------------------
-- The app trims + lowercases the email before every query, AND
-- utf8mb4_unicode_ci makes UNIQUE(email) case-insensitive as a second guard.
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(254) NOT NULL,          -- 254 = max valid email length
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt output, never plain text
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2. SESSIONS (table layout used by express-mysql-session) ----------------
CREATE TABLE sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB;

-- 3. MONTHLY FINANCES (one budget row per user per month) -----------------
CREATE TABLE monthly_finances (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  month_start   DATE NOT NULL,                  -- always the 1st, e.g. 2026-10-01
  budget        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_month (user_id, month_start),
  CONSTRAINT fk_mf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. EXPENSES -------------------------------------------------------------
CREATE TABLE expenses (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  expense_date DATE NOT NULL,
  category     VARCHAR(50)  NOT NULL,
  description  VARCHAR(255) NULL,
  amount       DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_user_date (user_id, expense_date),
  CONSTRAINT fk_exp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. MONEY RECEIVED -------------------------------------------------------
CREATE TABLE money_received (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  received_date DATE NOT NULL,
  source        VARCHAR(100) NOT NULL,
  note          VARCHAR(255) NULL,
  amount        DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_received_user_date (user_id, received_date),
  CONSTRAINT fk_rec_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. DEBTS ----------------------------------------------------------------
CREATE TABLE debts (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  person_name VARCHAR(100) NOT NULL,
  direction   ENUM('I_OWE','OWED_TO_ME') NOT NULL,
  principal   DECIMAL(12,2) NOT NULL CHECK (principal > 0),
  debt_date   DATE NOT NULL,
  due_date    DATE NULL,
  note        VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_debt_owner (id, user_id),       -- target for the composite FK below
  KEY idx_debts_user (user_id),
  CONSTRAINT fk_debt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. DEBT REPAYMENTS ------------------------------------------------------
-- Composite FK (debt_id, user_id) -> debts(id, user_id):
-- MySQL itself rejects a repayment whose user_id differs from the debt owner.
CREATE TABLE debt_repayments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  debt_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  paid_on    DATE NOT NULL,
  amount     DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  note       VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rep_user (user_id),
  CONSTRAINT fk_rep_debt_owner FOREIGN KEY (debt_id, user_id)
    REFERENCES debts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

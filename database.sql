-- LifeLedger Database Migration
-- Run this against your Neon PostgreSQL database to create all required tables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_security (
  email TEXT PRIMARY KEY,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  temp_mfa_secret TEXT,
  mfa_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ll_profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ll_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ll_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES ll_posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ll_reactions (
  post_id UUID NOT NULL REFERENCES ll_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS ll_blocks (
  blocker_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS ll_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  moderation_note TEXT,
  moderator_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '250.00',
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ll_posts_author_id ON ll_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_ll_posts_status ON ll_posts(status);
CREATE INDEX IF NOT EXISTS idx_ll_posts_created_at ON ll_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ll_comments_post_id ON ll_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_ll_comments_author_id ON ll_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ll_reactions_user_id ON ll_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ll_blocks_blocked_user_id ON ll_blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_ll_reports_entity ON ll_reports(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ll_reports_created_at ON ll_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_owner_id ON ads(id);

CREATE OR REPLACE FUNCTION ll_get_feed()
RETURNS TABLE (
  id UUID,
  author_id TEXT,
  body TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.body,
    p.status,
    p.created_at,
    pr.username,
    pr.display_name,
    pr.avatar_url
  FROM ll_posts p
  LEFT JOIN ll_profiles pr ON pr.user_id = p.author_id
  WHERE p.status = 'approved'
  ORDER BY p.created_at DESC;
END;
$$;
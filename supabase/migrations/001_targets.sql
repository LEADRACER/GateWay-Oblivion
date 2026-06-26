-- GateWay:Oblivion — Phase 1: Target Management
-- Run this in your Supabase SQL Editor

-- ── Targets ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT,
  hostname TEXT,
  domain TEXT,
  cidr_range TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'compromised', 'pending')),
  tags TEXT[] DEFAULT '{}',
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_targets_status ON targets(status);
CREATE INDEX idx_targets_campaign ON targets(campaign_id);
CREATE INDEX idx_targets_tags ON targets USING GIN(tags);

-- ── Campaigns ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_by TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Scan Results (for future phases) ───────────────────────────────

CREATE TABLE IF NOT EXISTS port_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  scan_id UUID,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  state TEXT NOT NULL DEFAULT 'closed',
  service TEXT,
  version TEXT,
  banner TEXT
);

-- ── Row Level Security ─────────────────────────────────────────────

ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_results ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access on targets"
  ON targets FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on port_results"
  ON port_results FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- ── Auto-update updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER targets_updated_at
  BEFORE UPDATE ON targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

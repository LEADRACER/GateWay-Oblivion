// ── GateWay:Oblivion — Database Types ─────────────────────────────────

export type TargetStatus = 'active' | 'archived' | 'compromised' | 'pending';
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Profile {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'operator' | 'analyst';
  avatar_url?: string;
  created_at: string;
}

export interface Target {
  id: string;
  name: string;
  ip_address?: string;
  hostname?: string;
  domain?: string;
  cidr_range?: string;
  status: TargetStatus;
  tags: string[];
  campaign_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: string;
  target_id: string;
  name: string;
  type: 'nmap' | 'quick' | 'full' | 'service' | 'vuln';
  status: ScanStatus;
  config: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_by: string;
  created_at: string;
}

export interface PortResult {
  id: string;
  scan_id: string;
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service?: string;
  version?: string;
  banner?: string;
}

export interface Vulnerability {
  id: string;
  target_id: string;
  scan_id?: string;
  cve_id?: string;
  title: string;
  description: string;
  severity: Severity;
  cvss_score?: number;
  exploit_available: boolean;
  remediation?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  discovered_at: string;
  resolved_at?: string;
  created_by: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  targets: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  received_at: string;
  processed: boolean;
}

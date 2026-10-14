/** Shapes of the share-link portal API (backend/app/api/portal/quotes.py, leases.py). The client has no account; everything is keyed by the link token. */

export type PortalQuoteStatus = "sent" | "client_proposal" | "accepted" | "converted" | "rejected" | "cancelled" | "expired" | string;
export type PortalTurn = "client" | "landlord" | "none";
export type PortalChannel = "negotiation" | "chat" | string;
export type PortalAuthorType = "operator" | "client" | "system" | string;

export interface PortalSpace {
  name: string;
  area_m2: number;
  price_per_m2: number;
  monthly_net: number;
  parking: string[] | number | null;
  electrical_a: number | null;
}

export interface PortalTotals {
  area_m2: number;
  monthly_net: number;
  monthly_net_avg?: number;
  avg_price_per_m2: number;
  vat_taxable: boolean;
  vat_rate?: number;
  vat: number;
  monthly_gross: number;
  stepped?: boolean;
}

export interface PortalAttachment {
  number: number | string;
  title: string;
  url: string | null;
}

export interface PortalMessage {
  id: string;
  channel: PortalChannel;
  author_type: PortalAuthorType;
  author_name: string | null;
  body: string;
  meta: { version?: number; kind?: string } & Record<string, unknown>;
  created_at: string;
}

export interface PortalChange {
  key?: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface PortalVersion {
  number: number;
  created_at: string;
  note: string | null;
  changes: PortalChange[];
}

/** A chat bubble needs only these fields; quote messages carry more (channel, meta). */
export type PortalChatMessage = Pick<PortalMessage, "id" | "author_type" | "author_name" | "body" | "created_at"> & { meta?: PortalMessage["meta"] };

export interface PortalContact {
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url?: string | null;
}

export interface PortalQuote {
  id: string;
  number: string;
  status: PortalQuoteStatus;
  client_name: string;
  party_name: string;
  property_name: string;
  property_address: string | null;
  valid_until: string; // yyyy-mm-dd
  days_left: number;
  period_months: number;
  sent_version: number;
  totals: PortalTotals;
  spaces: PortalSpace[];
  special_terms: string[];
  attachments: PortalAttachment[];
  messages: PortalMessage[];
  versions: PortalVersion[];
  pdf_url: string | null;
  document_url: string;
  can_respond: boolean;
  can_extend: boolean;
  whose_turn: PortalTurn;
  step_title: string;
  step_text: string;
  contact: PortalContact;
  link_expires_at: string;
}

// ---------------------------------------------------------------- lease draft (backend/app/api/portal/leases.py)

export type PortalLeaseStatus = "draft" | "sent" | "negotiating" | "ready_to_sign" | "cancelled" | string;
export type LeaseSide = "client" | "operator";
export type LeaseThreadStatus = "open" | "awaiting_confirmation" | "resolved" | string;
export type LeaseResolution = "changed" | "special_term" | "explained" | "unchanged" | string;
export type LeaseMessageKind = "proposal" | "accept" | "decline" | "explain" | "ok" | string;

export interface PortalClause {
  id: string;
  number: string;
  heading: string | null;
  text: string;
  container: "main" | "general" | "annex:3" | string;
  level: number;
  locked: boolean;
  status: string | null;
  overrides_clause_id: string | null;
  overrides_label: string | null;
  fact_key: string | null;
}

export interface LeaseProposal {
  kind: "fact" | "wording" | "special_term" | string;
  by: LeaseSide;
  fact_key?: string;
  value?: unknown;
  text?: string;
  before?: string;
  special_clause_id?: string;
}

export interface LeaseWish {
  fact_key: string;
  value: unknown;
  label?: string;
}

export interface LeaseThreadMessage {
  id: string;
  author_type: PortalAuthorType;
  author_name: string | null;
  body: string;
  meta: { round_nr?: number | null; kind?: LeaseMessageKind; proposal?: LeaseProposal } & Record<string, unknown>;
  created_at: string;
}

export interface LeaseThread {
  id: string;
  clause_id: string;
  clause_number: string | null;
  clause_heading: string | null;
  opened_by: LeaseSide;
  status: LeaseThreadStatus;
  resolution: LeaseResolution | null;
  resolution_label: string | null;
  proposal: LeaseProposal | null;
  wish: LeaseWish | null;
  unsent: boolean;
  whose_turn: LeaseSide | null;
  created_at: string;
  messages: LeaseThreadMessage[];
}

export interface LeaseRound {
  nr: number;
  side: LeaseSide;
  body: string | null;
  version_no: number | null;
  created_at: string;
}

export interface LeaseChange extends PortalChange {
  kind: "added" | "wording" | "removed" | "fact" | string;
  clause_id?: string;
}

export interface LeaseVersion extends Omit<PortalVersion, "changes"> {
  changes: LeaseChange[];
}

export interface PortalLease {
  id: string;
  number: string;
  status: PortalLeaseStatus;
  client_name: string;
  party_name: string;
  landlord_name: string | null;
  property_name: string | null;
  space_names: string[];
  handover: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
  months: number;
  totals: Partial<PortalTotals> & Record<string, unknown>;
  deposit: number;
  sent_version: number;
  document_url: string;
  pdf_url: string | null;
  clauses: PortalClause[];
  threads: LeaseThread[];
  rounds: LeaseRound[];
  versions: LeaseVersion[];
  chat: PortalChatMessage[];
  turn: LeaseSide | null;
  can_comment: boolean;
  can_send: boolean;
  can_accept: boolean;
  pending_count: number;
  unsent_count: number;
  open_count: number;
  step_title: string;
  step_text: string;
  contact: PortalContact;
  link_expires_at: string;
  fact_keys: Record<string, string>;
}

/** GET /portal/{token} returns a quote or a lease draft — discriminated on `clauses`. */
export type PortalDocument = PortalQuote | PortalLease;

export function isPortalLease(d: PortalDocument): d is PortalLease {
  return Array.isArray((d as PortalLease).clauses);
}

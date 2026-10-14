/** Shapes of the share-link portal API (backend/app/api/portal/quotes.py). The client has no account; everything is keyed by the link token. */

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

export interface PortalContact {
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
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

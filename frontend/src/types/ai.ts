/** Operator AI chat (Phase 3.3) — shapes of /api/v1/agent/* (backend/app/api/operator/agent.py, app/agent/tools.py). */

export type AiContextType = "contract" | "quote" | "party" | "asset" | "portfolio";

export interface AiThread {
  id: string;
  title: string;
  context_type: AiContextType | null;
  context_id: string | null;
  context_label: string | null;
  origin_path: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface AiCitation { clause_id: string; number: string; contract_id: string }

export interface AiStep { tool: string; args?: Record<string, unknown> | null; summary: string; ok: boolean; auto?: boolean }

export interface LinksCard { type: "links"; title: string; items: { title: string; subtitle: string | null; link: string | null; entity_type: string }[] }
export interface TableCard { type: "table"; title: string; columns: string[]; rows: Record<string, unknown>[] }
export interface ConfirmCard {
  type: "confirm"; id: string; action: "create_quote" | "create_lease" | "create_party" | string; title: string; text?: string | null;
  args: Record<string, unknown>; requires_confirmation: boolean; confirmed_at?: string | null; result_link?: string | null;
}
export interface DraftCard {
  type: "draft"; id: string; kind: "special_term" | "commercial_text" | string; title: string;
  document: { contract_id?: string | null; clause_id?: string | null; overrides_label?: string | null; quote_id?: string | null }; text: string | null;
}
export interface ClarifyCard { type: "clarify"; id: string; title: string }
export type AiCard = LinksCard | TableCard | ConfirmCard | DraftCard | ClarifyCard;

export type AiMessageStatus = "done" | "failed" | "budget" | "streaming" | string;

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: AiStep[];
  cards: AiCard[];
  citations: AiCitation[];
  status: AiMessageStatus;
  model: string | null;
  created_at: string;
  /** client only: set while the answer streams */
  error?: string | null;
}

export interface AiThreadDetail extends AiThread { messages: AiMessage[] }

export interface AiThreadInput { context_type?: AiContextType | null; context_id?: string | null; context_label?: string | null; origin_path?: string | null; title?: string }

export interface AiConfirmResult { action: string; link: string; title: string }

export interface AiFeedbackInput { message_id?: string | null; card_id?: string | null; kind: string; fate: "used" | "edited" | "discarded"; draft_text?: string | null; final_text?: string | null }

export interface AiUsage { month: string; input_tokens: number; output_tokens: number; runs: number; total_tokens: number; budget: number; remaining: number; exhausted: boolean }

/** SSE frames of POST /threads/{id}/messages?stream=true */
export type AiStreamEvent =
  | { type: "step"; tool: string; args?: Record<string, unknown> | null; summary: string; ok: boolean; auto?: boolean }
  | { type: "delta"; text: string }
  | { type: "card"; card: AiCard }
  | { type: "done"; message_id?: string; status: AiMessageStatus; citations?: AiCitation[]; text?: string; error?: string | null };

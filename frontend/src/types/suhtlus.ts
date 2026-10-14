/** Suhtlus (operator communication timeline) — shapes of GET /messages/threads and the slice of GET /quotes/{id} the page uses. */

export type ThreadAuthorType = "operator" | "client" | "system" | string;

export interface Thread {
  subject_type: "quote" | "contract" | string;
  subject_id: string;
  number: string | null;
  title: string;
  party_name: string | null;
  status: string | null;
  link: string;
  last_body: string;
  last_author_type: ThreadAuthorType;
  last_author_name: string | null;
  last_at: string;
  unread: number;
  next_step?: ThreadNextStep | null;
}

export interface ThreadNextStep { side: "operator" | "client" | string; code: string; title: string; text: string; urgent?: boolean }

export type ThreadMessageKind = "sent" | "resent" | "reply" | "proposal" | "accept" | "reject" | string;

export interface ThreadMessage {
  id: string;
  channel: "negotiation" | "chat" | string;
  author_type: ThreadAuthorType;
  author_name: string | null;
  body: string;
  meta: { version?: number; kind?: ThreadMessageKind } & Record<string, unknown>;
  created_at: string;
}

/** The subset of QuoteDetailOut the conversation pane reads (structurally compatible with QuoteDetail in types/api). */
export interface ThreadQuote {
  id: string;
  number: string;
  status: string;
  party: { id?: string; name: string };
  property: { id?: string; name: string };
  space_names: string[];
  next_step: ThreadNextStep | null;
  messages: ThreadMessage[];
  link: { url: string } | null;
  unread?: number;
}

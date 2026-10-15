/** API contract types (backend /api/v1). Shapes may gain fields but not lose these. */
export type UUID = string;
export type ISODate = string;

export type Role = "admin" | "operator" | "viewer" | string;

export interface AccountRef { id: UUID; name: string; role: Role }
export interface Me { user_id: UUID; email: string; name: string; locale: string; account: AccountRef; accounts: AccountRef[] }
export interface Member { id: UUID; user_id: UUID; email: string; name: string; role: Role; status: "active" | "invited"; notification_prefs: Record<string, unknown> }

export interface Notification { id: UUID; kind: string; title: string; body: string | null; link: string | null; created_at: ISODate; read_at: ISODate | null; email_status: string | null }

export interface NotifyDays { end: number; indexation: number; probation: number; salary_review: number; quote_expiry: number }
export interface QuoteDefaults { validity_days: number; period_months: number; deposit_months: number; silence_days: number; contract_link_days: number }
export interface AiSettings { monthly_token_budget: number }
export interface Account { id: UUID; name: string; settings: { notify_days: NotifyDays; quote: QuoteDefaults; ai?: AiSettings } & Record<string, unknown> }
/** GET /agent/usage — this month's token spend against the account budget (the settings card). */
export interface AgentUsage { month: string; input_tokens?: number; output_tokens?: number; runs: number; total_tokens: number; budget: number; remaining: number; exhausted: boolean }

export interface Company { id: UUID; name: string; registry_code: string | null; vat_number: string | null; address: string | null; email: string | null; phone: string | null; accent_color: string | null; logo_attachment_id: UUID | null }
export type CompanyInput = Omit<Company, "id" | "logo_attachment_id">;

export interface AriregisterRepresentative { name: string; role: string; role_code: string | null; since: string | null }
export interface AriregisterHit { name: string; registry_code: string; address: string | null; vat_number: string | null; status: string | null; legal_form: string | null; email: string | null; phone: string | null; representatives: AriregisterRepresentative[] }
export interface EhrHit { ehr_code: string; address: string; use_type: string | null; footprint_m2: number | null; net_area_m2: number | null; floors: number | null; build_year: number | null; ehr_payload?: Record<string, unknown> | null }

export type PartyKind = "ee_company" | "foreign_company" | "person";
export const PARTY_ROLES = ["landlord", "tenant", "client", "supplier", "manager", "maintainer", "security", "insurer", "insured", "employer", "employee", "other"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export interface Party { id: UUID; kind: PartyKind; name: string; registry_code: string | null; personal_code: string | null; vat_number: string | null; address: string | null; contact_name: string | null; email: string | null; phone: string | null; roles: PartyRole[] }
export type PartyInput = Omit<Party, "id">;

export type AssetType = "property" | "space" | "parking_spot" | "department" | "position";
export type AssetStatus = "vaba" | "pakkumisel" | "üüritud" | "täidetud" | "osaliselt" | "täitmata" | "jagatud" | "mitteaktiivne";
export type SpacePartKey = "ladu" | "kontor" | "myygisaal" | "olmeala" | "yhisala";
export const SPACE_PART_KEYS: SpacePartKey[] = ["ladu", "kontor", "myygisaal", "olmeala", "yhisala"];
export interface PropertyAttributes { ehr_code?: string | null; address?: string | null; use_type?: string | null; footprint_m2?: number | null; net_area_m2?: number | null; floors?: number | null; build_year?: number | null; ehr_source?: string | null; ehr_payload?: Record<string, unknown> | null; vat_taxable?: boolean | null; utility_cost_winter?: number | null; utility_cost_summer?: number | null; template_id?: string | null; has_parking?: boolean | null }
/** A space has one area (rentable) plus an optional breakdown into parts that sums to it; electrical capacity is in amperes. */
export interface SpaceAttributes { type?: string | null; rentable_area_m2: number; parts?: Partial<Record<SpacePartKey, number>> | null; price_per_m2?: number | null; electrical_capacity_a?: number | null; parking_spots?: number | null; floor?: string | null; split_from?: string | null; split_into?: string[] | null; active?: boolean | null }
export interface Asset { id: UUID; type_code: AssetType; name: string; company_id: UUID | null; parent_id: UUID | null; attributes: Record<string, unknown>; capacity: number | null; status: AssetStatus | null; children_count?: number; occupancy?: { units: number; occupied: number; free: number } | null }
export interface AssetInput { type_code: AssetType; name: string; company_id?: UUID | null; parent_id?: UUID | null; attributes: Record<string, unknown>; capacity?: number | null }
export interface Allocation { id: UUID; kind: "exclusive" | "coverage" | string; contract?: { id: UUID; number: string | null; title: string; status?: string; party_name?: string | null } | null; asset?: { id: UUID; name: string; type_code: AssetType; parent_id?: UUID | null }; period_start?: ISODate | null; period_end?: ISODate | null; valid_from?: ISODate | null; valid_to?: ISODate | null }
export interface AssetChild extends Asset { attachments: Attachment[] }
export type SpotStatus = "vaba" | "üüritud" | "reserv" | "kasutusest väljas";
export type SpotType = "tavaline" | "elektriauto" | "ligipääsetav";
export interface ParkingSpot { id: UUID; number: string; zone: string | null; type: SpotType; reserve: boolean; out_of_service: boolean; status: SpotStatus | null; space_id: UUID | null; space_name: string | null; contract: { id: UUID; number: string; title: string; status: string } | null }
export interface AssetRef { id: UUID; name: string; type_code: AssetType; status?: AssetStatus | null; attributes?: Record<string, unknown> }
export interface AssetDetail extends Asset { children: AssetChild[]; attachments: Attachment[]; allocations: Allocation[]; parent?: AssetRef | null; parking_spots: ParkingSpot[]; split_parent?: AssetRef | null; split_units: AssetRef[]; former_units?: AssetRef[]; delete_block_reason?: string | null; split_block_reason?: string | null }

export interface SpaceImportRow { row: number; ok: boolean; errors: string[]; data: Record<string, unknown> }
export interface SpaceImportResult { rows: SpaceImportRow[]; created: number; updated: number; parking_created?: number }
export interface ParkingImportRow { row: number; ok: boolean; errors: string[]; numbers: string[]; zone: string | null; type: SpotType; reserve: boolean; space_name: string | null; space_id: UUID | null }
export interface ParkingImportResult { rows: ParkingImportRow[]; created: number; skipped: number; dry_run: boolean }
export interface PlanRow { filename: string; content_type: string; size: number; target: "space" | "property" | "overview" | "parking" | "skip"; space_id: UUID | null; space_name: string | null; note: string | null; attachment_id: UUID | null }
export interface SpotGeom { x: number; y: number; w: number; h: number; rot: number; lot?: string | null }
export interface PlanBackground { attachment_id: UUID; x: number; y: number; w: number; h: number; opacity?: number }
export interface ParkingPlanFrame { units?: "m"; width: number; height: number; background?: PlanBackground | null }
/** One schematic of the building (a garage floor, the yard…) — a tab in the editor. */
export interface ParkingLot extends ParkingPlanFrame { id: string; name: string }
export interface PlanSpot extends ParkingSpot { geom: SpotGeom | null }
export interface ParkingPlanDraftSpot { spot_id: UUID | null; number: string | null; label: string | null; type: SpotType | null; geom: SpotGeom }
export interface ParkingPlanDraft { status: "ready" | "failed"; created_at: string; lot?: ParkingLot | { id: string; name: string }; width?: number; height?: number; background?: PlanBackground; spots: ParkingPlanDraftSpot[]; matched?: number; notes?: string; error?: string; model?: string }
export interface PlanAttachment { id: UUID; filename: string; content_type: string }
export interface ParkingPlan { property_id: UUID; lots: ParkingLot[]; spots: PlanSpot[]; draft: ParkingPlanDraft | null; plan_attachments: PlanAttachment[] }
export interface ParkingPlanSave {
  lots?: ParkingLot[] | null;
  spots?: { id: UUID; geom: SpotGeom | null; space_id?: UUID | null; set_space?: boolean }[];
  new?: { number: string; zone?: string | null; type?: SpotType; geom: SpotGeom; space_id?: UUID | null }[];
  clear_draft?: boolean;
}
export interface SplitUnitInput { name: string; parts: Partial<Record<SpacePartKey, number>>; rentable_area_m2?: number; price_per_m2: number; parking_numbers: string[] }

export type AttachmentSubject = "asset" | "company" | "contract" | "template";
export type AttachmentRole = "floor_plan" | "site_plan" | "overview_plan" | "parking_plan" | "logo" | "generic" | "annex";
export interface Attachment { id: UUID; role: AttachmentRole | string; filename: string; content_type: string; size: number; created_at: ISODate }
export type { AssetDetail as SpaceDetail };

export type TemplateKind = "general_terms" | "special_terms_base" | "quote_base";
export interface Template { id: UUID; kind: TemplateKind; name: string; version: number; is_current: boolean; node_count: number; created_at: ISODate; company_id?: UUID | null }
export interface Clause { id: UUID; number: string; source_number?: string | null; heading: string | null; text: string; level: number; locked: boolean; provenance?: Record<string, unknown> | null }
export interface TemplateDetail extends Template { clauses?: Clause[]; body?: { text: string } }

export type ContractOrigin = "platform" | "imported";
export type ContractCategory = "lease" | "maintenance" | "management" | "insurance" | "security" | "other" | string;
export interface ContractSummary { id: UUID; number: string | null; title: string; status: string; origin: ContractOrigin; type_code: string; category: ContractCategory | null; party: { id: UUID; name: string } | null; company_id: UUID | null; start_date: ISODate | null; end_date: ISODate | null; signed_at: ISODate | null; current_values: Record<string, unknown>; key_dates_next?: { kind_code: string; due_date: ISODate } | null }
export interface ContractFact { id?: UUID; key: string; label?: string | null; value: string | number | null; unit?: string | null; text?: string | null; valid_from: ISODate | null; valid_to?: ISODate | null; reason: string | null; provenance?: Record<string, unknown> | null }
export interface KeyDate { id: UUID; kind_code: string; title: string; due_date: ISODate; notify_days_before: number | null; fired_at: ISODate | null; provenance?: Record<string, unknown> | null; contract: { id: UUID; number: string | null; title: string; type_code: string; party_name: string | null } | null }
export interface KeyDateKind { code: string; name_et: string; default_notify_days: number }
export interface SourceDocument { id: UUID; filename: string; content_type: string; role: string; format?: string | null; page_count?: number | null; url?: string | null; container_signatures?: ContainerSignature[] | null }
export interface ContainerSignature { signer?: string | null; name?: string | null; personal_code?: string | null; signed_at?: ISODate | null; time?: ISODate | null; valid?: boolean | null }
export interface ContractParty { id: UUID; party: { id: UUID; name: string; registry_code: string | null }; role: string; is_primary: boolean; valid_from: ISODate | null; valid_to: ISODate | null; source: string }
export interface SourceView { id: UUID; filename: string; format: string; page_count: number | null; pdf_url: string | null; text_pages: { page: number; text: string }[] | null }
export interface ContractDetail extends ContractSummary { notes?: string | null; facts: ContractFact[]; key_dates: KeyDate[]; allocations: Allocation[]; source_documents: SourceDocument[]; clauses: Clause[]; attachments: Attachment[]; parties: ContractParty[] }
/** A party's contracts (GET /parties/{id}/contracts): the summary fields plus the party's role in that contract. */
export interface PartyContractRow { id: UUID; number: string | null; title: string; status: string; type_code: string; category: ContractCategory | null; start_date: ISODate | null; end_date: ISODate | null; role: string | null }

export type ImportStatus = "uploaded" | "extracting" | "structuring" | "review" | "committed" | "failed" | "manual";
export interface ImportSourceDocument { id: UUID; filename: string; format: "pdf" | "docx" | "asice"; page_count: number | null; has_text_layer: boolean | null; container_signatures: ContainerSignature[] | null }
export interface ProposalContract { title: string; category: ContractCategory; number?: string | null; signed_at?: ISODate | null; start_date?: ISODate | null; end_date?: ISODate | null; counterparty_name: string; our_company_name?: string | null; summary: string }
export interface ProposalParty { name: string; role: string; registry_code?: string | null; address?: string | null; confidence: number }
export interface ProposalParameter { key: string; label: string; value: string | number | null; unit?: string | null; text: string; confidence: number; page?: number | null; char_start?: number | null; char_end?: number | null; source_number?: string | null }
export interface ProposalKeyDate { kind: string; date: ISODate; title: string; confidence: number; page?: number | null; char_start?: number | null; char_end?: number | null }
export interface ProposalClause { number: string; level: number; heading?: string | null; text: string; page?: number | null; char_start?: number | null; char_end?: number | null }
export interface Proposal { contract: ProposalContract; parties: ProposalParty[]; parameters: ProposalParameter[]; key_dates: ProposalKeyDate[]; clauses: ProposalClause[]; asset_hint?: { name?: string | null; address?: string | null; area_m2?: number | null } | null }
export interface ImportJob { id: UUID; status: ImportStatus; error: string | null; source_document: ImportSourceDocument | null; proposal: Proposal | null; reviewed: Proposal | null; duplicate_of_contract_id: UUID | null; committed_contract_id: UUID | null; created_at: ISODate }
export interface ImportJobDetail extends ImportJob { source_url?: string | null; text_pages?: { page: number; text: string }[] | null }
export interface ImportCommitParty { index: number | null; party_id: string | null; role: string; is_primary: boolean; include: boolean }
export interface ImportCommitInput { company_id?: UUID | null; asset_id?: UUID | null; asset_ids?: UUID[] | null; allocation_kind?: "exclusive" | "coverage" | null; parties?: ImportCommitParty[]; category: ContractCategory; checked?: string[]; parking_numbers?: string[] | null }

export interface SearchHit { entity_type: string; entity_id: UUID; title: string; subtitle: string | null; link: string | null }
export interface AuditEvent { id: UUID | number; ts?: ISODate; action?: string; entity_type?: string; entity_id?: UUID | null; entity_label?: string | null; entity_link?: string | null; event_type?: string; kind?: string; actor_type?: string; actor_name?: string | null; actor?: string | null; on_behalf_of?: UUID | null; reason?: string | null; correlation_id?: string | null; occurred_at?: ISODate; created_at?: ISODate; payload?: Record<string, unknown> | null }
export interface AuditStats { actor_type: Record<string, number>; entity_type: Record<string, number> }

export interface HealthFinding { code: string; severity: "info" | "warning" | "error"; title: string; count: number; items: { contract_id: UUID; number: string | null; title: string; detail: string | null }[] }
export interface PortfolioHealth { generated_at: ISODate; totals: { contracts: number; active: number; imported: number; platform: number }; findings: HealthFinding[] }
export interface PortfolioSummary { contracts_by_status: Record<string, number>; assets: { properties: number; spaces: number; occupied: number; free: number }; key_dates_next_30: number; open_imports: number; companies: number }
/** GET /portfolio/attention — the rule-based ONE-next-step queue (Avaleht „Fookus”); green/automatic rows are counted, not listed. */
export type AttentionKind = "quote" | "contract" | "import" | "key_date" | string;
export type AttentionTone = "red" | "amber" | "green" | string;
export interface AttentionRow { kind: AttentionKind; tone: AttentionTone; title: string; text: string; link: string; due: ISODate | null; step: string | null }
export interface AttentionOut { rows: AttentionRow[]; automatic: number }

// ---- quotes (Phase 3) ----
export type QuoteStatus = "draft" | "sent" | "client_proposal" | "accepted" | "converted" | "rejected" | "expired" | "cancelled";
export type QuoteNextStepCode = "send" | "bounced" | "remind" | "waiting" | "answer" | "convert";
export interface QuoteRef { id: UUID; name: string }
export interface QuotePartyRef extends QuoteRef { registry_code: string | null; email: string | null }
export interface QuoteContact { name: string; email: string; phone: string }
export interface QuoteFeature { label: string; value: string }
export interface QuoteSpot { id: UUID; number: string | null; zone: string | null; type: string | null; space_id: string | null; out_of_service: boolean; reserve: boolean }
export interface QuoteParking { mode: "register" | "count" | string; spots: QuoteSpot[]; count: number | null }
export interface QuoteLine { area_m2: number; price_per_m2: number; avg_price_per_m2: number; monthly_net: number; monthly_net_avg: number; stepped: boolean }
export interface QuoteScheduleStep { until_month: number | null; price: number }
export interface QuoteSpace {
  id: UUID; space_id: UUID; name: string; type: string | null; area_m2: number; parts: string | null; list_price: number | null; price_per_m2: number; price_override: number | null;
  schedule: QuoteScheduleStep[] | null; parking: QuoteParking; electrical_a: number | null; electrical_override: number | null; electrical_space: number | null;
  floor_plan: { id: UUID; filename: string } | null; line: QuoteLine;
}
export interface QuoteTerm { id: UUID; text: string; overrides: string | null; overrides_label: string | null; auto_kind: string | null; space_id: UUID | null }
export interface QuoteAttachmentItem { number: number; title: string; attachment_id: UUID; kind: "floor_plan" | "parking_plan" | "site_plan" | "overview_plan" | "upload" | string; space_id: UUID | null; url: string | null }
export interface QuoteChange { key: string; label: string; before: unknown; after: unknown }
export interface QuoteVersion { id: UUID; number: number; created_at: ISODate; note: string | null; pdf_url: string | null; changes: QuoteChange[] }
export interface QuoteMessage { id: UUID; channel: "negotiation" | "chat" | string; author_type: "operator" | "client" | string; author_name: string | null; body: string; meta: { version?: number; kind?: string } & Record<string, unknown>; created_at: ISODate }
export interface QuoteLetter { id: UUID; kind: string; title: string; to: string | null; status: string; error: string | null; created_at: ISODate }
export interface QuoteNextStep { side: "operator" | "client" | string; code: QuoteNextStepCode | string; title: string; text: string; urgent: boolean }
export interface QuoteLink { email: string; expires_at: ISODate; opened_at: ISODate | null; url: string }
export interface QuoteTotals { area_m2: number; monthly_net: number; monthly_net_avg: number; avg_price_per_m2: number; vat_taxable: boolean; vat_rate: number; vat: number; monthly_gross: number; utility_winter: number | null; utility_summer: number | null; stepped: boolean }
export interface QuoteSummary {
  id: UUID; number: string; status: QuoteStatus | string; party: QuotePartyRef; property: QuoteRef; company_id: UUID | null; valid_until: ISODate; period_months: number;
  totals: Partial<QuoteTotals>; version: number; sent_version: number; sent_at: ISODate | null; accepted_at: ISODate | null; created_at: ISODate; space_names: string[]; next_step: QuoteNextStep | null; unread: number;
}
export interface QuoteReminder { reason: "expiring" | "silence" | string; days_left: number; silence_days: number; text: string }
export interface QuoteDelivery { notification_id: UUID; kind: string; status: string; error: string | null; to: string | null; at: ISODate }
export interface QuotePropertyAttributes { address?: string | null; vat_taxable?: boolean | null; utility_cost_winter?: number | null; utility_cost_summer?: number | null; utility_source?: string | null; has_parking?: boolean | null }
export interface QuoteDetail extends QuoteSummary {
  contact: QuoteContact; commercial_text: string; features: QuoteFeature[]; spaces: QuoteSpace[]; special_terms: QuoteTerm[]; attachments: QuoteAttachmentItem[]; versions: QuoteVersion[];
  messages: QuoteMessage[]; letters: QuoteLetter[]; link: QuoteLink | null; pending_changes: QuoteChange[]; reminder: QuoteReminder | null; delivery: QuoteDelivery | null; editable: boolean;
  has_register: boolean; register_spots: QuoteSpot[]; conversion: Record<string, unknown> | null; close_reason: string | null; property_attributes: QuotePropertyAttributes; pdf_available: boolean;
}
export interface QuoteCreateInput { party_id: UUID; property_id: UUID; space_ids: UUID[]; company_id?: UUID | null; period_months?: number | null; validity_days?: number | null }
export interface QuotePatchInput { expected_version?: number | null; period_months?: number | null; valid_until?: ISODate | null; contact?: QuoteContact | null; commercial_text?: string | null; features?: QuoteFeature[] | null; company_id?: UUID | null }
export interface QuoteSpacePatchInput { expected_version?: number | null; price_per_m2?: number | null; clear_price?: boolean; schedule?: QuoteScheduleStep[] | null; clear_schedule?: boolean; parking_spot_ids?: UUID[] | null; parking_count?: number | null; clear_parking_count?: boolean; electrical_a?: number | null; clear_electrical?: boolean }

// ---- leases (Phase 3.2) ----
export type LeaseStatus = "draft" | "sent" | "negotiating" | "ready_to_sign" | "cancelled" | string;
export type LeaseSide = "operator" | "client" | string;
export type LeaseClauseContainer = "main" | "general" | "annex:3" | string;
export type LeaseFactKey = "rent" | "parking" | "handover" | "purpose" | "deposit_months" | "months" | "term_notes" | "indexation" | "representatives.landlord" | "representatives.tenant" | string;
export interface LeaseClause {
  id: UUID; number: string; heading: string | null; text: string; level: number; locked: boolean; category: string; container: LeaseClauseContainer; parent_id: UUID | null;
  fact_key: LeaseFactKey | null; status: "drafting" | "proposed" | "accepted" | string | null; origin_note: string | null; overrides_clause_id: UUID | null; overrides_label: string | null;
  changed: boolean; provenance: ({ check?: boolean; unlocked?: boolean } & Record<string, unknown>) | null; original_text?: string | null;
}
export interface LeaseAnnex { number: number; title: string; attachment_id: UUID | null; kind: "floor_plan" | "parking_plan" | "special_terms" | "upload" | string; space_id: UUID | null; missing: boolean }
export interface LeaseScheduleStep { until_month: number | null; price: number }
export interface LeaseDealSpace { space_id: UUID; name: string; type: string | null; area_m2: number; price_per_m2: number; schedule: LeaseScheduleStep[] | null; parking_numbers: string[]; parking_count: number; electrical_a: number | null; line: QuoteLine }
export interface LeaseIndexation { method?: "fixed_pct" | "stat_cpi" | string | null; rate?: number | null; frequency_months?: number | null; next_date?: ISODate | null }
export interface LeaseRepresentative { role: string; name: string; phone: string; email: string }
export interface LeaseRepresentatives { landlord: LeaseRepresentative[]; tenant: LeaseRepresentative[] }
export type LeaseVertical = "lease" | "employment" | string;
/** deal.employment of a Tööleping draft (vertical "employment"): the position quota + TLS main terms; `end`/`months` are null = tähtajatu. */
export interface LeaseEmployment {
  position: { id: UUID; name: string }; department: { id: UUID; name: string } | null; salary: number; probation_months: number; probation_end: ISODate | null; salary_review: ISODate | null;
  working_time: string; vacation_days: number; place: string | null; pay_day: number;
}
export interface LeaseDeal {
  vertical?: LeaseVertical; handover: ISODate; end: ISODate | null; months: number | null; deposit: number; deposit_months: number; purpose: string; term_notes: string; indexation: LeaseIndexation; representatives: LeaseRepresentatives;
  totals: QuoteTotals; spaces: LeaseDealSpace[]; property: { id: UUID; name: string; attributes: { address?: string | null; vat_taxable?: boolean | null; has_parking?: boolean | null } } | null;
  employment?: LeaseEmployment | null;
}
export interface EmploymentCreateInput { party_id: UUID; position_id: UUID; salary: number; start: ISODate; months?: number | null; probation_months?: number; working_time?: string | null; place?: string | null; salary_review?: ISODate | null; vacation_days?: number; pay_day?: number; company_id?: UUID | null }
export interface EmploymentTermsPatch { expected_version?: number | null; start?: ISODate | null; months?: number | null; salary?: number | null; probation_months?: number | null; working_time?: string | null; place?: string | null; salary_review?: ISODate | null; vacation_days?: number | null; pay_day?: number | null; term_notes?: string | null; reason?: string | null }
export interface LeaseSpaceTerms { space_id: UUID; price_per_m2?: number | null; schedule?: LeaseScheduleStep[] | null; parking_spot_ids?: UUID[] | null; parking_count?: number | null; electrical_a?: number | null }
export interface LeaseTerms { handover?: ISODate; months?: number; spaces?: LeaseSpaceTerms[]; deposit_months?: number | null; purpose?: string | null; term_notes?: string | null; indexation?: LeaseIndexation | null; representatives?: LeaseRepresentatives | null }
export interface LeaseRound { nr: number; side: LeaseSide }
export interface LeaseDraft {
  id: UUID; number: string; title: string; status: LeaseStatus; version: number; sent_version: number; quote_id: UUID | null; party: { id: UUID; name: string; registry_code: string | null } | null;
  company_id: UUID | null; contact: QuoteContact; terms: LeaseTerms; deal: LeaseDeal; clauses: LeaseClause[]; annexes: LeaseAnnex[]; editable: boolean; round: LeaseRound | null;
  sent_at: ISODate | null; accepted_at: ISODate | null; link: string;
}
export interface LeaseCreateInput { party_id: UUID; property_id: UUID; spaces: LeaseSpaceTerms[]; company_id?: UUID | null; months?: number; handover?: ISODate | null; deposit_months?: number | null; purpose?: string | null }
export interface LeaseConvertInput { mode: "separate" | "shared"; handover?: ISODate | null }
export interface LeaseTermsPatch { expected_version?: number | null; handover?: ISODate | null; months?: number | null; deposit_months?: number | null; purpose?: string | null; term_notes?: string | null; indexation?: LeaseIndexation | null; representatives?: LeaseRepresentatives | null; spaces?: LeaseSpaceTerms[] | null; reason?: string | null }
export interface LeaseClausePatch { text: string; reason?: string | null; allow_locked?: boolean }
export interface LeaseSpecialInput { text: string; overrides?: string | null; overrides_label?: string | null; status?: "drafting" | "accepted" }
export type LeaseThreadStatus = "open" | "awaiting_confirmation" | "resolved" | string;
export type LeaseResolution = "changed" | "special_term" | "explained" | "unchanged" | string;
export interface LeaseProposal { kind: "fact" | "wording" | "special_term" | string; by: LeaseSide; fact_key?: string; value?: unknown; text?: string; before?: string; special_clause_id?: UUID }
export interface LeaseThreadMessage { id: UUID; author_type: LeaseSide | "system" | string; author_name: string | null; body: string; meta: { round_nr?: number | null; kind?: "proposal" | "accept" | "decline" | "explain" | "ok" | string; proposal?: LeaseProposal } & Record<string, unknown>; created_at: ISODate }
export interface LeaseThread {
  id: UUID; clause_id: UUID; clause_number: string | null; clause_heading: string | null; opened_by: LeaseSide; status: LeaseThreadStatus; resolution: LeaseResolution | null; resolution_label: string | null;
  proposal: LeaseProposal | null; wish: ({ fact_key?: string; label?: string; value?: unknown } & Record<string, unknown>) | null; round_nr: number | null; unsent: boolean; whose_turn: LeaseSide | null;
  created_at: ISODate; resolved_at: ISODate | null; messages: LeaseThreadMessage[];
}
export interface LeaseRoundOut { nr: number; side: LeaseSide; body: string | null; version_no: number | null; thread_ids: string[]; created_at: ISODate }
export interface LeaseChange { key: string; label: string; kind: "added" | "wording" | "removed" | "fact" | string; before: unknown; after: unknown; clause_id?: UUID }
export interface LeaseVersion { number: number; created_at: ISODate; note: string | null; pdf_url: string | null; changes: LeaseChange[] }
export type LeaseNextStepCode = "send" | "answer" | "waiting" | "sign";
export interface LeaseNextStep { side: LeaseSide; code: LeaseNextStepCode | string; title: string; text: string; urgent: boolean }
export interface LeaseNegotiation {
  threads: LeaseThread[]; rounds: LeaseRoundOut[]; versions: LeaseVersion[]; changes_since_v1: LeaseChange[]; link: QuoteLink | null; letters: QuoteLetter[];
  next_step: LeaseNextStep | null; turn: LeaseSide | null; can_send: boolean; pending_count: number; unsent_count: number;
}
export type LeaseThreadAction = "explain" | "answer" | "propose" | "decide" | "unchanged";
export interface LeaseProposeInput { kind: "fact" | "wording" | "special_term"; text?: string | null; fact_key?: string | null; value?: unknown; wording?: string | null; special_text?: string | null; overrides_label?: string | null }
export interface LeaseDecideInput { accept: boolean; text?: string | null }
export interface LeaseChatMessage { id: UUID; author_type: LeaseSide | "system" | string; author_name: string | null; body: string; created_at: ISODate; channel: string; meta: Record<string, unknown> }

// ---- risk (Phase 3.3) ----
/** Riskiraport — advisory only, never blocking. Paid sources we have no access to are listed under `sources.unavailable` („liidestamata”). */
export type RiskLevel = "KÕRGE" | "KESKMINE" | "MADAL";
export type RiskStatus = "queued" | "ready" | "failed" | string;
export interface RiskSignal { source: string; level: RiskLevel | string; text: string }
export interface RiskDebt { amount?: number | null; disputed?: number | null; scheduled?: number | null; schedule_end?: string | null; oldest?: string | null }
export interface RiskQuarter { year: number; q: number; turnover: number | null; taxes?: number | null; labour?: number | null; employees?: number | null }
export interface RiskSources {
  registry_code?: string | null; name?: string | null; status?: string | null; registered_on?: string | null; legal_form?: string | null; debt?: RiskDebt | null;
  quarters?: RiskQuarter[]; activity?: string | null; unavailable?: string[]; as_of?: { debt?: string | null; quarters?: string | null };
}
export interface RiskReport {
  id: UUID; party_id: UUID; status: RiskStatus; score: RiskLevel | null; points: number; signals: RiskSignal[]; sources: RiskSources;
  summary: string | null; error: string | null; created_at: ISODate; generated_at: ISODate | null;
}

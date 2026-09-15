/** API contract types (backend /api/v1). Shapes may gain fields but not lose these. */
export type UUID = string;
export type ISODate = string;

export type Role = "admin" | "operator" | "viewer" | string;

export interface AccountRef { id: UUID; name: string; role: Role }
export interface Me { user_id: UUID; email: string; name: string; locale: string; account: AccountRef; accounts: AccountRef[] }
export interface Member { id: UUID; user_id: UUID; email: string; name: string; role: Role; status: "active" | "invited"; notification_prefs: Record<string, unknown> }

export interface Notification { id: UUID; kind: string; title: string; body: string | null; link: string | null; created_at: ISODate; read_at: ISODate | null; email_status: string | null }

export interface NotifyDays { end: number; indexation: number; probation: number; salary_review: number; quote_expiry: number }
export interface Account { id: UUID; name: string; settings: { notify_days: NotifyDays } & Record<string, unknown> }

export interface Company { id: UUID; name: string; registry_code: string | null; vat_number: string | null; address: string | null; email: string | null; phone: string | null; accent_color: string | null; logo_attachment_id: UUID | null }
export type CompanyInput = Omit<Company, "id" | "logo_attachment_id">;

export interface AriregisterHit { name: string; registry_code: string; address: string | null; vat_number: string | null; status: string | null }
export interface EhrHit { ehr_code: string; address: string; use_type: string | null; footprint_m2: number | null; net_area_m2: number | null; floors: number | null; build_year: number | null }

export type PartyKind = "ee_company" | "foreign_company" | "person";
export interface Party { id: UUID; kind: PartyKind; name: string; registry_code: string | null; personal_code: string | null; vat_number: string | null; address: string | null; contact_name: string | null; email: string | null; phone: string | null; roles: string[] }
export type PartyInput = Omit<Party, "id">;

export type AssetType = "property" | "space" | "department" | "position";
export type AssetStatus = "vaba" | "üüritud" | "täidetud" | "osaliselt" | "täitmata";
export interface PropertyAttributes { ehr_code?: string | null; address?: string | null; use_type?: string | null; footprint_m2?: number | null; net_area_m2?: number | null; floors?: number | null; build_year?: number | null; vat_taxable?: boolean | null; utility_cost_winter?: number | null; utility_cost_summer?: number | null }
export interface SpaceAttributes { type?: string | null; net_area_m2?: number | null; rentable_area_m2: number; coefficient?: number | null; price_per_m2?: number | null; electrical_capacity_kw?: number | null; parking_spots?: number | null }
export interface Asset { id: UUID; type_code: AssetType; name: string; company_id: UUID | null; parent_id: UUID | null; attributes: Record<string, unknown>; capacity: number | null; status: AssetStatus | null; children_count?: number }
export interface AssetInput { type_code: AssetType; name: string; company_id?: UUID | null; parent_id?: UUID | null; attributes: Record<string, unknown>; capacity?: number | null }
export interface Allocation { id: UUID; kind: "exclusive" | "coverage" | string; contract?: { id: UUID; number: string | null; title: string; party_name?: string | null } | null; asset?: { id: UUID; name: string; type_code: AssetType }; valid_from?: ISODate | null; valid_to?: ISODate | null }
export interface AssetDetail extends Asset { children: Asset[]; attachments: Attachment[]; allocations: Allocation[] }

export interface SpaceImportRow { row: number; ok: boolean; errors: string[]; data: Record<string, unknown> }
export interface SpaceImportResult { rows: SpaceImportRow[]; created: number; updated: number }

export type AttachmentSubject = "asset" | "company" | "contract" | "template";
export type AttachmentRole = "floor_plan" | "site_plan" | "parking_plan" | "logo" | "generic" | "annex";
export interface Attachment { id: UUID; role: AttachmentRole | string; filename: string; content_type: string; size: number; created_at: ISODate }

export type TemplateKind = "general_terms" | "special_terms_base" | "quote_base";
export interface Template { id: UUID; kind: TemplateKind; name: string; version: number; is_current: boolean; node_count: number; created_at: ISODate; company_id?: UUID | null }
export interface Clause { id: UUID; number: string; source_number?: string | null; heading: string | null; text: string; level: number; locked: boolean; provenance?: Record<string, unknown> | null }
export interface TemplateDetail extends Template { clauses?: Clause[]; body?: { text: string } }

export type ContractOrigin = "platform" | "imported";
export type ContractCategory = "lease" | "maintenance" | "management" | "insurance" | "security" | "other" | string;
export interface ContractSummary { id: UUID; number: string | null; title: string; status: string; origin: ContractOrigin; type_code: string; category: ContractCategory | null; party: { id: UUID; name: string } | null; company_id: UUID | null; start_date: ISODate | null; end_date: ISODate | null; signed_at: ISODate | null; current_values: Record<string, unknown>; key_dates_next?: { kind_code: string; due_date: ISODate } | null }
export interface ContractFact { key: string; label?: string | null; value: string | number | null; unit?: string | null; text?: string | null; valid_from: ISODate | null; reason: string | null; provenance?: Record<string, unknown> | null }
export interface KeyDate { id: UUID; kind_code: string; title: string; due_date: ISODate; notify_days_before: number | null; fired_at: ISODate | null; contract: { id: UUID; number: string | null; title: string; type_code: string; party_name: string | null } | null }
export interface KeyDateKind { code: string; name_et: string; default_notify_days: number }
export interface SourceDocument { id: UUID; filename: string; content_type: string; role: string; url?: string | null; container_signatures?: ContainerSignature[] | null }
export interface ContainerSignature { signer?: string | null; name?: string | null; personal_code?: string | null; signed_at?: ISODate | null; time?: ISODate | null; valid?: boolean | null }
export interface ContractDetail extends ContractSummary { notes?: string | null; facts: ContractFact[]; key_dates: KeyDate[]; allocations: Allocation[]; source_documents: SourceDocument[]; clauses: Clause[]; attachments: Attachment[] }

export type ImportStatus = "uploaded" | "extracting" | "structuring" | "review" | "committed" | "failed" | "manual";
export interface ImportSourceDocument { id: UUID; filename: string; format: "pdf" | "docx" | "asice"; page_count: number | null; has_text_layer: boolean | null; container_signatures: ContainerSignature[] | null }
export interface ProposalContract { title: string; category: ContractCategory; number?: string | null; signed_at?: ISODate | null; start_date?: ISODate | null; end_date?: ISODate | null; counterparty_name: string; our_company_name?: string | null; summary: string }
export interface ProposalParty { name: string; role: string; registry_code?: string | null; address?: string | null; confidence: number }
export interface ProposalParameter { key: string; label: string; value: string | number | null; unit?: string | null; text: string; confidence: number; page?: number | null; char_start?: number | null; char_end?: number | null; source_number?: string | null }
export interface ProposalKeyDate { kind: string; date: ISODate; title: string; confidence: number; page?: number | null; char_start?: number | null; char_end?: number | null }
export interface ProposalClause { number: string; level: number; heading?: string | null; text: string; page?: number | null; char_start?: number | null; char_end?: number | null }
export interface Proposal { contract: ProposalContract; parties: ProposalParty[]; parameters: ProposalParameter[]; key_dates: ProposalKeyDate[]; clauses: ProposalClause[]; asset_hint?: { name?: string | null; address?: string | null } | null }
export interface ImportJob { id: UUID; status: ImportStatus; error: string | null; source_document: ImportSourceDocument | null; proposal: Proposal | null; reviewed: Proposal | null; duplicate_of_contract_id: UUID | null; committed_contract_id: UUID | null; created_at: ISODate }
export interface ImportJobDetail extends ImportJob { source_url?: string | null; text_pages?: { page: number; text: string }[] | null }
export interface ImportCommitInput { company_id?: UUID | null; asset_id?: UUID | null; allocation_kind?: "exclusive" | "coverage" | null; party_id?: UUID | null; party?: ProposalParty | null; category: ContractCategory; checked?: string[] }

export interface SearchHit { entity_type: string; entity_id: UUID; title: string; subtitle: string | null; link: string | null }
export interface AuditEvent { id: UUID | number; ts?: ISODate; action?: string; entity_type?: string; event_type?: string; kind?: string; actor_type?: string; actor_name?: string | null; actor?: string | null; reason?: string | null; occurred_at?: ISODate; created_at?: ISODate; payload?: Record<string, unknown> | null }

export interface HealthFinding { code: string; severity: "info" | "warning" | "error"; title: string; count: number; items: { contract_id: UUID; number: string | null; title: string; detail: string | null }[] }
export interface PortfolioHealth { generated_at: ISODate; totals: { contracts: number; active: number; imported: number; platform: number }; findings: HealthFinding[] }
export interface PortfolioSummary { contracts_by_status: Record<string, number>; assets: { properties: number; spaces: number; occupied: number; free: number }; key_dates_next_30: number; open_imports: number }

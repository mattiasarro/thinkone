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

export interface AriregisterRepresentative { name: string; role: string; role_code: string | null; since: string | null }
export interface AriregisterHit { name: string; registry_code: string; address: string | null; vat_number: string | null; status: string | null; legal_form: string | null; email: string | null; phone: string | null; representatives: AriregisterRepresentative[] }
export interface EhrHit { ehr_code: string; address: string; use_type: string | null; footprint_m2: number | null; net_area_m2: number | null; floors: number | null; build_year: number | null; ehr_payload?: Record<string, unknown> | null }

export type PartyKind = "ee_company" | "foreign_company" | "person";
export const PARTY_ROLES = ["landlord", "tenant", "client", "supplier", "manager", "maintainer", "security", "insurer", "insured", "employer", "employee", "other"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export interface Party { id: UUID; kind: PartyKind; name: string; registry_code: string | null; personal_code: string | null; vat_number: string | null; address: string | null; contact_name: string | null; email: string | null; phone: string | null; roles: PartyRole[] }
export type PartyInput = Omit<Party, "id">;

export type AssetType = "property" | "space" | "parking_spot" | "department" | "position";
export type AssetStatus = "vaba" | "üüritud" | "täidetud" | "osaliselt" | "täitmata" | "jagatud" | "mitteaktiivne";
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
export interface SplitUnitInput { name: string; parts: Partial<Record<SpacePartKey, number>>; price_per_m2: number; parking_numbers: string[] }

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
export interface ImportCommitInput { company_id?: UUID | null; asset_id?: UUID | null; allocation_kind?: "exclusive" | "coverage" | null; parties?: ImportCommitParty[]; category: ContractCategory; checked?: string[]; parking_numbers?: string[] | null }

export interface SearchHit { entity_type: string; entity_id: UUID; title: string; subtitle: string | null; link: string | null }
export interface AuditEvent { id: UUID | number; ts?: ISODate; action?: string; entity_type?: string; entity_id?: UUID | null; entity_label?: string | null; entity_link?: string | null; event_type?: string; kind?: string; actor_type?: string; actor_name?: string | null; actor?: string | null; on_behalf_of?: UUID | null; reason?: string | null; correlation_id?: string | null; occurred_at?: ISODate; created_at?: ISODate; payload?: Record<string, unknown> | null }
export interface AuditStats { actor_type: Record<string, number>; entity_type: Record<string, number> }

export interface HealthFinding { code: string; severity: "info" | "warning" | "error"; title: string; count: number; items: { contract_id: UUID; number: string | null; title: string; detail: string | null }[] }
export interface PortfolioHealth { generated_at: ISODate; totals: { contracts: number; active: number; imported: number; platform: number }; findings: HealthFinding[] }
export interface PortfolioSummary { contracts_by_status: Record<string, number>; assets: { properties: number; spaces: number; occupied: number; free: number }; key_dates_next_30: number; open_imports: number; companies: number }

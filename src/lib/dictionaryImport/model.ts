/** Source evidence is immutable. Canonical articles and editorial decisions live separately. */
export interface LegacyLexeme {
    _id: string;
    name: string | null;
    search?: string;
    scheme: string | null;
    properties: string | null;
    forms?: { value: string; properties: string }[];
}
export interface DslEntry {
    id: string;
    headers: string[];
    body: string;
    line: number;
    endLine: number;
}
export interface SourceFragment {
    id: string;
    entryId: string;
    sourceCode: string;
    raw: string;
    /** The surrounding file version and entry line identify the original witness. */
    ordinal: number;
}
export interface GrammarEvidence {
    target: string;
    properties: string;
    analysis: string;
    sourceEntryId: string;
    form: string;
}
export interface LexemeLink {
    externalKey: string;
    lexemeId: string | null;
    candidateIds: string[];
    method: 'exact' | 'verified-orthography' | 'normalized-candidate' | 'homonym-review' | 'unmatched';
    /** Exact spelling is identity evidence, not a verified contextual interpretation. */
    reviewStatus: 'proposed';
}
export interface RecoveryLexeme {
    izvodId: 'russian-synodal';
    _id: string;
    externalKey: string;
    name: string;
    search: string;
    scheme: string;
    properties: string;
    forms: { value: string; properties: string; sourceEntryId: string; sourceProperties?: string; sourceForm?: string; sourceFrequency?: number | null; evidenceKind?: 'source-reported-occurrence' | 'dictionary-only' | 'unquantified' }[];
    morphologyStatus: 'notApplicable' | 'unassigned' | 'reconstructed';
    morphologyLemma?: string;
    schemeEvidence?: SchemeEvidence;
    orthographyReview?: { method: 'explicit-source-heading' | 'editorial-reconstruction'; note: string; evidenceIds: string[] };
    schemeCandidates?: { perfectCodes: string[]; best: { scheme: string; checked: number; matched: number; analogueIds: string[] }[]; status: string; existingCodes?: { scheme: string; suffixLength: number; engineSupported: boolean; examples: { id: string; name: string }[] }[]; existingCodesMethod?: string };
    composition?: FusedComposition;
    orthographyStatus: 'source-attested' | 'needs-review' | 'editorial-reviewed';
    sourceEntryId: string;
    canonicalSourceEntryId: string | null;
}
export interface UsageAssertion {
    targetType: 'lexeme' | 'sense' | 'orthography' | 'form' | 'occurrence';
    targetId: string;
    axis: 'izvod' | 'usageStatus' | 'regionalFeature';
    value: string;
    /** Archaicism/historicism refine obsolete, rather than compete with it. */
    obsoleteKind?: 'archaism' | 'historicism' | 'unspecified';
    referencePeriod?: string;
    referenceIzvod?: string;
    evidenceIds: string[];
    reviewStatus: 'proposed' | 'verified' | 'disputed';
}
export interface OrthographyVariant {
    id: string;
    lexemeId: string;
    izvodId: string;
    value: string;
    scope: 'lemma' | 'form';
    evidenceIds: string[];
    reviewStatus: 'proposed' | 'verified' | 'disputed';
}
export const DEFAULT_DICTIONARY_IZVOD = 'russian-synodal';
export interface CanonicalOrthography {
    izvodId: string;
    church: string | null;
    original: string;
    originalScript: 'church' | 'civil' | 'glagolitic';
    method: 'source-attested' | 'dictionary-linked' | 'editorial' | 'proposed';
    reviewStatus: 'proposed' | 'verified';
}
export const IZVODS = [
    { id: 'russian-synodal', label: 'Русский синодальный' },
    { id: 'russian-old', label: 'Русский дониконовский (старообрядческий)' },
    { id: 'ukrainian', label: 'Украинский' },
    { id: 'serbian', label: 'Сербский' },
    { id: 'croatian', label: 'Хорватский' },
] as const;
/** Typikon owns the reviewed link, interlex owns the article and its bibliography. */
export interface ProtoReference {
    provider: 'interlex';
    articleId: number;
    /** Optional display cache; the article ID remains authoritative. */
    lemmaCache?: string;
    relation: 'inherited-from' | 'borrowed-from' | 'related' | 'uncertain';
    scope: 'lexeme' | 'root' | 'prefix' | 'suffix';
    reviewStatus: 'proposed' | 'verified' | 'disputed';
    evidenceIds: string[];
    note?: string;
}

export interface SchemeEvidence {
    origin: 'reconstructed';
    originalSourceCode: false;
    checkedForms: number;
    matchedForms: number;
    accentChecked: false;
    sourceEntryIds: string[];
    analogueIds: string[];
}
export interface FusedComponent {
    role: 'base' | 'enclitic' | 'particle' | 'other';
    lookupForm: string;
    externalKey?: string;
    lexemeId: string | null;
    candidateIds: string[];
    /** E.g. ми is a short dative form of азъ, not a newly invented lemma. */
    lemma?: string;
    grammar?: string;
}
export interface FusedComposition {
    kind: 'enclitic-combination' | 'fused-words';
    components: FusedComponent[];
    evidenceIds: string[];
    /** Linearization belongs to individual attested forms; do not infer it globally. */
    placement: 'form-specific';
    forms?: FusedFormAnalysis[];
    reviewStatus: 'reviewed';
}

export interface FusedFormAnalysis {
    form: string;
    components: FusedComponent[];
    /** Offsets refer to this exact form string; end is exclusive. A component can have several spans. */
    offsetUnit: 'unicode-code-point';
    spans: { componentIndex: number; start: number; end: number }[];
    evidenceIds: string[];
    reviewStatus: 'proposed' | 'reviewed';
}

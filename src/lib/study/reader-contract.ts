/** Additive, opt-in metadata for the experimental study/material bridge. No text copies. */
export interface StudySourceAddress {
  version: 2;
  sourceId: string;
  sourceRevision: string;
  passportRevision: string;
  selector?: { kind: 'fragment'; fragmentId: string };
}
export interface StudyReaderAttachment {
  contract: 'cs-reader/1';
  sourceId: string;
  address: StudySourceAddress;
  snapshot: {
    sourceId: string; sourceRevision: string; passportRevision: string;
    datasetRevisions: string[]; passportPolicy: 'current' | 'pinned';
  };
  bodyRef: { bodyId: string; bodyRevision: string };
  permanentUrl: string;
  versionUrl: string;
  fragment: { address: StudySourceAddress; url: string; label: string };
  passportUrl: string;
  editorialStatus: string;
  passport: {
    sourceId: string; passportRevision: string;
    fields: Record<string, {state: string; display: string; assertionIds: string[]; questionIds: string[]}>;
    questions: { id: string; status: string; reason: string }[];
    assertions: unknown[]; sources: unknown[]; observations: unknown[]; cases: unknown[];
    [key:string]: unknown;
  };
}

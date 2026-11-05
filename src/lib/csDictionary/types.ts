export type Direction = 'cu-ru' | 'ru-cu';
export type ReviewStatus = 'verified' | 'proposed';
export interface Run { text:string; kind:'text'|'church'|'emphasis'|'strong'|'reference'; target?:string; }
export interface Paragraph { runs:Run[]; }
export interface SourceEntry { id:string; entryId:string; sourceCode:string; title:string; bibliographyStatus:'identified'|'unknown'; version:string; paragraphs:Paragraph[]; text:string; anchors:MeaningAnchor[]; }
export interface MeaningAnchor { id:string; sourceId:string; sourceVersion:string; text:string; translation:string|null; number:string|null; status:'source-numbered'|'unsegmented'|'source-fragment'; }
export interface Segment { text:string; kind:'stem'|'ending'|'clitic'; }
export interface DataOrigin {targetId?:string;sourceId:string;title:string;origin:string;attribution:string;carrierVersionId?:string;reportedSourceId?:string;}
export interface Form { provenance?:DataOrigin[]; value:string; origin:'stored'|'generated'; grammar:string; segments:Segment[]|null; }
export interface Slot { id:string; label:string; forms:Form[]; }
export interface Paradigm { kind:string; title:string; slots:Slot[]; }
export interface Relation { id:string; type:'synonym'|'antonym'; status:ReviewStatus; targetId:string; targetName:string; anchorId:string; anchorText:string; targetAnchorId:string; targetAnchorText?:string; sourceId?:string; targetSourceId?:string; basis:string; provider:string; providerVersion?:string; conceptIds:string[]; }
export interface EtymologyReference { articleId:number; lemma:string; relation:string; evidence:string; sourceUrl:string; bodySha256:string; status:'verified'; }
export interface Article { relatedSources?:{id:string;title:string;sourceCode:string;preview:string;mappingStatus:ReviewStatus}[]; provenance?:{lexeme:DataOrigin[];scheme:DataOrigin[]}; id:string; name:string; originalName:string; properties:string[]; pos:string; scheme:string; morphologyStatus:'supported'|'notApplicable'|'unassigned'; izvod:string; paradigms:Paradigm[]; extra:Form[]; sources:{id:string;title:string;sourceCode:string;preview:string;mappingStatus:ReviewStatus}[]; relations:Relation[]; etymologies:EtymologyReference[]; usage:{axis:string;value:string;evidence:string}[]; composition:{role:string;form:string;lexemeId:string|null;candidateIds:string[]}[]; }
export interface SearchItem { exact:boolean; id:string; name:string; pos:string; match:'lemma'|'stored-form'|'source-variant'|'generated-form'|'translation'|'explanation'; matched:string; grammar:string; rank:number; }
export interface SearchResult { version:string; query:string; direction:Direction; items:SearchItem[]; nextCursor:string|null; }

import type { ChantTradition, Tone, TranslationResult, Melody } from "@znamenica/kruczie";

export type Direction = "to-notes" | "to-neumes";
export interface ConversionRequest {
    direction: Direction;
    tradition: ChantTradition;
    tone?: Tone;
    input: string;
    corpusSourceId?: string;
}
export interface CandidateView {
    unicode: string;
    melody: Melody;
    neumes: string;
    notes: string;
    kind: "matched" | "constructed";
    origins: string[];
    ranking?: import("./corpus/types").CorpusRanking;
}
export interface ConversionView {
    result: TranslationResult;
    candidates: CandidateView[];
    datasetVersion: string;
}
export const MAX_INPUT_LENGTH = 1000;
export const EXAMPLES: Record<ChantTradition, Record<Direction, string>> = {
    znamenny: { "to-notes": "Э: пК: мК: сТ. мК:", "to-neumes": "с1м1 п2 м2 с1н1 м2" },
    demestvenny: { "to-notes": "пЭ-;", "to-neumes": "с1м1п4" },
};

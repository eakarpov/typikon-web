import { getPodoben, podobenFacets, podobenStichera, podobnyIndex, selfSimilar,
    type PodobenFacets, type SelfSimilar } from "@/lib/podobny/store";
import type { PodobenUnit } from "@/lib/podobny/core";
import { filtersFrom } from "@/app/chants/api";
import { resolveTune } from "@/lib/tunes/resolve";
import type { Resolved } from "@/lib/tunes/resolve";
import type { ChantHit } from "@/lib/chants";

export const PAGE_SIZE = 25;

export interface PodobenPageData {
    unit: PodobenUnit | null;
    items: ChantHit[];
    total: number;
    facets: PodobenFacets | null;
    model: SelfSimilar[];
    tune: Resolved | null;
    corpusMissing: boolean;
}

/** Напев, выбранный именно подобном, а не гласом. */
const podobenTune = (unit: PodobenUnit): Resolved | null => {
    const resolved = resolveTune({
        tone: unit.tone,
        podoben: unit.names[0]?.printed ?? null,
        genre: "stichera",
    });
    return resolved?.tune.select.kind === "podoben" ? resolved : null;
};

export const podobenData = (
    slug: string,
    params: Record<string, string | undefined>,
): PodobenPageData => {
    const unit = getPodoben(slug);
    if (!unit) {
        return {
            unit: null, items: [], total: 0, facets: null, model: [], tune: null,
            // Корпуса нет вовсе — это другое «не найдено», и говорится о нём
            // иначе: не «такого подобна нет», а «книг на сервере нет».
            corpusMissing: podobnyIndex() === null,
        };
    }

    const page = Math.max(1, Number(params.page) || 1);
    const found = podobenStichera(unit, filtersFrom(params), PAGE_SIZE, (page - 1) * PAGE_SIZE);

    return {
        unit,
        items: found?.items ?? [],
        total: found?.total ?? 0,
        facets: podobenFacets(unit),
        model: selfSimilar(unit),
        // Напев берём ТОЛЬКО подобный.
        //
        // resolveTune при отсутствии подобного откатывается на гласовый — и
        // правильно делает на странице песнопения: спеть его чем-то надо. Но
        // здесь это был бы подлог: страница подобна, показавшая гласовый
        // напев, утверждает ровно то, что подобен отменяет. Гласовый напев на
        // этот глас есть у 1-го и 3-го, и молчание о нём честнее подмены.
        tune: podobenTune(unit),
        corpusMissing: false,
    };
};

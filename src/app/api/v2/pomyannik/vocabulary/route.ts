import { authorize } from "@/lib/api/v2/access";
import { preflight, respond } from "@/lib/api/v2/http";
import { noteKindInfo, rankInfo } from "@/lib/api/v2/serialize";
import { MAX_BATCH, MAX_NAMES_IN_NOTE, MAX_PERSONS, NOTE_KINDS, RANKS } from "@/lib/pomyannik/types";

// СЛОВАРИ ПОМЯННИКА: чины, виды поминовения, пределы.
//
// Ручка, а не таблица в коде клиента, и это решение против очевидного: списки
// закрыты, коротки и не меняются, то есть просятся быть переписанными на той
// стороне.
//
// Переписывать их нельзя из-за `cs: null`. У пяти помет («болящий»,
// «путешествующий», «заключённый», «непраздная», «убиенный») церковнославянского
// начертания в наших книгах не нашлось, и `null` тут значит «не знаем», а не
// «нет». Копия на стороне клиента — это второе место, где кто-нибудь заполнит
// пробел, и тогда в записке будет напечатано выдуманное за книгу. Правило о
// честности нельзя обеспечить двумя таблицами, только одной.
//
// Вторая причина мельче, но той же породы: родительные падежи набраны
// церковнославянским письмом с надстрочными знаками, и потерянный при переносе
// знак невидим на обзоре кода.
//
// Подписей к родам событий («Сороковой день», «Именины») здесь нет нарочно: это
// русские слова, а не орфография книги, и жить они должны у того, кто их
// показывает, — иначе список впереди пуст, пока не пришла сеть.
//
// Личного здесь нет ничего, поэтому сессии не спрашиваем — только ключ.
export const revalidate = 86400;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "pomyannik");
    if (access.denied) return access.denied;

    // Ни базы, ни счёта — только постоянные из types.ts, и бросить тут нечему.
    return respond({
        ranks: RANKS.map(rankInfo),
        noteKinds: NOTE_KINDS.map(noteKindInfo),
        limits: {
            maxPersons: MAX_PERSONS,
            maxBatch: MAX_BATCH,
            maxNamesInNote: MAX_NAMES_IN_NOTE,
        },
    }, { access, maxAge: revalidate });
}

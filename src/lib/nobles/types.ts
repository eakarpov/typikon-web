// Строки таблиц nobles.db, снятые с самой базы (`PRAGMA table_info`), а не
// выведенные по употреблению. Нужны потому, что better-sqlite3 объявляет
// возврат `get()` и `all()` как `unknown`: без явного типа всякое обращение к
// полю строки — ошибка компиляции, и ровно из них состояла большая часть
// накопленного долга по типам.
//
// Пустое поле в этой базе — всегда NULL, поэтому необязательность выражена
// через `| null`, а не через `?`: строка приходит целиком, со всеми столбцами.
//
// Числа вместо булевых значений (`gender`, `isSaintOrthodox`) — как в SQLite:
// 1 или 0. Приводить их к boolean здесь значило бы разойтись с тем, что лежит
// в базе и что уходит в запись при правке из админки.

export interface NobleRow {
    id: number;
    name: string | null;
    englishName: string | null;
    originalName: string | null;
    birthDate: string | null;
    deathDate: string | null;
    isSaintOrthodox: number | null;
    isSaintCatholic: number | null;
    /** 1 — мужской, 0 — женский: на этом держится разбор супружеств. */
    gender: number | null;
    /** JSON-массив адресов строкой, как он лежит в столбце. */
    links: string | null;
    surnames: string | null;
    defaultNationalityId: number | null;
    familyId: number | null;
    fatherId: number | null;
    motherId: number | null;
    info: string | null;
    csName: string | null;
    nickName: string | null;
    churchName: string | null;
    /** Год числом — для сортировки и сравнения; сама дата лежит строкой рядом. */
    birthDateMarker: number | null;
    deathDateMarker: number | null;
    rank: number | null;
    wikidataId: string | null;
    /** Ключ памяти в святцах dneslov; связывает родословную с месяцесловом. */
    dneslovId: string | null;
}

export interface FamilyRow {
    id: number;
    name: string | null;
    parentFamilyId: number | null;
    wikidataId: string | null;
}

export interface CoupleRow {
    id: number;
    husbandId: number;
    wifeId: number;
    marriageDate: string;
    divorceDate: string | null;
}

export interface StateRow {
    id: number;
    name: string | null;
    predessorId: number | null;
    ancestorId: number | null;
    defaultTitle: string | null;
    surnames: string | null;
    wikidataId: string | null;
}

export interface RuleRow {
    id: number;
    stateId: number;
    personId: number;
    predessorId: number | null;
    heirId: number | null;
    suzerainId: number | null;
    regentId: number | null;
    startDate: string | null;
    endDate: string | null;
    title: string | null;
    regentTitle: string | null;
}

export interface NationalityRow {
    id: number;
    name: string | null;
}

export interface NationalityNobleRow {
    id: number;
    personId: number;
    nationalityId: number;
}

import { RANK_BY_KEY, type Rank, type Sex } from "@/lib/pomyannik/types";

// ПОИМЁННЫЕ МОЛИТВЫ — чистая логика подстановки имён в книжный шаблон.
//
// Книга печатает молитву с пустым местом под имена, и у изданий место это
// обозначено по-разному: гражданский Молитвослов ставит «(имя)», уставный —
// «[и҆́мⷬ҇къ]», Служебник пишет «имярек» (и однажды печатник закрыл скобку не
// той: «имярек]»). Все эти формы — одно место, и читателю оно подменяется
// одним списком имён. Таблица замен — ниже, и она закрыта: форма, которой в
// таблице нет, в тексте останется как есть, а не уедет читателю за подмену.
//
// Что подставляется. Имена идут в родительном падеже («о здра́вїи їѡа́нна») —
// родительный даёт словарь личных имён (@/lib/pomyannik/slavonic), здесь он
// уже приготовлен вызывающей стороной. Лицо с чином читается с чином в том же
// падеже: «иерея Николая», «игумении Марии» (женская форма чина — по полу
// лица; пол неизвестен — по полу молящегося, который ведь и просит о своих).

/** Род молящегося: влияет на женский вариант текста (у вызывающей стороны)
 *  и на форму чина лица с неизвестным полом. */
export type PrayerGender = "m" | "f";

/** Лицо, готовое к подстановке: имя в родительном падеже + чин. */
export interface NamedPerson {
    /** Родительный падеж церковнославянским письмом («їѡа́нна»). */
    name: string;
    rank?: Rank | null;
    sex?: Sex;
}

interface Placeholder {
    /** Ключ для тестов и журнала: какую книжную форму закрываем. */
    key: string;
    pattern: RegExp;
    /** Список имён (уже склеенный) → что встать на место. */
    fill: (names: string) => string;
}

// Формы пустого места — теми же кодовыми точками, какими их напечатала книга:
// ударения и титла разными последовательностями в разных файлах не встречаются,
// но сверять их надо посимвольно, а не глазами.
const IMYAREK_CS_INNER = "и҆́мⷬ҇къ"; // и + кендема + акут + м + ⷬ + паерок + к + ъ
const PARENTS_CS = "роди́телей мои́хъ";       // уставное начертание
const PARENTS_GR = "роди́телей мои́х";        // гражданское начертание (на всякий случай издания)

export const NAME_PLACEHOLDERS: Placeholder[] = [
    // Уставный слой: «[и҆́мⷬ҇къ]». Скобки книга ставит, чтобы читатель видел
    // место подмены; подмененный текст скобок не несёт.
    { key: "imyarek-cs", pattern: new RegExp(`\\[${IMYAREK_CS_INNER}\\]`, "g"),
      fill: names => names },
    // Уставный слой, об усопших: «[роди́телей мои́хъ]» — категория, а не имя,
    // но читается она поимённо же: подменяем не на имена, а на «категорию +
    // имена». Без имён — просто категория, без скобок: та самая общая
    // формула («родителей моих, сродников…»), ради которой молитва и
    // печатается с пустым местом.
    { key: "parents-cs", pattern: new RegExp(`\\[${PARENTS_CS}\\]`, "g"),
      fill: names => names ? `${PARENTS_CS} ${names}` : PARENTS_CS },
    { key: "parents-gr", pattern: new RegExp(`\\[${PARENTS_GR}\\]`, "g"),
      fill: names => names ? `${PARENTS_GR} ${names}` : PARENTS_GR },
    // Гражданский слой: «(имя)».
    { key: "name-gr", pattern: /\(имя\)/g, fill: names => names },
    // Служебник: «имярек»; «имярек]» — опечатка издания, закрывшая скобку
    // не той, место то же.
    { key: "imyarek", pattern: /имярек]?/g, fill: names => names },
];

/** Чин в родительном падеже, по полу лица; при неизвестном — по полу молящегося. */
const rankGenitive = (rank: Rank, sex: Sex, gender: PrayerGender): string => {
    const info = RANK_BY_KEY[rank];
    if (!info) return "";
    const feminine = sex === "f" || (sex == null && gender === "f");
    const form = feminine && info.feminine ? info.feminine : info;
    // Славянским письмом помета идёт, если оно засвидетельствовано книгой;
    // иначе гражданкой — та же договорённость, что в записке помянника
    // (NoteSheet: «славянским письмом помета идёт, если оно засвидетельствовано
    // книгой; иначе гражданкой»).
    return form.cs ?? form.genitive;
};

/** «і҆ере́ѧ Никола́ѧ» — чин строчный, имя с прописной. */
const personLabel = (person: NamedPerson, gender: PrayerGender): string => {
    const name = String(person.name ?? "").trim();
    if (!name) return "";
    const capitalized = name.charAt(0).toLocaleUpperCase("ru") + name.slice(1);
    if (!person.rank) return capitalized;
    const rank = rankGenitive(person.rank, person.sex ?? null, gender);
    return rank ? `${rank} ${capitalized}` : capitalized;
};

/** Имена склеенные: через запятую. */
export const joinNames = (persons: NamedPerson[], gender: PrayerGender): string =>
    persons.map(p => personLabel(p, gender)).filter(Boolean).join(", ");

/** Остатки пустого места: двойные пробелы, пробел перед пунктуацией. */
const tidy = (text: string): string =>
    text
        .replace(/ ([,.;:!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();

/**
 * Шаблон книги + лица → готовый текст.
 *
 * Без лиц возвращает общую формулу: категории остаются, пустые места убраны
 * («роди́телей мои́х, сро́дников…»), — так молитва читается о «всех
 * православных христианах» вообще. `gender` здесь не выбирает женский
 * вариант текста — это делает вызывающая сторона (text_id_f у вхождения);
 * он влияет только на форму чина у лиц с неизвестным полом.
 */
export const renderNamedPrayer = (
    template: string,
    persons: NamedPerson[],
    gender: PrayerGender,
): string => {
    const names = joinNames(persons, gender);
    let text = String(template ?? "");
    for (const placeholder of NAME_PLACEHOLDERS) {
        text = text.replace(placeholder.pattern, () => placeholder.fill(names));
    }
    return tidy(text);
};

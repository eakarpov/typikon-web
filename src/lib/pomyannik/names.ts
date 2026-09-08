import { nameKey, normalizeName } from "@/lib/imeniny/core";

// ИМЯ В ЗАПИСКЕ — ИМЯ НАРЕЧЕНИЯ, А НЕ ИЗ ПАСПОРТА, и в этом вся забота этого
// файла. Человек пишет «Юрий», а поминают Георгия; пишет «Светлана» — поминают
// Фотину. Спросить об этом у свечного ящика есть кого, а дома нет никого, и
// записка уходит с именем, которого в святцах нет.
//
// ПОДСКАЗЫВАЕМ, А НЕ ЗАПРЕЩАЕМ. Указатель имён у нас свой, выведенный разбором
// заголовков святцев (см. lib/imeniny/core), и он неполон: из восьмидесяти
// восьми ходовых имён в нём нашлось семьдесят. В нём же есть и мусор своего
// происхождения — «Богоносец», «Пресвятая», «Новый». Решето из такого делать
// нельзя: человек знает имя своей матери лучше нашего разбора. Незнакомое имя
// принимается с пометой, и только.
//
// НАРЕЧЕНИЕ — ОБЫЧАЙ, А НЕ ТАБЛИЦА СООТВЕТСТВИЙ. Одному гражданскому имени
// отвечает иногда несколько церковных, и выбирал его священник при крещении, а
// не словарь. Оттого здесь варианты, а не ответ, и последнее слово за человеком.

export interface ChurchForm {
    name: string;
    /** Почему так нарекают — человеку это важнее самого соответствия. */
    why: string;
}

const FOLK = "народная форма того же имени";
const SOUND = "нарекают по созвучию";
const MEANING = "нарекают по значению имени";

/**
 * Гражданское имя — имена наречения. Ключ — `nameKey` гражданского.
 *
 * Список закрытый и невелик нарочно: он покрывает имена, с которыми к записке
 * подходят чаще всего, и не притворяется полным. Чего здесь нет — то принимается
 * как есть.
 */
export const CHURCH_FORMS: Record<string, ChurchForm[]> = {
    // народные и обиходные виды церковных имён
    "иван": [{ name: "Иоанн", why: FOLK }],
    "алексей": [{ name: "Алексий", why: FOLK }],
    "сергей": [{ name: "Сергий", why: FOLK }],
    "дмитрий": [{ name: "Димитрий", why: FOLK }],
    "федор": [{ name: "Феодор", why: FOLK }],
    "матвей": [{ name: "Матфей", why: FOLK }],
    "степан": [{ name: "Стефан", why: FOLK }],
    "осип": [{ name: "Иосиф", why: FOLK }],
    "ефим": [{ name: "Евфимий", why: FOLK }],
    "емельян": [{ name: "Емилиан", why: FOLK }],
    "ерофей": [{ name: "Иерофей", why: FOLK }],
    "фрол": [{ name: "Флор", why: FOLK }],
    "сысой": [{ name: "Сисой", why: FOLK }],
    "авдей": [{ name: "Авдий", why: FOLK }],
    "аверьян": [{ name: "Валериан", why: FOLK }],
    "артем": [{ name: "Артемий", why: FOLK }],
    "никола": [{ name: "Николай", why: FOLK }],
    "наталья": [{ name: "Наталия", why: FOLK }],
    "софья": [{ name: "София", why: FOLK }],
    "марья": [{ name: "Мария", why: FOLK }],
    "дарья": [{ name: "Дария", why: FOLK }],
    "юлия": [{ name: "Иулия", why: FOLK }],
    "ульяна": [{ name: "Иулиания", why: FOLK }],
    "елизавета": [{ name: "Елисавета", why: FOLK }],
    "кристина": [{ name: "Христина", why: FOLK }],
    "марта": [{ name: "Марфа", why: FOLK }],
    "арина": [{ name: "Ирина", why: FOLK }],
    "аграфена": [{ name: "Агриппина", why: FOLK }],
    "акулина": [{ name: "Акилина", why: FOLK }],
    "авдотья": [{ name: "Евдокия", why: FOLK }],
    "прасковья": [{ name: "Параскева", why: FOLK }],
    "аксинья": [{ name: "Ксения", why: FOLK }],
    "устинья": [{ name: "Иустина", why: FOLK }],
    "настасья": [{ name: "Анастасия", why: FOLK }],
    "катерина": [{ name: "Екатерина", why: FOLK }],
    "лукерья": [{ name: "Гликерия", why: FOLK }],
    "маланья": [{ name: "Мелания", why: FOLK }],
    "матрена": [{ name: "Матрона", why: FOLK }],
    "ненила": [{ name: "Неонила", why: FOLK }],
    "февронья": [{ name: "Феврония", why: FOLK }],
    "егорий": [{ name: "Георгий", why: FOLK }],
    "алена": [{ name: "Елена", why: FOLK }],
    "оксана": [{ name: "Ксения", why: FOLK }],

    // имена, которых в святцах нет вовсе
    "юрий": [{ name: "Георгий", why: "«Юрий» и есть Георгий, тот же корень" }],
    "егор": [{ name: "Георгий", why: "«Егор» и есть Георгий, тот же корень" }],
    "денис": [{ name: "Дионисий", why: FOLK }],
    "светлана": [{ name: "Фотина", why: MEANING }, { name: "Фотиния", why: MEANING }],
    "лана": [{ name: "Фотина", why: MEANING }],
    "жанна": [{ name: "Иоанна", why: FOLK }],
    "яна": [{ name: "Иоанна", why: FOLK }],
    "полина": [{ name: "Аполлинария", why: SOUND }, { name: "Пелагия", why: SOUND }],
    "карина": [{ name: "Екатерина", why: SOUND }],
    "милана": [{ name: "Милица", why: SOUND }],
    "нелли": [{ name: "Неонила", why: SOUND }],
    "илона": [{ name: "Елена", why: SOUND }],
    "олеся": [{ name: "Александра", why: SOUND }],
    "алиса": [{ name: "Александра", why: SOUND }],
    "анжела": [{ name: "Ангелина", why: SOUND }],
    "анжелика": [{ name: "Ангелина", why: SOUND }],
    "лилия": [{ name: "Лия", why: SOUND }],
    "павлина": [{ name: "Павла", why: SOUND }],
    "богдан": [{ name: "Феодот", why: MEANING }],
    "владлен": [{ name: "Владимир", why: SOUND }],
    "борислав": [{ name: "Борис", why: SOUND }],
    "виктория": [{ name: "Виктория", why: "святая с этим именем есть" },
                 { name: "Ника", why: MEANING }],
};

export type NameStatus =
    /** Имя есть в святцах нашего собрания. */
    | "known"
    /** Имени нет, но известно, каким его нарекают. */
    | "civil"
    /** Имени нет и подсказать нечего — принимаем как есть. */
    | "unknown";

export interface NameSuggestion {
    name: string;
    why: string;
}

export interface NameCheck {
    /** Как введено, приведённое к виду указателя. */
    name: string;
    key: string;
    status: NameStatus;
    suggestions: NameSuggestion[];
}

/** Расстояние Дамерау — Левенштейна, обрезанное сверху: дальше нам неинтересно. */
const distance = (a: string, b: string, max = 2): number => {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
            if (row[j] < best) best = row[j];
        }
        if (best > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
};

/**
 * Что мы знаем об этом имени.
 *
 * Указатель святцев передаётся списком, а не читается отсюда: этот файл должен
 * оставаться чистым, чтобы правила наречения можно было проверить тестом, не
 * поднимая базу.
 *
 * Порядок разбора: сперва святцы, потом таблица наречения, потом косвенный
 * падеж, и только последними — близкие по написанию. Опечатка предлагается
 * ПОСЛЕДНЕЙ и только одна: подсказка «может быть, Дария?» тому, кто и вправду
 * записал Дарину, скорее мешает, чем помогает.
 *
 * КОСВЕННЫЙ ПАДЕЖ ИДЁТ ПРЕЖДЕ ОПИСКИ, и это не порядок ради порядка. Помянник
 * читают вслух — «о здравии Анны», — и пишут его так же; «Анны» отстоит от
 * «Анна» на одну букву, и прежде эта разница называлась опиской. Назвать её
 * так — значит предложить верное исправление с неверным доводом, а человек
 * решает по доводу.
 */
export const checkName = (raw: string, known: Iterable<string>): NameCheck => {
    const name = normalizeName(raw);
    const key = nameKey(raw);
    const index = known instanceof Set ? known : new Set(known);

    if (!key) return { name, key, status: "unknown", suggestions: [] };
    if (index.has(key)) return { name, key, status: "known", suggestions: [] };

    const forms = CHURCH_FORMS[key];
    if (forms?.length) {
        return { name, key, status: "civil", suggestions: forms.map(f => ({ ...f })) };
    }

    const oblique = obliqueLemmas(key).filter(candidate => index.has(candidate));
    if (oblique.length) {
        return {
            name, key, status: "civil",
            suggestions: oblique.map(candidate => ({
                name: normalizeName(candidate),
                why: "похоже на родительный падеж",
            })),
        };
    }

    let closest: { key: string; at: number } | null = null;
    for (const candidate of index) {
        const at = distance(key, candidate);
        if (at > 1) continue;
        if (!closest || at < closest.at) closest = { key: candidate, at };
    }

    return {
        name, key, status: "unknown",
        suggestions: closest
            ? [{ name: normalizeName(closest.key), why: "похоже на описку" }]
            : [],
    };
};

/**
 * Словарные формы, из которых мог получиться этот косвенный падеж.
 *
 * ДОГАДКА, И ПОДТВЕРЖДАЕТ ЕЁ УКАЗАТЕЛЬ. Здесь только отматываются назад обычные
 * родительные окончания; годным считается лишь то, что нашлось в святцах. Оттого
 * выдумать имя этот перебор не может — он может лишь предложить существующее.
 *
 * Применять подсказку молча нельзя: «Иоанна» — это и родительный от «Иоанна», и
 * самостоятельное женское имя, и решать, кого записали, не нам.
 */
export const obliqueLemmas = (key: string): string[] => {
    const out: string[] = [];
    const add = (value: string) => {
        if (value.length >= 3 && value !== key && !out.includes(value)) out.push(value);
    };

    const head = key.slice(0, -1);
    switch (key.slice(-1)) {
        case "ы":               // Анны → Анна, Космы → Косма
            add(`${head}а`);
            break;
        case "и":               // Марии → Мария, Любови → Любовь, Ксении → Ксения
            add(`${head}я`);
            add(`${head}ь`);
            add(`${head}а`);
            break;
        case "а":               // Иоанна → Иоанн
            add(head);
            break;
        case "я":               // Андрея → Андрей, Игоря → Игорь
            add(`${head}й`);
            add(`${head}ь`);
            break;
    }

    return out;
};

/**
 * Мужское имя или женское.
 *
 * ЭТО ДОГАДКА ПО ОКОНЧАНИЮ, и нужна она ровно для одного: выбрать форму чина —
 * «болящего Николая», но «болящей Марии». Ошибётся она на Никите, Илии и Фоме,
 * и потому исправляется одним щелчком в карточке, а на догадке ничего, кроме
 * окончания слова, не держится.
 */
export const guessSex = (raw: string): "m" | "f" | null => {
    const key = nameKey(raw);
    if (!key) return null;
    // Мужские имена на «-а» и «-ия» — наперечёт, и они здесь исключением.
    if (/^(никита|илия|илья|фома|лука|савва|кузьма|козьма|иона|сила|акила|анания|азария|захария|исаия|иеремия|захарий)$/.test(key)) {
        return "m";
    }
    if (/[ая]$/.test(key)) return "f";
    return "m";
};

/**
 * Ключи, под какими имя может лежать в церковнославянском словаре.
 *
 * Словарь ищет по `lexems.search` — по гражданке без конечного ера, — но
 * гражданка эта получена ИЗ СЛАВЯНСКОГО написания, а не из русского. Оттого
 * «Марія» лежит под «мариа», а не под «мария», и прямой поиск по набранному
 * промахивается ровно на самых частых именах: Мария, Ксения, Анастасия, София,
 * Наталия, Иулия, Зоя, Илия. Отсюда варианты, а не один ключ.
 */
export const lexiconKeys = (raw: string): string[] => {
    const key = nameKey(raw);
    if (!key) return [];
    const out = [
        key,
        key.replace(/ия$/, "иа"),
        key.replace(/ья$/, "иа"),
        key.replace(/я$/, "а"),
        key.replace(/й$/, "и"),
        key.replace(/ъ$/, ""),
    ];
    return [...new Set(out.filter(Boolean))];
};

// Общая логика сопоставления occasions зачал с реальными днями (`days`).
// Используется и сухим прогоном (match-day-pericopes.ts), и записью в БД
// (write-day-pericopes.ts) — чтобы не разъезжались два независимых парсера.
import { Db } from "mongodb";

const MONTHS: Record<string, number> = {
    "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "ма": 5, "июн": 6,
    "июл": 7, "август": 8, "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

// Именованные неподвижные праздники — occasion называет их по имени, не по числу,
// а fixedIndex построен по "месяц:число". Даты — старый стиль (совпадает с monthIndex
// в этой БД). Сверено по Википедии/ruvera.ru.
// \S* на конце слов — чтобы матчились и падежные формы ("Рождества Христова" род.п.,
// не только именительный "Рождество Христово").
const NAMED_FIXED_FEASTS: [RegExp, number, number][] = [
    [/обрезани\S*\s+господн\S*/, 1, 1],
    [/сретени\S*\s+господн\S*/, 2, 2],
    [/(?:память )?св\.?\s+симеона\s+богоприимца/, 2, 3],
    [/благовещени\S*\s+(?:пресвятой\s+)?богородиц\S*/, 3, 25],
    [/рождеств\S*\s+иоанна\s+предтечи/, 6, 24],
    [/памят\S*\s+пророка\s+илии/, 7, 20],
    [/преображени\S*\s+господн\S*/, 8, 6],
    [/начал\S*\s+индикта/, 9, 1],
    [/воздвижени\S*\s+креста\s+господн\S*/, 9, 14],
    [/введени\S*\s+во\s+храм\s+(?:пресвятой\s+)?богородиц\S*/, 11, 21],
    [/рождеств\S*\s+христов\S*/, 12, 25],
];

// Родительный падеж жен. рода — как используется в "N-я седмица/неделя по ...".
// Без "ё" — normalize() заменяет ё->е ДО подстановки этих слов, поэтому сами слова
// не должны содержать "ё", иначе подставленный текст не пройдёт через эту замену.
const ORDINALS = [
    "", "первой", "второй", "третьей", "четвертой", "пятой", "шестой", "седьмой",
    "восьмой", "девятой", "десятой", "одиннадцатой", "двенадцатой", "тринадцатой",
    "четырнадцатой", "пятнадцатой", "шестнадцатой", "семнадцатой", "восемнадцатой",
    "девятнадцатой", "двадцатой", "двадцать первой", "двадцать второй", "двадцать третьей",
    "двадцать четвертой", "двадцать пятой", "двадцать шестой", "двадцать седьмой",
    "двадцать восьмой", "двадцать девятой", "тридцатой", "тридцать первой", "тридцать второй",
    "тридцать третьей", "тридцать четвертой", "тридцать пятой",
];

export const WEEK_TYPES = ["Pascha", "Fast", "Triodion", "Penticostarion", "first", "second", "third"];

// Это не про день вообще (требы/общие чтения по чину святого) — пропускаем всегда.
const RITE_PATTERNS = [
    /^Общее /i, /Богородичные праздники/i, /Освящение храма/i,
    /Крещени/i, /погребение/i, /Молебен/i, /освящени.*вод/i, /елеосвящени/i, /брака/i,
    /^если /i, // условные обрывки после разбиения по запятой/точке с запятой
    /^Паремия/i, /Память отцов/i, /Память соборов/i, /На пострижение/i, /Поминовение усопших/i,
    /На основание града/i, /^О болящих/i, /праздники Богородицы/i, /При пожаре/i, /На освящение церкви/i,
];

// В этом заходе нас интересует только Литургия (apostleLiturgy/gospelLiturgy).
// Если явно указана другая служба — пропускаем; "на литургии" явно — оставляем,
// просто обрезая суффикс перед сопоставлением с именем дня.
// \b в конце не годится — не работает с кириллицей в JS-regex (граница \w/\W не
// возникает между кириллической буквой и пробелом/концом строки).
const NON_LITURGY_SERVICE = /на\s+(утрен[еи]|вечерн[еи]|повечери[еи]|полунощниц[еы]|\d+-?м?\s*час[уе]?)(?=\s|$)|утреннее$|^\d+-е\s+(евангелие\s+святых\s+страстей|воскресное)|навечерие|^\d+-?й?\s+час\s+в/i;
const LITURGY_SUFFIX = /\s*на\s+литурги[иеи]\s*$/i;

// В occasions зачал будни встречаются и в современной форме (четверг/пятница),
// и в архаичной (Четверток/Пяток), а в шаблоне БД (days.name) — только архаичная.
const WEEKDAY_SYNONYMS: [RegExp, string][] = [
    [/(?<=^|\s)четверг(?=\s|$)/g, "четверток"],
    [/(?<=^|\s)пятниц[аеу]?(?=\s|$)/g, "пяток"],
    // "Суббота мясопустная" (occasion) vs "Мясопустная суббота" (шаблон дня) — обратный порядок слов.
    [/суббота мясопустная/g, "мясопустная суббота"],
];

// Отдельные традиционные названия, расходящиеся между occasions и шаблоном дня
// (порядок слов/синонимия), не сводимые к общему правилу.
const NAME_SYNONYMS: [RegExp, string][] = [
    [/неделя о фоме/g, "фомина неделя"],
    [/^антипасха$/g, "фомина неделя"],
    [/неделя пятидесятницы/g, "пятидесятница"],
    [/суббота сыропустная/g, "суббота сырная"],
    [/неделя всем святым/g, "неделя всех святых"],
    [/день святого духа/g, "день святаго духа"], // архаичное написание в шаблоне (неделя 1)
    // тот же день, две формулировки: "после Недели о мытаре" (от прошлого воскресенья)
    // и "пред Неделей о блудном сыне" (от следующего) — один и тот же будний день.
    [/суббота пред неделей о блудном сыне/g, "суббота после недели о мытаре и фарисее"],
    // после замены "пятниц[аеуы]?"->"пяток" род прилагательного рассогласуется с шаблоном ("великий пяток").
    [/велика[яю] пяток/g, "великий пяток"],
];

const normalize = (s: string): string => {
    let n = s.toLowerCase().trim()
        .replace(/\[\*\]/g, "")
        .replace(/ё/g, "е")
        .replace(/[–—]/g, "-") // en/em dash -> дефис, встречается в части occasions
        .replace(/пасце/g, "пасхе") // архаичное написание в шаблоне дней (weeks:Pascha)
        .replace(/\s*\([^)]*\)\s*/g, " ") // пояснительные скобки: "(о самаряныне)" и т.п.
        .replace(/\s+/g, " ")
        .replace(/[.,;:]+$/g, "")
        .trim();
    // "1-я"/"1-й"/"2-е" -> словом. \b не годится — не работает с кириллицей в JS-regex.
    n = n.replace(/(\d+)-[а-я]{1,2}(?=\s|$)/g, (_, num) => ORDINALS[parseInt(num, 10)] || num);
    for (const [pattern, replacement] of WEEKDAY_SYNONYMS) {
        n = n.replace(pattern, replacement);
    }
    for (const [pattern, replacement] of NAME_SYNONYMS) {
        n = n.replace(pattern, replacement);
    }
    // "Светлый понедельник" (occasion) vs "Понедельник Светлой седмицы" (шаблон) — обратный порядок.
    n = n.replace(/^светл(?:ый|ая)\s+(\S+)$/, (_, day) => `${day} светлой седмицы`);
    return n;
};

// === Числовое сопоставление по циклу (type+value+weekIndex), а не по имени дня. ===
// Обходит проблему традиционных названий (напр. "Неделя о самаряныне" в БД для
// "Неделя 5-я по Пасхе" в occasion) и вариаций формата ("Суббота 27-я по
// Пятидесятнице" без слова "седмицы"). rawClean НЕ проходит через normalize() —
// нам нужна только цифра и слово-день недели, падеж/словоформа не важны.
const rawClean = (s: string): string => s.toLowerCase().trim()
    .replace(/\[\*\]/g, "")
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/(?:^|\s)перед(?=\s)/g, " пред") // "перед"/"пред" — синонимы в occasions
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();

// Пн=1 ... Сб=6 (архаичные и современные формы). \b не используем — см. выше.
const WEEKDAY_WORDS: [RegExp, number][] = [
    [/(?:^|\s)понедельник(?=\s|$)/, 1],
    [/(?:^|\s)вторник(?=\s|$)/, 2],
    [/(?:^|\s)сред[аы](?=\s|$)/, 3],
    [/(?:^|\s)четвер(?:г|ток)(?=\s|$)/, 4],
    [/(?:^|\s)пятниц[аеуы]?(?=\s|$)/, 5],
    [/(?:^|\s)пяток(?=\s|$)/, 5],
    [/(?:^|\s)суббот[аыу](?=\s|$)/, 6], // "у" — винительный ("в субботу N-ю Великого поста")
];

// "N-й и M-й седмиц по Пятидесятнице" -> два самостоятельных сегмента (седмичное
// Марково чтение после 33-й седмицы повторяется по кругу, читается на позиции ОБЕИХ
// недель одновременно — это не одна привязка, а две).
const splitDualWeek = (segment: string): string[] => {
    const m = segment.match(/^(.*?)(\d+)-\S+\s+и\s+(\d+)-\S+\s+седмиц(\s+.*)$/i);
    if (!m) return [segment];
    const [, prefix, n1, n2, suffix] = m;
    return [`${prefix}${n1}-й седмицы${suffix}`, `${prefix}${n2}-й седмицы${suffix}`];
};

const findCircleType = (raw: string): "first" | "Pascha" | "Fast" | null => {
    if (/по\s+пятидесятниц/.test(raw)) return "first";
    if (/по\s+пасхе/.test(raw)) return "Pascha";
    if (/великого\s+поста/.test(raw)) return "Fast";
    return null;
};

// Круг "по Пятидесятнице"/"по Пасхе"/"Великого поста": weekday+"N" -> (type,value,weekIndex).
const resolveCircleNumeric = (segment: string): { type: string; value: number; weekIndex: number } | null => {
    const raw = rawClean(segment);
    const circleType = findCircleType(raw);
    if (!circleType) return null;

    const sundayMatch = raw.match(/(?:^|\s)неделя\s+(\d+)/);
    let value: number;
    let weekIndex: number;
    if (sundayMatch) {
        value = parseInt(sundayMatch[1], 10);
        weekIndex = circleType === "Pascha" ? 0 : 7;
    } else {
        const wd = WEEKDAY_WORDS.find(([re]) => re.test(raw));
        if (!wd) return null;
        const numMatch = raw.match(/(\d+)/);
        if (!numMatch) return null;
        value = parseInt(numMatch[1], 10);
        weekIndex = wd[1];
    }

    const type = circleType === "first" && value === 1 ? "Penticostarion" : circleType;
    return { type, value, weekIndex };
};

// Пред/по Воздвижении — "second" из группы недель по Пятидесятнице, value=-1/0.
const resolveVozdvizhenie = (segment: string): { type: string; value: number; weekIndex: number } | null => {
    const raw = rawClean(segment);
    let value: number;
    if (/пред\s+воздвижением/.test(raw)) value = -1;
    else if (/по\s+воздвижении/.test(raw)) value = 0;
    else return null;

    let weekIndex: number;
    if (/(?:^|\s)неделя(?=\s|$)/.test(raw) && !WEEKDAY_WORDS.some(([re]) => re.test(raw))) {
        weekIndex = value === -1 ? 7 : 0;
    } else {
        const wd = WEEKDAY_WORDS.find(([re]) => re.test(raw));
        if (!wd) return null;
        weekIndex = wd[1];
    }
    return { type: "second", value, weekIndex };
};

// Рождественско-Богоявленский период — "third", value=-3..2.
// -3 праотец / -2 отец: только воскресенье (weekIndex=0, отдельно от соседних дней).
// -1/0/1/2: суббота+воскресенье пред/по Рождестве/Богоявлении (weekIndex 6/7 либо 6/0 —
// см. resolveVozdvizhenie: "пред" считает до конклюдирующего воскресенья, "по" — от ведущего).
const resolveNativityTheophany = (segment: string): { type: string; value: number; weekIndex: number } | null => {
    const raw = rawClean(segment);
    const isSunday = /(?:^|\s)неделя(?=\s|$)/.test(raw) && !WEEKDAY_WORDS.some(([re]) => re.test(raw));
    const wd = WEEKDAY_WORDS.find(([re]) => re.test(raw));

    if (/святых\s+праотец|праотец(?=\s|$)/.test(raw) && isSunday) return { type: "third", value: -3, weekIndex: 0 };
    if (/святых\s+отец/.test(raw) && isSunday) return { type: "third", value: -2, weekIndex: 0 };

    let value: number;
    if (/пред\s+рождеством\s+христовым/.test(raw)) value = -1;
    else if (/по\s+рождестве\s+христовом/.test(raw)) value = 0;
    else if (/пред\s+богоявлением/.test(raw)) value = 1;
    else if (/по\s+богоявлении/.test(raw)) value = 2;
    else return null;

    if (isSunday) return { type: "third", value, weekIndex: value === -1 || value === 1 ? 7 : 0 };
    if (wd && wd[1] === 6) return { type: "third", value, weekIndex: 6 }; // только суббота реально используется
    return null;
};

export interface IMatch { dayId: string; dayName: string; via: string; }

export interface IIndexes {
    movableIndex: Map<string, IMatch[]>;
    numericIndex: Map<string, IMatch[]>;
    fixedIndex: Map<string, IMatch[]>;
}

export const buildIndexes = async (db: Db): Promise<IIndexes> => {
    const movableIndex = new Map<string, IMatch[]>();
    const numericIndex = new Map<string, IMatch[]>();
    const weeks = await db.collection("weeks").find({ type: { $in: WEEK_TYPES } }).toArray();
    const allMovableDayIds = weeks.flatMap(w => w.days || []);
    const movableDays = await db.collection("days").find({ _id: { $in: allMovableDayIds } }).toArray();
    const movableDaysById = new Map(movableDays.map(d => [d._id.toString(), d]));
    for (const w of weeks) {
        for (const dayId of (w.days || [])) {
            const day = movableDaysById.get(dayId.toString());
            if (!day?.name) continue;
            const match: IMatch = { dayId: day._id.toString(), dayName: day.name, via: `weeks:${w.alias}` };

            const key = normalize(day.name);
            const arr = movableIndex.get(key) || [];
            arr.push(match);
            movableIndex.set(key, arr);

            const numKey = `${w.type}:${w.value}:${day.weekIndex}`;
            const numArr = numericIndex.get(numKey) || [];
            numArr.push(match);
            numericIndex.set(numKey, numArr);
        }
    }

    const months = await db.collection("months").find({}).toArray();
    const monthIdToValue = new Map(months.map(m => [m._id.toString(), m.value]));
    const fixedDays = await db.collection("days").find({ monthId: { $exists: true, $ne: null } }).toArray();
    const fixedIndex = new Map<string, IMatch[]>();
    for (const d of fixedDays) {
        const monthValue = monthIdToValue.get(d.monthId?.toString());
        if (!monthValue || !d.monthIndex) continue;
        const key = `${monthValue}:${d.monthIndex}`;
        const arr = fixedIndex.get(key) || [];
        arr.push({ dayId: d._id.toString(), dayName: d.name, via: "calendar" });
        fixedIndex.set(key, arr);
    }

    return { movableIndex, numericIndex, fixedIndex };
};

const monthPattern = Object.keys(MONTHS).join("|");
const dateRegex = new RegExp(`(\\d{1,2})\\s+(${monthPattern})[а-я]*`, "i");

const isRiteOrCommons = (segment: string) => RITE_PATTERNS.some(p => p.test(segment));

// Разбивает occasion на сегменты, готовые к classifySegment (";" верхний уровень +
// разворот "N-й и M-й седмиц").
export const splitOccasion = (occasion: string): string[] =>
    occasion.split(";").map(s => s.trim()).filter(Boolean).flatMap(splitDualWeek);

export type ClassifyResult =
    | { kind: "rite" }
    | { kind: "nonLiturgy" }
    | { kind: "matched"; via: string; matches: IMatch[] }
    | { kind: "unresolved" };

export const classifySegment = (rawSegment: string, idx: IIndexes): ClassifyResult => {
    let segment = rawSegment;

    if (isRiteOrCommons(segment)) return { kind: "rite" };

    if (LITURGY_SUFFIX.test(segment)) {
        segment = segment.replace(LITURGY_SUFFIX, "").trim();
    } else if (NON_LITURGY_SERVICE.test(segment)) {
        return { kind: "nonLiturgy" };
    }

    const dateMatch = segment.match(dateRegex);
    if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const monthPrefix = Object.keys(MONTHS).find(k => dateMatch[2].toLowerCase().startsWith(k));
        const monthValue = monthPrefix ? MONTHS[monthPrefix] : null;
        const found = monthValue ? idx.fixedIndex.get(`${monthValue}:${day}`) : null;
        if (found) return { kind: "matched", via: "fixed", matches: found };
    }

    const rawForFeast = rawClean(segment);
    if (!/(?:^|\s)(пред|по)\s/.test(rawForFeast)) {
        const feast = NAMED_FIXED_FEASTS.find(([re]) => re.test(rawForFeast));
        if (feast) {
            const [, month, day] = feast;
            const found = idx.fixedIndex.get(`${month}:${day}`);
            if (found) return { kind: "matched", via: "named-feast", matches: found };
        }
    }

    const circle = resolveCircleNumeric(segment) || resolveVozdvizhenie(segment) || resolveNativityTheophany(segment);
    if (circle) {
        const found = idx.numericIndex.get(`${circle.type}:${circle.value}:${circle.weekIndex}`);
        if (found) return { kind: "matched", via: `numeric:${circle.type}:${circle.value}:${circle.weekIndex}`, matches: found };
    }

    const candidates = [segment, ...segment.split(",").map(s => s.trim()).filter(Boolean)];
    for (const c of candidates) {
        const found = idx.movableIndex.get(normalize(c));
        if (found) return { kind: "matched", via: "movable", matches: found };
    }

    return { kind: "unresolved" };
};

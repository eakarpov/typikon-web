// ЧТО ЛЕЖИТ В ПОМЯННИКЕ.
//
// Помянник — не список строк, а перечень ЛИЦ: у каждого своё имя, свой чин и
// свои даты, и от них считаются дни, ради которых помянник и заводят. Оттого
// здесь описано лицо целиком, а счёт по нему вынесен в reckoning.
//
// ЧИН ЗАКРЫТЫМ СПИСКОМ, А НЕ СВОБОДНОЙ СТРОКОЙ. Соблазн велик: пусть человек
// пишет что хочет. Но в записке пишут «болящего Николая», и свободное поле
// собрало бы к этому слову диагнозы, обстоятельства смерти и семейные беды —
// сведения, которых сайту знать незачем и хранить нечем. Закрытый список ровно
// та мера, какая нужна записке, и ни на слово больше.
//
// РОДСТВО — ДЛЯ СЕБЯ. «Мама», «крёстный», «сосед» помогают хозяину не спутать
// двух Николаев, но в записку не идут: там поминают по имени, а не по родству.

/** Чин или помета, с какими имя читается в записке. */
export type Rank =
    // мирские
    | "mladenets" | "otrok" | "otrokovitsa" | "bolyashchiy" | "puteshestvuyushchiy"
    | "voin" | "zaklyuchennyy" | "neprazdnaya" | "ubiennyy"
    // священные и монашеские
    | "ierey" | "protoierey" | "ieromonah" | "igumen" | "arhimandrit"
    | "diakon" | "protodiakon" | "monah" | "shimonah" | "inok"
    | "poslushnik" | "arhierey";

export interface RankInfo {
    key: Rank;
    /** Как пишется в помяннике: «младенец». */
    label: string;
    /** Как пишется в записке — родительный падеж: «младенца». */
    genitive: string;
    /**
     * Он же церковнославянским письмом.
     *
     * ЗАСВИДЕТЕЛЬСТВОВАННОЕ, А НЕ ВЫВЕДЕННОЕ. Формы прогнаны через наш же
     * переводчик (lib/cslav) и оставлены только те, что он взял из словаря,
     * Минеи или собрания, — то есть подтверждённые книгой. Пять помет —
     * «болящий», «путешествующий», «заключённый», «непраздная», «убиенный» —
     * подтверждения не нашли: это причастия и прилагательные, которых в
     * словаре лексем нет, а правило дало им русские окончания («болѧщего»
     * вместо «болѧ́щагѡ»). Придумывать за книгу церковнославянское написание
     * мы не станем: `null` здесь значит «не знаем», и записка честно поставит
     * такую помету гражданкой, сказав об этом словами.
     */
    cs: string | null;
    /** Женская форма, если она отдельная. */
    feminine?: { label: string; genitive: string; cs: string | null };
    /** Только живым, только усопшим или всё равно. */
    only?: "living" | "departed";
}

/**
 * Чины со славянскими формами.
 *
 * Родительный падеж записан здесь руками, а не выведен склонением: чинов три
 * десятка, они не меняются, и таблица тут вернее любого правила. Склонение
 * нужно ИМЕНАМ, которых тысячи, — там оно и работает (см. slavonic.ts).
 */
export const RANKS: RankInfo[] = [
    { key: "mladenets", label: "младенец", genitive: "младенца", cs: "младе́нца",
      feminine: { label: "младенца", genitive: "младенцы", cs: "младе́нцы" } },
    { key: "otrok", label: "отрок", genitive: "отрока", cs: "ѻ҆́трока" },
    { key: "otrokovitsa", label: "отроковица", genitive: "отроковицы", cs: "ѻ҆трокови́цы" },
    { key: "bolyashchiy", label: "болящий", genitive: "болящего", cs: null,
      feminine: { label: "болящая", genitive: "болящей", cs: null }, only: "living" },
    { key: "puteshestvuyushchiy", label: "путешествующий", genitive: "путешествующего", cs: null,
      feminine: { label: "путешествующая", genitive: "путешествующей", cs: null }, only: "living" },
    { key: "voin", label: "воин", genitive: "воина", cs: "во́ина" },
    { key: "zaklyuchennyy", label: "заключённый", genitive: "заключённого", cs: null,
      feminine: { label: "заключённая", genitive: "заключённой", cs: null }, only: "living" },
    { key: "neprazdnaya", label: "непраздная", genitive: "непраздной", cs: null, only: "living" },
    { key: "ubiennyy", label: "убиенный", genitive: "убиенного", cs: null,
      feminine: { label: "убиенная", genitive: "убиенной", cs: null }, only: "departed" },

    { key: "arhierey", label: "архиерей", genitive: "архиерея", cs: "а҆рхіере́ѧ" },
    { key: "protoierey", label: "протоиерей", genitive: "протоиерея", cs: "прѡтоїере́ѧ" },
    { key: "ierey", label: "иерей", genitive: "иерея", cs: "і҆ере́ѧ" },
    { key: "protodiakon", label: "протодиакон", genitive: "протодиакона", cs: "прѡтодіа́кона" },
    { key: "diakon", label: "диакон", genitive: "диакона", cs: "дїа́кона" },
    { key: "arhimandrit", label: "архимандрит", genitive: "архимандрита", cs: "а҆рхїмандрі́та" },
    { key: "igumen", label: "игумен", genitive: "игумена", cs: "и҆гꙋ́мена",
      feminine: { label: "игумения", genitive: "игумении", cs: "и҆гꙋ́менїи" } },
    { key: "ieromonah", label: "иеромонах", genitive: "иеромонаха", cs: "і҆еромона́ха" },
    { key: "shimonah", label: "схимонах", genitive: "схимонаха", cs: "схимона́ха",
      feminine: { label: "схимонахиня", genitive: "схимонахини", cs: "схимона́хини" } },
    { key: "monah", label: "монах", genitive: "монаха", cs: "мона́ха",
      feminine: { label: "монахиня", genitive: "монахини", cs: "мона́хини" } },
    { key: "inok", label: "инок", genitive: "инока", cs: "и҆́нока",
      feminine: { label: "инокиня", genitive: "инокини", cs: "и҆ноки́ни" } },
    { key: "poslushnik", label: "послушник", genitive: "послушника", cs: "послꙋ́шника",
      feminine: { label: "послушница", genitive: "послушницы", cs: "послꙋ̑шницы" } },
];

export const RANK_BY_KEY: Record<string, RankInfo> =
    Object.fromEntries(RANKS.map(r => [r.key, r]));

/** Живой или усопший. Помянник тем и устроен, что разворотов два. */
export type PersonKind = "living" | "departed";

/** Мужское или женское — от него зависит форма чина, а не имени. */
export type Sex = "m" | "f" | null;

/**
 * ИМЕНИНЫ, И ПАМЯТИ ЗДЕСЬ ДВУХ РОДОВ.
 *
 * Неподвижная память стоит одним и тем же числом всякий год — её и храним
 * числом, уже переведённым в гражданский календарь. Подвижная ходит вместе с
 * Пасхой, и числа у неё нет вовсе: у Марии Египетской именины в 2026 году
 * придутся на одно число, в 2027-м на другое. Хранить такую числом значило бы
 * записать сегодняшний ответ и выдавать его за будущие — см. предупреждение в
 * начале lib/imeniny/dates.
 *
 * `auto` — посчитано по дню рождения и святцам, пересчитается, если день
 * рождения поправят. `manual` — названо человеком, и трогать это мы не вправе:
 * про своё крещение он знает больше нашего.
 */
export interface NameDay {
    source: "auto" | "manual";
    /**
     * В каком календаре записаны месяц и число.
     *
     * `old` — как в святцах, старым стилем: память приходит оттуда, и хранить её
     * переведённой нельзя. Сдвиг календарей ложится в разные годы по-разному —
     * шестнадцатое февраля старого стиля это первое марта, а в високосный год
     * двадцать девятое февраля, — и заранее переведённое число однажды
     * разошлось бы с месяцесловом.
     *
     * `new` — гражданское число, названное самим человеком.
     */
    style?: "old" | "new";
    month?: number;
    day?: number;
    /** Подвижная память: смещение от Пасхи в днях. Числа у неё нет вовсе. */
    offset?: number;
    /** Кого именно поминают — для карточки и ссылки на святого. */
    saint?: string | null;
}

export interface PomyannikPerson {
    id?: string;
    userId: string;
    /** Как ввёл человек. Его написание мы не переписываем без спроса. */
    name: string;
    /** nameKey(name) — по нему сверка со святцами и поиск повторов. */
    nameKey: string;
    /** Церковная форма, если подсказали и он согласился: «Георгий» при «Юрии». */
    churchName: string | null;
    kind: PersonKind;
    sex: Sex;
    rank: Rank | null;
    /** «мама», «крёстный» — для хозяина помянника, в записку не идёт. */
    relation: string | null;
    born: string | null;
    baptized: string | null;
    died: string | null;
    nameDay: NameDay | null;
    /** Заказанный сорокоуст: сорок литургий подряд со дня заказа. */
    sorokoust: { from: string; where: string | null } | null;
    /** Метки вроде «род», «крестники». Списков отдельной сущностью нет. */
    groups: string[];
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

/** Что приходит на запись: без хозяина, без служебных полей. */
export type PersonInput = Partial<Omit<PomyannikPerson,
    "id" | "userId" | "nameKey" | "createdAt" | "updatedAt">> & { name: string };

export const MAX_PERSONS = 500;
export const MAX_BATCH = 200;

// ТИПЫ ПОМИНОВЕНИЯ.
//
// Записка отличается от записки не именами, а тем, ЧТО над ними совершается, и
// от этого зависит, кого в неё можно вписать. Панихида о живых не служится, и
// молебен об усопших — тоже: это не придирка, а ровно та ошибка, ради которой
// записку и разбирают у свечного ящика.
//
// Длящиеся виды (сорокоуст, полугодие, год, псалтирь) поминают не однажды, а
// весь срок, и оттого у них есть начало и конец, а у разовых нет.

export type NoteKind =
    | "proskomidia" | "moleben" | "panihida"
    | "sorokoust" | "polugodie" | "god" | "psaltir";

export interface NoteKindInfo {
    key: NoteKind;
    label: string;
    /** Кого можно вписать. */
    about: "living" | "departed" | "both";
    /** Сколько дней длится поминовение. 0 — разовое. */
    days: number;
    note: string;
}

export const NOTE_KINDS: NoteKindInfo[] = [
    { key: "proskomidia", label: "Обедня (проскомидия)", about: "both", days: 0,
      note: "поминание на проскомидии — вынимается частица за каждое имя" },
    { key: "moleben", label: "Молебен", about: "living", days: 0,
      note: "о здравии; об усопших молебен не служится" },
    { key: "panihida", label: "Панихида", about: "departed", days: 0,
      note: "заупокойное последование" },
    { key: "sorokoust", label: "Сорокоуст", about: "departed", days: 40,
      note: "сорок литургий подряд" },
    { key: "polugodie", label: "Полугодовое поминовение", about: "departed", days: 182, note: "" },
    { key: "god", label: "Годовое поминовение", about: "departed", days: 365, note: "" },
    { key: "psaltir", label: "Неусыпаемая Псалтирь", about: "both", days: 40,
      note: "чтение Псалтири в монастыре; подаётся и о здравии, и о упокоении" },
];

export const NOTE_KIND_BY_KEY: Record<string, NoteKindInfo> =
    Object.fromEntries(NOTE_KINDS.map(k => [k.key, k]));

/** Сколько имён кладут в одну записку. Больше — уже не записка, а помянник. */
export const MAX_NAMES_IN_NOTE = 20;

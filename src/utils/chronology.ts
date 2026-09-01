// Числа года: индикт, круги, вруцелето, основание, эпакта, ключ границ, эры
// от Сотворения мира.
//
// ПОЧЕМУ ЗДЕСЬ СВОЙ СЧЁТ, А НЕ ЗАПРОС К СЛУЖБЕ. Последование мы не пишем на
// TypeScript и ходим за ним в typikon-rules (src/lib/ordo.ts): устав — живой
// конструктор в полторы тысячи строк, он ещё достраивается, и второй такой
// разошёлся бы с первым на первой же правке правила. С хронологией не так.
// Она ЗАКРЫТА: полтораста строк чистой арифметики, сверенных с печатной
// таблицей Типикона на 532 годах, и меняться им не с чего. А цена запроса
// высока — пособие, которое темнеет, когда на сервере не поднята служба
// на Python, пособием быть перестаёт.
//
// Риск расхождения двух счётов при этом настоящий, и в этом самом проекте он
// уже случался: «минус тринадцать» зашито в calcDay.ts, тогда как рулзы давно
// считают разницу стилей по-честному. Поэтому расхождение здесь ловится не
// обещанием, а сверкой: npm run chronology:diff прогоняет обе стороны по
// широкому промежутку и печатает разницу. Питонова сторона сверена с книгой,
// значит совпадение с ней — это сверка с книгой через одно звено.
//
// Дат JS здесь нет намеренно. Date — местное время, а у нас счёт дней, и одна
// смена часового пояса сдвинула бы вруцелето на сутки. Считаем в целых днях
// (юлианский день), а календарные числа отдаём разложенными.

/** Календарное число, разложенное: год, месяц (1–12), день. Без часовых поясов. */
export interface Ymd {
    year: number;
    month: number;
    day: number;
}

const div = (a: number, b: number) => Math.floor(a / b);

// --------------------------------------------------------------- дни счётом

/** Юлианская дата -> юлианский день (целое число суток). */
export const julianToJdn = ({ year, month, day }: Ymd): number => {
    const a = div(14 - month, 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + div(153 * m + 2, 5) + 365 * y + div(y, 4) - 32083;
};

/** Обратно: юлианский день -> дата юлианского счёта. */
export const jdnToJulian = (jdn: number): Ymd => {
    const c = jdn + 32082;
    const d = div(4 * c + 3, 1461);
    const e = c - div(1461 * d, 4);
    const m = div(5 * e + 2, 153);
    return {
        year: d - 4800 + div(m, 10),
        month: m + 3 - 12 * div(m, 10),
        day: e - div(153 * m + 2, 5) + 1,
    };
};

/** Гражданская (григорианская) дата -> юлианский день. */
export const gregorianToJdn = ({ year, month, day }: Ymd): number => {
    const a = div(14 - month, 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + div(153 * m + 2, 5) + 365 * y + div(y, 4) - div(y, 100) + div(y, 400) - 32045;
};

/** Обратно: юлианский день -> гражданская дата. */
export const jdnToGregorian = (jdn: number): Ymd => {
    const a = jdn + 32044;
    const b = div(4 * a + 3, 146097);
    const c = a - div(146097 * b, 4);
    const d = div(4 * c + 3, 1461);
    const e = c - div(1461 * d, 4);
    const m = div(5 * e + 2, 153);
    return {
        year: 100 * b + d - 4800 + div(m, 10),
        month: m + 3 - 12 * div(m, 10),
        day: e - div(153 * m + 2, 5) + 1,
    };
};

export const WEEKDAYS = [
    "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье",
] as const;

export type Weekday = typeof WEEKDAYS[number];

/**
 * День недели по юлианскому дню. Понедельник первый — тем же счётом, каким
 * идёт WEEKDAYS. Календарь один и тот же для обоих стилей: смена стиля
 * переименовывает числа, а не переставляет дни.
 */
export const weekdayOf = (jdn: number): Weekday => WEEKDAYS[(jdn + 0) % 7];

// ------------------------------------------------------------------ пасхалия

/**
 * Пасха александрийской (юлианской) пасхалии — юлианским днём.
 * Григорианской пасхалии здесь нет: ею живёт одна Финляндская Церковь.
 */
export const paschaJdn = (adYear: number): number => {
    const a = adYear % 4;
    const b = adYear % 7;
    const c = adYear % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = div(d + e + 114, 31); // 3 — март, 4 — апрель
    const day = ((d + e + 114) % 31) + 1;
    return julianToJdn({ year: adYear, month, day });
};

// ---------------------------------------------------------------------- эры

export const ERA_STYLES = ["martovskiy", "sentyabrskiy", "ultramartovskiy"] as const;
export type EraStyle = typeof ERA_STYLES[number];

export const ERA_LABELS: Record<EraStyle, string> = {
    martovskiy: "мартовский",
    sentyabrskiy: "сентябрьский",
    ultramartovskiy: "ультрамартовский",
};

// Когда у стиля начинается год и на сколько его лето обгоняет год от
// Рождества. Мартовское лето N пошло с 1 марта года N−5508, сентябрьское —
// с 1 сентября года N−5509, ультрамартовское обгоняет мартовское на год.
const ERA_START: Record<EraStyle, { month: number; day: number; shift: number }> = {
    martovskiy: { month: 3, day: 1, shift: 5508 },
    sentyabrskiy: { month: 9, day: 1, shift: 5509 },
    ultramartovskiy: { month: 3, day: 1, shift: 5509 },
};

export interface Span {
    first: number; // юлианский день первого дня лета
    last: number;  // и последнего
}

/**
 * Границы лета названного стиля. Отдаётся ПРОМЕЖУТОК, а не год: лето любого
 * стиля лежит на двух годах от Рождества, и который из них имеется в виду,
 * решает месяц записи, а не эра.
 */
export const letoSpan = (leto: number, style: EraStyle): Span => {
    const { month, day, shift } = ERA_START[style];
    return {
        first: julianToJdn({ year: leto - shift, month, day }),
        last: julianToJdn({ year: leto - shift + 1, month, day }) - 1,
    };
};

/** Обратно: в каком лете названного стиля лежит день. */
export const letoOf = (jdn: number, style: EraStyle): number => {
    const { month, day, shift } = ERA_START[style];
    const j = jdnToJulian(jdn);
    const started = j.month > month || (j.month === month && j.day >= day);
    return j.year + shift - (started ? 0 : 1);
};

// -------------------------------------------------------------------- круги
//
// ВСЕ ФУНКЦИИ КРУГОВ БЕРУТ ЛЕТО КНИЖНОГО СЧЁТА — то, каким подписан великий
// индиктион: год от Рождества плюс 5508. Мартовское лето совпадает с ним
// числом, а УЛЬТРАМАРТОВСКОЕ ОБГОНЯЕТ НА ЕДИНИЦУ, и подставить его сюда
// напрямую значит сдвинуть все семь чисел на год. Лето источника сюда не
// подставляется: сперва letoSpan разворачивает его в промежуток дней, а числа
// берутся у года, в котором день лежит (marksOfJdn).

/** Индикт 1–15. Счёт общепринятый — тот, которым подписаны грамоты. */
export const indikt = (leto: number): number => ((leto - 1) % 15) + 1;

/** Круг Солнцу 1–28: за 28 лет юлианские числа возвращаются на те же дни недели. */
export const krugSolntsu = (leto: number): number => ((leto - 1) % 28) + 1;

/** Круг Луне 1–19: метонов цикл, фазы луны возвращаются на те же числа. */
export const krugLune = (leto: number): number => ((leto - 1) % 19) + 1;

export const vysokosniy = (leto: number): boolean => krugSolntsu(leto) % 4 === 0;

export const VRUTSELETO_LETTERS = ["А", "В", "Г", "Д", "Е", "Ѕ", "З"] as const;

/**
 * Вруцелето 1–7. Год круга начинается 1 марта: январь и февраль держат
 * вруцелето предыдущего лета. Вруцелето 1 — то лето, у которого 1 марта
 * юлианского счёта пришлось на пятницу.
 */
export const vrutseleto = (leto: number): number => {
    const march = julianToJdn({ year: leto - 5508, month: 3, day: 1 });
    return (((march + 0) % 7) - 4 + 7) % 7 + 1;
};

export const vrutseletoLetter = (leto: number): string =>
    VRUTSELETO_LETTERS[vrutseleto(leto) - 1];

// Основание — возраст луны на начало года, растёт на 11 в год: столько
// солнечный год длиннее двенадцати лунных месяцев. На переходе к кругу Луне 17
// шаг на единицу больше — лунный скачок, без него круг не замкнулся бы: 18
// шагов по 11 и один по 12 дают ровно 210, то есть ноль по тридцати.
const SALTUS_AFTER = 16;

export const osnovanie = (leto: number): number => {
    const k = krugLune(leto);
    return ((11 * k + 2 + (k > SALTUS_AFTER ? 1 : 0)) % 30) + 1;
};

/** Эпакта — дополнение основания до двадцати одного. */
export const epakta = (leto: number): number => ((21 - osnovanie(leto)) % 30 + 30) % 30;

// ------------------------------------------------------------- ключ границ

// Тридцать пять ключевых букв — по одной на каждый возможный день Пасхи от
// 22 марта до 25 апреля юлианского счёта. Взяты из зрячей пасхалии Типикона
// (гл. 63) и сверены с нашим счётом Пасхи.
export const KLYUCH_LETTERS = [
    "А", "Б", "В", "Г", "Д", "Е", "Ж", "Ѕ", "З", "И", "І", "К", "Л", "М", "Н",
    "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ѿ", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы",
    "Ь", "Ѣ", "Ю", "Ѫ", "Ѧ",
] as const;

/** Ключ границ — буква, которой подписан весь год; она одна задаёт Пасху. */
export const klyuchGranits = (leto: number): string => {
    const p = jdnToJulian(paschaJdn(leto - 5508));
    const index = p.month === 3 ? p.day - 22 : 10 + p.day - 1;
    if (index < 0 || index >= KLYUCH_LETTERS.length) {
        throw new Error(`Пасха ${p.day}.${p.month} вне границ 22.03–25.04`);
    }
    return KLYUCH_LETTERS[index];
};

/** Обратно: дата Пасхи юлианского счёта по ключевой букве. */
export const paschaOfKlyuch = (letter: string): { month: number; day: number } => {
    const index = KLYUCH_LETTERS.indexOf(letter as typeof KLYUCH_LETTERS[number]);
    if (index < 0) throw new Error(`нет такой ключевой буквы: ${letter}`);
    return index < 10 ? { month: 3, day: 22 + index } : { month: 4, day: index - 9 };
};

// ------------------------------------------------------ всё о лете разом

export interface YearMarks {
    leto: number;
    indikt: number;
    krugSolntsu: number;
    krugLune: number;
    vrutseleto: number;
    vrutseletoLetter: string;
    osnovanie: number;
    epakta: number;
    klyuchGranits: string;
    vysokosniy: boolean;
    paschaJdn: number;
}

/** Все семь чисел лета книжного счёта. */
export const yearMarks = (leto: number): YearMarks => ({
    leto,
    indikt: indikt(leto),
    krugSolntsu: krugSolntsu(leto),
    krugLune: krugLune(leto),
    vrutseleto: vrutseleto(leto),
    vrutseletoLetter: vrutseletoLetter(leto),
    osnovanie: osnovanie(leto),
    epakta: epakta(leto),
    klyuchGranits: klyuchGranits(leto),
    vysokosniy: vysokosniy(leto),
    paschaJdn: paschaJdn(leto - 5508),
});

/**
 * Числа года, в котором лежит день. Единственный безопасный вход при разборе
 * источника: стиль уже отработал в letoSpan, а у дня эры нет.
 *
 * Порог — 1 марта. Твёрдо здесь только то, что январь и февраль отходят
 * предыдущему году круга; сентябрьский порог сверкой не отвергнут, и если
 * книга его подтвердит, править эту одну строку.
 */
export const marksOfJdn = (jdn: number): YearMarks => {
    const j = jdnToJulian(jdn);
    return yearMarks(j.year + 5508 - (j.month < 3 ? 1 : 0));
};

// -------------------------------------------------- новоюлианский календарь
//
// Календарь Миланковича, принятый в 1923 году Константинополем и за ним
// Грецией, Румынией, Болгарией, Антиохией, ПЦА и с 2023 года ПЦУ. Високос —
// как в юлианском, но столетний год високосен, только если даёт при делении
// на 900 остаток 200 или 600. Отсюда его точность: 218 високосов на 900 лет
// против григорианских 218 на 900 (97 на 400), и расхождение с астрономией
// набегает медленнее.
//
// В НЕПОДВИЖНОМ КРУГЕ ЭТИХ ЦЕРКВЕЙ ОН И СТОИТ, А ПАСХАЛИЯ У НИХ ОСТАЛАСЬ
// АЛЕКСАНДРИЙСКОЙ. Отсюда всё своеобразие их года: неподвижные праздники
// уехали к гражданскому счёту, подвижные остались при юлианском. Здесь —
// только перевод чисел; что из этого следует для устава, решается не тут.

export const isRevisedJulianLeap = (year: number): boolean =>
    year % 4 === 0 && (year % 100 !== 0 || year % 900 === 200 || year % 900 === 600);

// Сколько високосов среди годов 1..y. Столетние сперва вычитаются все, потом
// возвращаются те, что попали в остаток 200 или 600: все они кратны четырём
// (900 делится на 4), так что возврат ничего лишнего не захватывает.
const rjLeapsUpTo = (year: number): number => {
    const centurials = (rest: number) =>
        year < rest ? 0 : div(year - rest, 900) + 1;
    return div(year, 4) - div(year, 100) + centurials(200) + centurials(600);
};

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const rjDayNumber = ({ year, month, day }: Ymd): number => {
    let n = 365 * (year - 1) + rjLeapsUpTo(year - 1);
    for (let m = 1; m < month; m += 1) {
        n += MONTH_LENGTHS[m - 1] + (m === 2 && isRevisedJulianLeap(year) ? 1 : 0);
    }
    return n + day - 1;
};

// Привязка счёта к юлианскому дню. Берём не выдуманное число, а совпадение:
// новоюлианский календарь СОВПАДАЕТ с григорианским с 1 марта 1600 по
// 28 февраля 2800, и 1 января 2000 лежит внутри этого промежутка.
const RJ_EPOCH_JDN = gregorianToJdn({ year: 2000, month: 1, day: 1 })
    - rjDayNumber({ year: 2000, month: 1, day: 1 });

export const revisedJulianToJdn = (ymd: Ymd): number => rjDayNumber(ymd) + RJ_EPOCH_JDN;

export const jdnToRevisedJulian = (jdn: number): Ymd => {
    const n = jdn - RJ_EPOCH_JDN;
    // Год прикидываем по средней длине и доводим шагом: календарь монотонен,
    // и промах бывает не больше чем на год.
    let year = Math.max(1, div(n, 365) + 1);
    while (rjDayNumber({ year, month: 1, day: 1 }) > n) year -= 1;
    while (rjDayNumber({ year: year + 1, month: 1, day: 1 }) <= n) year += 1;
    let rest = n - rjDayNumber({ year, month: 1, day: 1 });
    let month = 1;
    for (;;) {
        const length = MONTH_LENGTHS[month - 1]
            + (month === 2 && isRevisedJulianLeap(year) ? 1 : 0);
        if (rest < length) break;
        rest -= length;
        month += 1;
    }
    return { year, month, day: rest + 1 };
};

// ------------------------------------- александрийский (коптский) календарь
//
// Двенадцать месяцев ровно по тридцати дней и пять добавочных в конце —
// эпагомены; в високосном году их шесть. Год начинается 1 тота, а это 29
// августа юлианского счёта: календарь привязан к юлианскому, а не к солнцу,
// и потому уезжает вместе с ним. Високос свой: год, дающий при делении на
// четыре остаток три, — то есть тот, что стоит ПЕРЕД юлианским високосным.
//
// Имена месяцев даны в греческом виде (Тот, Фаофи, Атир...), а не в коптском
// или арабском. Не из предпочтения: в этом виде они стоят у византийских
// хронистов и в русских хронологических пособиях, а сюда ходят как раз за
// сверкой с ними.

export const COPTIC_MONTHS = [
    "тот", "фаофи", "атир", "хойак", "тиби", "мехир",
    "фаменот", "фармути", "пахон", "пайни", "эпифи", "месори",
    "эпагомены",
] as const;

/** Эра мучеников (Диоклетиана): 1 тота 1 года — 29 августа 284 юлианского счёта. */
const COPTIC_EPOCH_JDN = julianToJdn({ year: 284, month: 8, day: 29 });

// Строй у коптского и эфиопского календарей ОДИН: двенадцать месяцев по
// тридцати дней, тринадцатый месяц из эпагоменов, високос у года с остатком
// три от деления на четыре. Разнятся только эпоха и имена месяцев. Писать эту
// арифметику дважды значило бы завести второе место, где она может разойтись
// сама с собой, — а этого в проекте уже хватало.
const isEgyptianLeap = (year: number): boolean => year % 4 === 3;

const egyptianToJdn = (epoch: number, { year, month, day }: Ymd): number =>
    epoch + 365 * (year - 1) + div(year, 4) + (month - 1) * 30 + day - 1;

const jdnToEgyptian = (epoch: number, jdn: number): Ymd | null => {
    if (jdn < epoch) return null;
    const n = jdn - epoch;
    // 1461 день — ровно четыре года такого строя: три по 365 и один по 366.
    const cycles = div(n, 1461);
    let rest = n - cycles * 1461;
    let year = cycles * 4 + 1;
    while (rest >= (isEgyptianLeap(year) ? 366 : 365)) {
        rest -= isEgyptianLeap(year) ? 366 : 365;
        year += 1;
    }
    return { year, month: div(rest, 30) + 1, day: (rest % 30) + 1 };
};

export const isCopticLeap = isEgyptianLeap;

/** Коптская дата: месяц 1–13, тринадцатый — эпагомены (5 дней, в високосе 6). */
export const copticToJdn = (ymd: Ymd): number => egyptianToJdn(COPTIC_EPOCH_JDN, ymd);

/**
 * Коптская дата дня — или null, если день старше эры мучеников.
 *
 * Продолжать счёт назад за 284 год нулевым и отрицательными годами формально
 * можно, и арифметика бы не заметила. Но «29 тота −5 года» — не дата, а вид
 * даты: ни один источник так не датирован, и показать это читателю значит
 * выдать за перевод то, чего не переводили. Молчание здесь честнее числа.
 */
export const jdnToCoptic = (jdn: number): Ymd | null =>
    jdnToEgyptian(COPTIC_EPOCH_JDN, jdn);

/** Сколько дней в году египетского строя: 365, а в високосном 366. */
export const copticYearLength = (year: number) => (isEgyptianLeap(year) ? 366 : 365);

// ------------------------------------------------------ эфиопский календарь
//
// Тот же строй, что у коптского, и то же начало года — 1 мескерема приходится
// на тот же день, что 1 тота. Разнится счёт лет: эра благодати (Воплощения)
// пошла с 8 года, а не с 284-го, и потому эфиопский год на 276 больше
// коптского и на семь-восемь меньше года от Рождества. Календарь живой:
// Эфиопская Церковь служит по нему.

export const ETHIOPIAN_MONTHS = [
    "мескерем", "тэкэмт", "хэдар", "тахсас", "тэр", "якатит",
    "магабит", "миязия", "гэнбот", "сэнэ", "хамле", "нэхасе",
    "пагумен",
] as const;

/** Эра благодати: 1 мескерема 1 года — 29 августа 8 года юлианского счёта. */
const ETHIOPIAN_EPOCH_JDN = julianToJdn({ year: 8, month: 8, day: 29 });

export const ethiopianToJdn = (ymd: Ymd): number =>
    egyptianToJdn(ETHIOPIAN_EPOCH_JDN, ymd);

export const jdnToEthiopian = (jdn: number): Ymd | null =>
    jdnToEgyptian(ETHIOPIAN_EPOCH_JDN, jdn);

// ------------------------------------------------------- армянский календарь
//
// Двенадцать месяцев по тридцати дней и пять добавочных — и ВСЁ: ровно 365
// дней, високоса нет вовсе. Оттого год не стоит на месте, а уходит назад на
// сутки каждые четыре года и обходит все времена года кругом за 1461 год —
// столько же, сколько 1460 юлианских лет день в день. Это единственный
// здешний календарь, не привязанный ни к солнцу, ни к юлианскому счёту, и
// потому единственный, чьё начало года нельзя проверить постоянным числом.
//
// Взят древний (Большой) счёт — тот, которым датированы рукописи. Позднейший
// исправленный, с високосом, здесь НЕ реализован: это отдельный календарь, а
// не поправка к этому.

export const ARMENIAN_MONTHS = [
    "навасард", "хори", "сахми", "тре", "кахоц", "арац",
    "мехекан", "арег", "ахекан", "марери", "маргац", "хротиц",
    "авельяц",
] as const;

/** Армянская эра: 1 навасарда 1 года — 11 июля 552 года юлианского счёта. */
const ARMENIAN_EPOCH_JDN = julianToJdn({ year: 552, month: 7, day: 11 });

export const ARMENIAN_YEAR_DAYS = 365;

/** Армянская дата: месяц 1–13, тринадцатый — авельяц, всегда пять дней. */
export const armenianToJdn = ({ year, month, day }: Ymd): number =>
    ARMENIAN_EPOCH_JDN + ARMENIAN_YEAR_DAYS * (year - 1) + (month - 1) * 30 + day - 1;

export const jdnToArmenian = (jdn: number): Ymd | null => {
    if (jdn < ARMENIAN_EPOCH_JDN) return null;
    const n = jdn - ARMENIAN_EPOCH_JDN;
    const rest = n % ARMENIAN_YEAR_DAYS;
    return {
        year: div(n, ARMENIAN_YEAR_DAYS) + 1,
        month: div(rest, 30) + 1,
        day: (rest % 30) + 1,
    };
};

// Александрийская эра (эра Анниана) — второй счёт лет от Сотворения мира,
// стоявший рядом с константинопольским и разошедшийся с ним на шестнадцать
// лет. Год у неё начинается там же, где коптский, — 1 тота, — и потому она
// выражается через него одним слагаемым: 1-й коптский год начался 29 августа
// 284 года, а это по александрийскому счёту 5777-е лето (284 + 5493).
const ALEXANDRIAN_OVER_COPTIC = 5493 + 284 - 1;

/**
 * Лето от Сотворения мира александрийским счётом — или null до эры мучеников.
 *
 * Сама-то эра Анниана уходит далеко назад, и лето её считается для любого дня;
 * но выражена она здесь через коптский год, а тот раньше 284 года не начат.
 * Понадобятся даты старше — считать придётся от своей эпохи, а не через копта.
 */
export const alexandrianLeto = (jdn: number): number | null => {
    const coptic = jdnToCoptic(jdn);
    return coptic && coptic.year + ALEXANDRIAN_OVER_COPTIC;
};

// ------------------------------------------------------ грузинский короникон
//
// Грузинские источники датируют не годом, а НОМЕРОМ ГОДА ВНУТРИ 532-летнего
// круга: короникон 1..532, и по кругу заново. Число то же самое, что у нашего
// великого индиктиона (532 = 28 × 19), и арифметика та же.
//
// НО КРУГ НЕ ТОТ ЖЕ. Это надо сказать прямо, потому что соблазн велик:
// византийский миротворный круг пошёл с 1941 года (лето 7449, где круг Солнцу
// и круг Луне оба первые), а грузинские круги идут с 781, 1313, 1845 —
// девяносто шесть лет в сторону. Общая у них длина и устройство, а фаза
// разная, и подставлять одно вместо другого нельзя.
//
// ОТСЮДА ЖЕ ГЛАВНАЯ ТРУДНОСТЬ ИСТОЧНИКА: короникон сам по себе не датирует.
// «Короникон 359» — это и 1139, и 1671, и 2203 год; какой круг имеется в виду,
// решает историк по обстоятельствам записи. Обратный ход поэтому отдаёт СПИСОК
// годов, а не год.
//
// НАЧАЛО ГОДА ЗДЕСЬ НЕ УЧТЕНО. Короникон считается от юлианского года, то есть
// с января. Грузинские источники указывают на осеннее начало (по византийскому
// обычаю), и если оно подтвердится, у дат сентября–декабря номер сдвинется на
// единицу. Проверяется это не арифметикой, а датированными надписями; до тех
// пор здесь стоит январский порог, и менять придётся одну строку.

export const KORONIKON_CYCLE = 532;

// Смещение выведено из общепринятых границ кругов (781–1312, 1313–1844,
// 1845–2376): при нём короникон 781 года равен единице, а 1312 — 532.
const KORONIKON_SHIFT = 5603;

/** Короникон 1..532 юлианского года. */
export const koronikon = (julianYear: number): number =>
    ((julianYear + KORONIKON_SHIFT) % KORONIKON_CYCLE + KORONIKON_CYCLE)
    % KORONIKON_CYCLE + 1;

export const koronikonOf = (jdn: number): number => koronikon(jdnToJulian(jdn).year);

/** Первый и последний год круга, в котором лежит этот юлианский год. */
export const koronikonCycle = (julianYear: number): { first: number; last: number } => {
    const first = julianYear - koronikon(julianYear) + 1;
    return { first, last: first + KORONIKON_CYCLE - 1 };
};

/** Обратный ход: годы промежутка, у которых такой короникон. Их несколько. */
export const koronikonYears = (value: number, firstAd: number, lastAd: number): number[] => {
    const out: number[] = [];
    for (let year = firstAd; year <= lastAd; year += 1) {
        if (koronikon(year) === value) out.push(year);
    }
    return out;
};

// ------------------------------------------------------- селевкидская эра
//
// Эра Александра, она же селевкидская: счёт лет поверх юлианского, не свой
// календарь. Ею датированы сирийские рукописи, и сиро-яковиты пользуются ею
// до сих пор.
//
// Год начинается 1 ОКТЯБРЯ — так считают сирийцы, и это тот счёт, в котором
// стоят рукописи. Существовал и македонский, весенний, с началом в нисане; он
// здесь НЕ РЕАЛИЗОВАН и не приближен апрелем: нисан — месяц лунный, и подмена
// его гражданским числом дала бы точность, которой нет. Понадобится — заводить
// отдельным счётом, а не поправкой к этому.

/** Год селевкидской эры (сирийский, октябрьский счёт). */
export const seleucid = ({ year, month }: Ymd): number => year + (month >= 10 ? 312 : 311);

export const seleucidOf = (jdn: number): number => seleucid(jdnToJulian(jdn));

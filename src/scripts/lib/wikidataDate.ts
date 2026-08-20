// Wikidata отдаёт даты как ISO 8601 (year precision тоже сериализуется как "0830-01-01T00:00:00Z")
// плюс отдельно точность (wikibase:timePrecision: 11=день, 10=месяц, 9=год, 8=десятилетие, 7=век).
// Без учёта точности "0830-01-01" выглядит как настоящая дата 1 января, хотя на деле известен только год.
const RU_MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const toRomanCentury = (century: number) => {
    const romanDigits: [number, string][] = [
        [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
        [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
        [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    let n = century;
    let out = "";
    for (const [value, symbol] of romanDigits) {
        while (n >= value) {
            out += symbol;
            n -= value;
        }
    }
    return out;
};

export const parseIsoDate = (iso: string) => {
    const m = iso.match(/^(-?\d+)-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
};

export const extractYearFromIso = (iso?: string | null) => parseIsoDate(iso ?? "")?.year;

// precision: Wikidata wikibase:timePrecision (11=день, 10=месяц, 9=год, 8=десятилетие, 7=век, ниже — реже).
export const formatWikidataDate = (iso: string, precision: number): string => {
    const parsed = parseIsoDate(iso);
    if (!parsed) return iso;
    const { year, month, day } = parsed;
    if (precision >= 11) return `${day} ${RU_MONTHS[month - 1]} ${year}`;
    if (precision === 10) return `${RU_MONTHS[month - 1]} ${year}`;
    if (precision === 9) return `${year}`;
    if (precision === 8) return `${Math.floor(year / 10) * 10}-е`;
    if (precision === 7) return `${toRomanCentury(Math.ceil(year / 100))} век`;
    return `${year}`;
};

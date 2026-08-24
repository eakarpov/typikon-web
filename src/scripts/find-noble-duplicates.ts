// Ищет дублирующиеся записи nobles — последствие мерджа ствола Wikidata: короткое руками введённое
// имя ("Ярослав") и полное каноническое из Wikidata ("Ярослав Владимирович Мудрый") не совпадали
// побуквенно, из-за чего вместо обогащения создавалась вторая запись того же человека (см. чат:
// найдено на Владимире Великом через сверку с dneslov.org).
//
// Правило: разное ОТЧЕСТВО почти всегда значит разного человека (разный отец) — даже если имя и
// годы жизни похожи. Поэтому сравниваем не префиксы имени целиком, а корень отчества (без суффиксов
// -ович/-евич/-ич/-овна/-евна/-на), плюс сверка по годам. Ничего не пишет в живые таблицы — только
// staging_noble_duplicates на ревью.
//
// Запуск: npm run nobles:find-duplicates
import "@/scripts/lib/env";
import { init } from "@/lib/sqlite";
import { normalizeName, normalizeFull } from "@/scripts/lib/textNormalize";

type Noble = {
    id: number;
    name: string;
    birthDateMarker: number | null;
    deathDateMarker: number | null;
    churchName: string | null;
    csName: string | null;
    nickName: string | null;
    info: string | null;
    links: string | null;
};

const PATRONYMIC_SUFFIXES = ["ович", "евич", "овна", "евна", "ич", "на"];
const stripPatronymicSuffix = (token: string) => {
    for (const suf of PATRONYMIC_SUFFIXES) {
        if (token.endsWith(suf) && token.length > suf.length + 2) return token.slice(0, -suf.length);
    }
    return token;
};

const nameTokens = (name: string) => normalizeName(name).split(" ").filter(Boolean);

// Насколько заполнена запись — используем как эвристику выбора канонической при равенстве прочего.
const richness = (n: Noble) =>
    (n.churchName ? 1 : 0) + (n.csName ? 1 : 0) + (n.nickName ? 1 : 0) + (n.info ? 1 : 0) + (n.links && n.links !== "[]" ? 1 : 0);

async function main() {
    const db = await init();
    const nobles = db
        .prepare(`select id, name, birthDateMarker, deathDateMarker, churchName, csName, nickName, info, links from nobles`)
        .all() as Noble[];
    console.log(`Всего персон: ${nobles.length}`);

    const byGivenName = new Map<string, Noble[]>();
    for (const n of nobles) {
        if (!n.name) continue;
        const tokens = nameTokens(n.name);
        if (tokens.length === 0) continue;
        const given = tokens[0];
        byGivenName.set(given, [...(byGivenName.get(given) ?? []), n]);
    }

    type Candidate = { a: Noble; b: Noble; confidence: "confirmed" | "name-only" };
    const candidates: Candidate[] = [];

    for (const group of byGivenName.values()) {
        if (group.length < 2) continue;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const a = group[i];
                const b = group[j];
                const tokensA = nameTokens(a.name);
                const tokensB = nameTokens(b.name);
                // Регнальный номер ("III", "I") — не отчество. У русских князей встречается порядок
                // "Имя Номер Отчество Прозвище" (Иван I Данилович Калита) — тогда отчество съезжает на
                // третий токен; без этого сдвига "Иван I .../"Иван II .../"Иван III ..." с РАЗНЫМИ
                // отчествами (Данилович/Иванович/Васильевич) считались бы безотчественными и схлопывались
                // вслепую друг с другом и с любым другим Иваном.
                const isOrdinal = (t: string) => /^[ivxlcdm]+$/.test(t);
                const patronymicOf = (tokens: string[]) => {
                    const idx = tokens[1] && isOrdinal(tokens[1]) ? 2 : 1;
                    return tokens[idx] && !isOrdinal(tokens[idx]) ? stripPatronymicSuffix(tokens[idx]) : null;
                };
                const patronA = patronymicOf(tokensA);
                const patronB = patronymicOf(tokensB);

                // Разное отчество -> разные люди, не кандидат вообще (даже если имя и годы совпали).
                if (patronA && patronB && patronA !== patronB) continue;

                // "Голое" имя без отчества и без единой даты (просто "Александр") не даёт вообще никакой
                // зацепки — при масштабе базы оно совпадёт по первому токену буквально со всеми тёзками
                // за тысячу лет и в разных странах. Без хотя бы одного опознавательного признака с ОБЕИХ
                // сторон в кандидаты не берём — такое требует ручной атрибуции отдельно, не фаззи-дедупа.
                const isBare = (n: Noble, tokens: string[]) => tokens.length < 2 && !n.birthDateMarker && !n.deathDateMarker;
                if (isBare(a, tokensA) || isBare(b, tokensB)) continue;

                // Если у обеих сторон известна и рождения, и смерти дата — обе должны совпасть (иначе
                // "совпал год рождения, а смерть разошлась на 12 лет" ложно проходило бы как дубль).
                // Допуск на рождение шире (±4) — год рождения для раннесредневековых персон часто
                // расходится в источниках на несколько лет (Владимир Великий: 956 в одной записи,
                // 960 в другой), тогда как год смерти правителя обычно куда точнее задокументирован.
                // Если известна только одна из двух дат — сверяем по ней с обычным допуском ±2.
                const bothBirth = a.birthDateMarker && b.birthDateMarker;
                const bothDeath = a.deathDateMarker && b.deathDateMarker;
                let datesOverlap: boolean;
                if (bothBirth && bothDeath) {
                    datesOverlap = Math.abs(a.birthDateMarker! - b.birthDateMarker!) <= 4 && Math.abs(a.deathDateMarker! - b.deathDateMarker!) <= 2;
                } else if (bothDeath) {
                    datesOverlap = Math.abs(a.deathDateMarker! - b.deathDateMarker!) <= 2;
                } else if (bothBirth) {
                    datesOverlap = Math.abs(a.birthDateMarker! - b.birthDateMarker!) <= 2;
                } else {
                    datesOverlap = false;
                }

                const eitherDateless =
                    (!a.birthDateMarker && !a.deathDateMarker) || (!b.birthDateMarker && !b.deathDateMarker);

                if (!datesOverlap && !eitherDateless) continue; // даты есть у обоих, но разные -> разные люди

                // Подтверждаем без сомнений в трёх случаях: (1) настоящее совпадение отчества + даты,
                // (2) полностью идентичная нормализованная строка имени (совпадение случайно быть не
                // может), (3) короткое безотчественное имя ("Игорь") против кого угодно — но только
                // если при этом ОБЕ даты (рождение и смерть) известны и совпадают почти точно, а не
                // "какая-то одна из двух" — иначе легендарное "Игорь" схлопнется с любым тёзкой.
                const exactNameMatch = normalizeFull(a.name) === normalizeFull(b.name);
                const bothDatesTight =
                    bothBirth && bothDeath && Math.abs(a.birthDateMarker! - b.birthDateMarker!) <= 1 && Math.abs(a.deathDateMarker! - b.deathDateMarker!) <= 1;
                const patronymicConfirmed = datesOverlap && patronA !== null && patronA === patronB;
                const confidence: Candidate["confidence"] =
                    patronymicConfirmed || exactNameMatch || bothDatesTight ? "confirmed" : "name-only";
                candidates.push({ a, b, confidence });
            }
        }
    }

    console.log(`Кандидатов на дубли: ${candidates.length}`);
    console.log(`  подтверждено (совпало отчество + год): ${candidates.filter((c) => c.confidence === "confirmed").length}`);
    console.log(`  только по имени/годам (нужна ручная проверка): ${candidates.filter((c) => c.confidence === "name-only").length}`);

    const now = new Date().toISOString();
    const insertBatch = db.prepare(`insert into import_batches (source, label, createdAt) values (?, ?, ?)`);
    const insertDup = db.prepare(`
        insert into staging_noble_duplicates (batchId, canonicalNobleId, duplicateNobleId, canonicalName, duplicateName, confidence, status)
        values (?, ?, ?, ?, ?, ?, 'pending')
    `);

    const run = db.transaction(() => {
        const batchId = insertBatch.run("dedup", `Поиск дублей персон, ${now.slice(0, 10)}`, now).lastInsertRowid as number;
        for (const c of candidates) {
            // Каноническая — та, что богаче заполнена; при равенстве — с меньшим id (раньше введена руками).
            const [canonical, duplicate] =
                richness(c.a) >= richness(c.b) ? [c.a, c.b] : richness(c.b) > richness(c.a) ? [c.b, c.a] : c.a.id < c.b.id ? [c.a, c.b] : [c.b, c.a];
            insertDup.run(batchId, canonical.id, duplicate.id, canonical.name, duplicate.name, c.confidence);
        }
        return batchId;
    });

    const batchId = run();
    console.log(`\nДальше — ревью в /admin/nobles/import/${batchId}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

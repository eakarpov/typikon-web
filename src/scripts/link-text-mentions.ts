// Ищет кандидатов на texts.mentionIds — "в этом чтении упоминается вот этот святой".
//
// СТАТУС: исследовательский. Автоматически проставлять связи ПОКА НЕЛЬЗЯ — точность
// атрибуции недостаточна (разбор ниже). Скрипт нужен как замер и как основа для варианта
// "кандидаты -> ревью в админке -> запись", как это сделано для nobles
// (staging_dneslov_links + /admin/nobles/import). Флаг --apply оставлен, но пользоваться им
// без ревью не стоит.
//
// Зачем: /saints/[id] умеет показывать "упоминается в чтениях" (getMentions), но mentionIds
// заполнены у 3 текстов из 3230 — показывать нечего.
//
// Что выяснилось по ходу (для тех, кто вернётся к задаче):
//  1. Имена в названиях наших текстов — часто имя АВТОРА, а не святого дня: "Слово иже во
//     святых отца нашего Иоанна Златоустаго" стоит в память Прокла. Поэтому словарь имён,
//     собранный из собственных названий, приписывает Иоанна Проклу. Отсюда --titles-fallback
//     выключен по умолчанию, имена берём с dneslov.org.
//  2. Заодно: extractHeroFromHeuristic из heroName.ts на реальных названиях почти не срабатывает
//     (3 названия из 967) — словарь чинов не учитывает ударения ("преподо́бнаго") и ЦС-графику.
//     Это влияет и на автопостинг, где эта эвристика — запасной путь для хэштега.
//  3. Имя само по себе не указывает на конкретного святого: "Иоанн" — 18 святых в нашей же
//     выборке, "Феодор" — 18, "Константин" — 18. Различает эпитет ("Златоуст", "Кесарийский"),
//     и только если эпитет принадлежит одному святому.
//  4. Написание разное: 2925 текстов набраны гражданкой с ударениями ("Иоа́нна"), 305 —
//     ЦС-графикой ("і҆ѡа́нна"). Приводится к общему виду normalizeChurchSlavonic.
//  5. Даже с этим остаются ошибки на библейских именах: в тексте упомянут апостол Андрей,
//     а в словаре — Андрей Стратилат. Здесь нужен либо контекст пошире, либо ручное ревью.
//
// Запуск:
//   npx tsx src/scripts/link-text-mentions.ts --fetch-names   # выкачать имена с dneslov (долго)
//   npx tsx src/scripts/link-text-mentions.ts --sample 20     # отчёт с примерами в контексте
import "@/scripts/lib/env";
import fs from "node:fs";
import path from "node:path";
import clientPromise from "@/lib/mongodb";
import { normalizeChurchSlavonic } from "@/scripts/lib/textNormalize";
import { getDneslovMemory } from "@/scripts/lib/dneslov";

const APPLY = process.argv.includes("--apply");
// Разбор собственных названий даёт имя автора чаще, чем имя святого дня ("Слово Иоанна
// Златоустаго" в память Прокла), и загрязняет словарь. По умолчанию выключен.
const TITLES_FALLBACK = process.argv.includes("--titles-fallback");
const FETCH = (() => {
    const i = process.argv.indexOf("--fetch-names");
    if (i === -1) return 0;
    const n = parseInt(process.argv[i + 1] || "", 10);
    return Number.isNaN(n) ? Infinity : n;
})();

// Имена святых берём с dneslov.org и складываем на диск: 840 памятей по два запроса —
// это долго и нестабильно, повторять при каждом прогоне незачем. script-data/ в .gitignore.
const CACHE_PATH = path.resolve(process.cwd(), "script-data/dneslov-names.json");

// В кэше держим сырые заголовки памятей, а не разобранные имена: разбор ещё не раз
// поменяется, и перевыкачивать ради этого 840 памятей незачем.
type CachedName = { id: string; titles: string[]; source: string };

const loadCache = (): Record<string, CachedName> => {
    try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    } catch {
        return {};
    }
};

const saveCache = (cache: Record<string, CachedName>) => {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Заголовки памятей из ответа dneslov. short_name намеренно не берём: там не имя,
// а внутреннее мнемоническое название ("Незорько Священградский", "пастух", "отцов").
const titlesFromMemory = (memory: any): string[] => {
    const titles: string[] = [];
    for (const event of memory?.events ?? []) {
        for (const memo of event?.memoes ?? []) {
            if (memo?.title) titles.push(memo.title);
        }
    }
    return [...new Set(titles)];
};

// "Аверкий, епископ Иерапольский, чудотворец" -> имя "аверкий", эпитет "иерапольскии".
// Разбираем ДО приведения к нижнему регистру: в заголовках dneslov имя собственное пишется
// с большой буквы, и это единственный надёжный признак — порядок слов не постоянен
// ("Прокопий Кесарийский", но "архидиакон Стефан, первомученик").
const COLLECTIVE = /отцов|собор|мучеников|апостолов|святых|иже с ним|всех |прочих/i;

// Чины и прозвища в именительном падеже — так они выглядят в заголовках dneslov.
const RANK_WORDS = new Set([
    "архидиакон", "диакон", "пресвитер", "епископ", "архиепископ", "митрополит", "патриарх",
    "игумен", "игумения", "монах", "инок", "схимонах", "первомученик", "первомученица",
    "мученик", "мученица", "великомученик", "великомученица", "священномученик",
    "священномученица", "преподобномученик", "преподобномученица", "преподобный",
    "преподобная", "праведный", "праведная", "блаженный", "блаженная", "святитель",
    "апостол", "пророк", "пророчица", "исповедник", "исповедница", "чудотворец",
    "бессребреник", "безсребреник", "равноапостольный", "равноапостольная", "благоверный",
    "благоверная", "князь", "княгиня", "царь", "царица", "дева", "столпник", "постник",
    "пастух", "целитель", "святогорец", "постельничий", "юродивый", "новый", "младенец",
]);

const parseMemoTitles = (titles: string[]) => {
    const names = new Set<string>();
    const epithets = new Set<string>();

    for (const title of titles) {
        if (COLLECTIVE.test(title)) continue;

        const rawWords = title.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
        let nameTaken = false;

        for (const raw of rawWords) {
            const w = normalizeChurchSlavonic(raw);
            if (w.length < MIN_STEM) continue;
            if (RANK_WORDS.has(w) || RANKS.has(w) || FILLERS.has(w) || NOT_NAMES.has(w)) continue;

            const isProper = raw[0] !== normalizeChurchSlavonic(raw[0]);   // слово с большой буквы
            if (EPITHET.test(w)) {
                epithets.add(w);
                continue;
            }
            if (!isProper) continue;
            if (!nameTaken) {
                names.add(w);
                nameTaken = true;
            } else {
                // второе имя собственное в заголовке различает тёзок не хуже топонима
                epithets.add(w);
            }
        }
    }

    return { names: [...names], epithets: [...epithets] };
};

const SAMPLE = (() => {
    const i = process.argv.indexOf("--sample");
    return i === -1 ? 0 : parseInt(process.argv[i + 1] || "20", 10);
})();

const MIN_STEM = 5;          // на четырёх буквах основа ловит случайные слова
const MAX_TAIL = 3;          // допуск на окончание сверх основы
const NEAR_WORDS = 6;        // насколько близко должен стоять эпитет, чтобы считать за подтверждение
const RARE_TEXTS = 25;       // имя, встречающееся чаще, чем в стольких текстах, слишком общее
// Предохранитель вместо бесконечного стоп-листа: если "имя" встречается в сотнях текстов,
// это не имя, а обычное слово, которое разбор заголовка принял за имя собственное
// ("Господень" из "Предтеча и Креститель Господень Иоанн" ловил "господа/господне" везде).
const MAX_NAME_DF = 120;
const MAX_EPITHET_DF = 300;

// Чины и обращения, после которых в названии стоит имя святого. Формы церковнославянские,
// уже нормализованные (без ударений).
const RANKS = new Set([
    "преподобнаго", "преподобныя", "преподобнои", "преподобномученика", "преподобномученицы",
    "святаго", "святыя", "священномученика", "священномученицы", "великомученика", "великомученицы",
    "мученика", "мученицы", "мученик", "пророка", "пророчицы", "апостола", "апостол", "святителя",
    "праведнаго", "праведныя", "блаженнаго", "блаженныя", "исповедника", "исповедницы",
    "чудотворца", "бессребреника", "безсребреника", "равноапостольнаго", "равноапостольныя",
    "благовернаго", "благоверныя", "аввы", "авва", "епископа", "архиепископа", "патриарха",
    "игумена", "царя", "царицы", "князя", "княгини", "диакона", "пресвитера", "монаха",
]);

// Служебное между чином и именем: "преподобнаго отца нашего Иоанна".
const FILLERS = new Set([
    "отца", "отце", "матере", "матери", "нашего", "нашея", "наших", "нашеи", "наша", "наш",
    "иже", "во", "в", "с", "ним", "же", "и", "святых", "святыхъ", "того", "тогоже", "день",
    "память", "слово", "житие", "страсть", "пренесение", "обретение", "мощеи", "мощей",
]);

// Слова, которые разбор иногда принимает за имя, а это общие существительные.
const NOT_NAMES = new Set([
    "матере", "матери", "отца", "господа", "господу", "господе", "бога", "богу", "боге",
    "духа", "духу", "христа", "христу", "христе", "богородицы", "богородице", "владычицы",
    "девы", "деве", "спаса", "спасу", "креста", "кресту", "церкве", "церкви", "ангела",
    "архангела", "пресвятыя", "пресвятую", "госпожу", "госпожи", "день", "дни", "недели",
    "господень", "господня", "господне", "предтеча", "креститель", "честнои", "честныи",
    "славныи", "славная", "живоноснаго", "источника", "иисуса", "иисус", "христос",
]);

const EPITHET = /(ск(аго|ого|ии|ия|ая|ому|ом|ои)|стаго|стого)$|^(златоуст|богослов|дамаскин|сирин|лествичник|постник|исповедник|новгородск|печерск)/;

const stemOf = (word: string): string | null => {
    const n = word.replace(/[^а-яa-z]/g, "");
    if (n.length < MIN_STEM) return null;
    if (/ии$/.test(n)) return n.slice(0, -1);
    if (/[аяуюеыиьй]$/.test(n)) return n.slice(0, -1);
    return n;
};

type Saint = {
    dneslovId: string;
    nameStems: Set<string>;
    epithetStems: Set<string>;
    titles: string[];
};

// Из названия текста достаём имя (или несколько — "мученика Леонтия и иже с ним Ипатия
// и Феодула") и эпитеты, по которым потом отличаем одного Иоанна от другого.
const parseTitle = (rawTitle: string) => {
    const words = normalizeChurchSlavonic(rawTitle)
        .replace(/[^а-яa-z\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const names: string[] = [];
    const epithets: string[] = [];

    for (let i = 0; i < words.length; i++) {
        if (!RANKS.has(words[i])) continue;
        // после чина пропускаем служебные слова и берём первое похожее на имя
        let j = i + 1;
        while (j < words.length && (FILLERS.has(words[j]) || RANKS.has(words[j]))) j++;
        if (j >= words.length) continue;
        const candidate = words[j];
        if (NOT_NAMES.has(candidate) || candidate.length < MIN_STEM) continue;
        if (EPITHET.test(candidate)) continue;
        names.push(candidate);

        // имена через "и": "Леонтия и иже с ним Ипатия и Феодула"
        let k = j + 1;
        while (k < words.length - 1) {
            if (words[k] !== "и") break;
            let m = k + 1;
            while (m < words.length && FILLERS.has(words[m]) && words[m] !== "и") m++;
            const next = words[m];
            if (!next || NOT_NAMES.has(next) || next.length < MIN_STEM || EPITHET.test(next)) break;
            names.push(next);
            k = m + 1;
        }
    }

    for (const w of words) {
        if (w.length >= 6 && EPITHET.test(w) && !RANKS.has(w)) epithets.push(w);
    }

    return { names, epithets };
};

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");

    const texts = await db
        .collection("texts")
        .find({}, { projection: { name: 1, alias: 1, content: 1, dneslovId: 1 } })
        .toArray();

    console.log(`Текстов в базе: ${texts.length}`);

    const dneslovIds = [...new Set(texts.filter((t) => t.dneslovId).map((t) => t.dneslovId as string))];
    const cache = loadCache();

    // --- 0. При необходимости добираем имена с dneslov.org
    if (FETCH) {
        const missing = dneslovIds.filter((id) => !cache[id]).slice(0, FETCH === Infinity ? undefined : FETCH);
        console.log(`Нет в кэше: ${dneslovIds.filter((id) => !cache[id]).length}, запрашиваю: ${missing.length}`);
        let done = 0;
        let failed = 0;
        for (const id of missing) {
            // dneslov.org периодически отваливается по таймауту — это не "у святого нет данных".
            // Неудачу в кэш НЕ пишем, иначе следующий прогон её уже не переспросит.
            let memory = null;
            for (let attempt = 1; attempt <= 3 && !memory; attempt++) {
                memory = await getDneslovMemory(id);
                if (!memory && attempt < 3) await sleep(2000 * attempt);
            }
            if (memory) {
                cache[id] = { id, titles: titlesFromMemory(memory), source: memory.slug ?? "" };
            } else {
                failed++;
            }
            done++;
            if (done % 20 === 0) {
                saveCache(cache);
                console.log(`  ...${done}/${missing.length} (не ответили: ${failed})`);
            }
            await sleep(900);
        }
        saveCache(cache);
        console.log(`Готово, в кэше записей: ${Object.keys(cache).length}, не ответили: ${failed}`);
    }

    // --- 1. Словарь святых: имена из dneslov, если есть, иначе из названий собственных текстов
    const saints = new Map<string, Saint>();
    let parsed = 0;
    let fromDneslov = 0;

    const ensureSaint = (id: string) => {
        let saint = saints.get(id);
        if (!saint) {
            saint = { dneslovId: id, nameStems: new Set(), epithetStems: new Set(), titles: [] };
            saints.set(id, saint);
        }
        return saint;
    };

    const dneslovNamed = new Set<string>();
    for (const id of dneslovIds) {
        const cached = cache[id];
        if (!cached?.titles?.length) continue;
        const { names, epithets } = parseMemoTitles(cached.titles);
        if (!names.length) continue;
        const saint = ensureSaint(id);
        for (const n of names) {
            const st = stemOf(n);
            if (st) saint.nameStems.add(st);
        }
        for (const e of epithets) {
            const st = stemOf(e);
            if (st) saint.epithetStems.add(st);
        }
        saint.titles.push(`${cached.titles[0]}`);
        dneslovNamed.add(id);
        fromDneslov++;
    }

    // Названия собственных текстов используем только там, где dneslov ничего не дал: они
    // ненадёжны — в названии часто стоит автор ("Слово Иоанна Златоустаго" в память Прокла),
    // и имя автора уезжает в словарь чужого святого.
    for (const t of texts) {
        if (!TITLES_FALLBACK) break;
        if (!t.dneslovId || !t.name) continue;
        if (dneslovNamed.has(t.dneslovId)) continue;
        const { names, epithets } = parseTitle(t.name);
        if (!names.length) continue;
        parsed++;

        const saint = ensureSaint(t.dneslovId);
        for (const n of names) {
            const s = stemOf(n);
            if (s) saint.nameStems.add(s);
        }
        for (const e of epithets) {
            const s = stemOf(e);
            if (s) saint.epithetStems.add(s);
        }
        if (saint.titles.length < 3) saint.titles.push(t.name);
    }

    console.log(`Имён из dneslov: ${fromDneslov}, из названий текстов (запасной путь): ${parsed}`);
    const withDneslov = dneslovIds.length;
    const withEpithet = [...saints.values()].filter((s) => s.epithetStems.size).length;
    console.log(`Святых со словарём: ${saints.size} из ${withDneslov} (с эпитетом: ${withEpithet})`);

    // --- 2. Кто владеет какой основой
    const nameOwners = new Map<string, Set<string>>();
    for (const s of saints.values()) {
        for (const stem of s.nameStems) {
            if (!nameOwners.has(stem)) nameOwners.set(stem, new Set());
            nameOwners.get(stem)!.add(s.dneslovId);
        }
    }
    const epithetOwners = new Map<string, Set<string>>();
    for (const s of saints.values()) {
        for (const stem of s.epithetStems) {
            if (!epithetOwners.has(stem)) epithetOwners.set(stem, new Set());
            epithetOwners.get(stem)!.add(s.dneslovId);
        }
    }

    const shared = [...nameOwners.entries()].filter(([, o]) => o.size > 1);
    console.log(`Основ имён: ${nameOwners.size}, из них у нескольких святых сразу: ${shared.length}`);
    if (shared.length) {
        const top = shared.sort((a, b) => b[1].size - a[1].size).slice(0, 8);
        console.log(`  делят имя: ${top.map(([s, o]) => `${s}* (${o.size})`).join(", ")}`);
    }

    // --- 3. Поиск по содержимому
    const lookup = new Map<number, Map<string, Set<string>>>();
    const addLookup = (stem: string, id: string, kind: "name" | "epithet") => {
        const key = `${kind}:${id}`;
        if (!lookup.has(stem.length)) lookup.set(stem.length, new Map());
        const m = lookup.get(stem.length)!;
        if (!m.has(stem)) m.set(stem, new Set());
        m.get(stem)!.add(key);
    };
    for (const s of saints.values()) {
        for (const stem of s.nameStems) addLookup(stem, s.dneslovId, "name");
        for (const stem of s.epithetStems) addLookup(stem, s.dneslovId, "epithet");
    }
    let lengths = [...lookup.keys()].sort((a, b) => a - b);

    // Предварительный проход: в скольких текстах вообще встречается каждая основа.
    const df = new Map<string, number>();
    for (const t of texts) {
        if (!t.content) continue;
        const words = new Set(normalizeChurchSlavonic(t.content).split(/[^а-яa-z]+/));
        const counted = new Set<string>();
        for (const word of words) {
            if (word.length < MIN_STEM) continue;
            for (const len of lengths) {
                if (len > word.length || word.length - len > MAX_TAIL) continue;
                const stem = word.slice(0, len);
                if (!lookup.get(len)!.has(stem) || counted.has(stem)) continue;
                counted.add(stem);
                df.set(stem, (df.get(stem) ?? 0) + 1);
            }
        }
    }

    let droppedStems = 0;
    for (const [len, stems] of lookup) {
        for (const [stem, owners] of [...stems]) {
            const freq = df.get(stem) ?? 0;
            const isName = [...owners].some((o) => o.startsWith("name:"));
            const cap = isName ? MAX_NAME_DF : MAX_EPITHET_DF;
            if (freq > cap) {
                stems.delete(stem);
                droppedStems++;
            }
        }
        if (!stems.size) lookup.delete(len);
    }
    lengths = [...lookup.keys()].sort((a, b) => a - b);
    console.log(`Основ отброшено как слишком частые (не имена, а обычные слова): ${droppedStems}`);

    const nameTextCount = new Map<string, number>();
    type Hit = {
        textId: string; textName: string; alias?: string; dneslovId: string;
        tier: "strong" | "weak"; word: string; context: string;
    };
    const hits: Hit[] = [];

    for (const t of texts) {
        if (!t.content) continue;
        const norm = normalizeChurchSlavonic(t.content);
        const words = norm.split(/[^а-яa-z]+/);

        // позиции основ в тексте: имя -> [индексы слов], эпитет -> [индексы слов]
        const namePos = new Map<string, number[]>();
        const epithetPos = new Map<string, number[]>();
        const distinctivePos = new Map<string, Set<number>>();

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word.length < MIN_STEM) continue;
            for (const len of lengths) {
                if (len > word.length || word.length - len > MAX_TAIL) continue;
                const owners = lookup.get(len)!.get(word.slice(0, len));
                if (!owners) continue;
                for (const owner of owners) {
                    const [kind, id] = owner.split(":");
                    if (kind === "name") {
                        if (!namePos.has(id)) namePos.set(id, []);
                        namePos.get(id)!.push(i);
                    } else {
                        if (!epithetPos.has(id)) epithetPos.set(id, []);
                        epithetPos.get(id)!.push(i);
                        if ((epithetOwners.get(word.slice(0, len))?.size ?? 0) === 1) {
                            if (!distinctivePos.has(id)) distinctivePos.set(id, new Set());
                            distinctivePos.get(id)!.add(i);
                        }
                    }
                }
            }
        }

        for (const [id, positions] of namePos) {
            if (id === t.dneslovId) continue;   // собственное житие — не "упоминание"
            const saint = saints.get(id)!;
            // Различает не имя, а эпитет: "Иоанн" носят 18 святых, "Златоуст" — один.
            // Поэтому подтверждением считаем только эпитет, принадлежащий одному святому.
            const distinctive = [...saint.epithetStems].filter(
                (stem) => (epithetOwners.get(stem)?.size ?? 0) === 1,
            );
            const near = (epithetPos.get(id) ?? []).filter((pos) => distinctivePos.get(id)?.has(pos) ?? true);
            const confirmed = distinctive.length > 0
                && positions.some((p) => near.some((e) => Math.abs(e - p) <= NEAR_WORDS));
            const tier: "strong" | "weak" = confirmed ? "strong" : "weak";

            const at = positions[0];
            const context = words.slice(Math.max(0, at - 5), at + 6).join(" ");
            hits.push({
                textId: t._id.toString(),
                textName: t.name,
                alias: t.alias,
                dneslovId: id,
                tier,
                word: words[at],
                context,
            });
            nameTextCount.set(id, (nameTextCount.get(id) ?? 0) + 1);
        }
    }

    // Имя, найденное в сотнях текстов, ничего не различает — это общее имя, а не ссылка.
    const strong = hits.filter((h) => h.tier === "strong");
    const weak = hits.filter(
        (h) => h.tier === "weak" &&
            (nameOwners.get([...saints.get(h.dneslovId)!.nameStems][0]) ?? new Set()).size === 1 &&
            (nameTextCount.get(h.dneslovId) ?? 0) <= RARE_TEXTS,
    );

    console.log(`\n=== Найдено ===`);
    console.log(`Уверенных (имя + эпитет рядом, в пределах ${NEAR_WORDS} слов): ${strong.length}`);
    console.log(`  текстов: ${new Set(strong.map((h) => h.textId)).size}, святых: ${new Set(strong.map((h) => h.dneslovId)).size}`);
    console.log(`Слабых (редкое имя без эпитета, не чаще ${RARE_TEXTS} текстов): ${weak.length}`);
    console.log(`  текстов: ${new Set(weak.map((h) => h.textId)).size}, святых: ${new Set(weak.map((h) => h.dneslovId)).size}`);
    console.log(`Отброшено как слишком общее: ${hits.length - strong.length - weak.length}`);

    if (SAMPLE) {
        const show = (label: string, list: Hit[]) => {
            console.log(`\n=== ${label} (${Math.min(SAMPLE, list.length)} из ${list.length}) ===`);
            for (const h of list.slice(0, SAMPLE)) {
                const saint = saints.get(h.dneslovId)!;
                console.log(`  «...${h.context}...»`);
                console.log(`     в тексте: ${(h.textName || "").slice(0, 65)}`);
                console.log(`     -> dneslov ${h.dneslovId}: ${(saint.titles[0] || "").slice(0, 65)}`);
            }
        };
        show("Уверенные", strong);
        show("Слабые", weak);
    }

    if (!APPLY) {
        console.log(`\nНичего не записано. Для записи уверенного яруса: --apply`);
        process.exit(0);
    }

    const grouped = new Map<string, Set<string>>();
    for (const h of strong) {
        if (!grouped.has(h.textId)) grouped.set(h.textId, new Set());
        grouped.get(h.textId)!.add(h.dneslovId);
    }
    const { ObjectId } = await import("mongodb");
    let updated = 0;
    for (const [textId, ids] of grouped) {
        await db.collection("texts").updateOne(
            { _id: new ObjectId(textId) },
            { $addToSet: { mentionIds: { $each: [...ids] } } },
        );
        updated++;
    }
    console.log(`\nОбновлено текстов: ${updated}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

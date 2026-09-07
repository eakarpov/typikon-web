// Кого предупредить о переезде на новый домен.
//
// Старый домен отключается в середине января, и всё, что на него смотрит, после
// этого перестаёт работать молча. Три списка, которые нужны, чтобы дотянуться до
// людей заранее:
//
//   1. Владельцы ключей публичного API — у них адрес зашит в чужой программе.
//   2. Ответственные за расписание приходов — они ведут страницы, на которые
//      ссылаются со своих сайтов и объявлений.
//   3. Приходские сайты с нашей рамкой — они узнаются ТОЛЬКО по журналам nginx:
//      кто поставил себе виджет, у нас нигде не записано.
//
// ГЛАВНОЕ, ЧТО ПОКАЗЫВАЕТ ЭТОТ СКРИПТ, — не сами списки, а то, до скольких из
// них мы вообще способны дотянуться. Почты пользователя у нас нет: поле `email`
// заводится пустым при регистрации и не заполняется нигде (вход идёт через VK,
// Google и Telegram, и адреса оттуда мы не берём). Связаться можно лишь с теми,
// кто сам оставил телефон или почту в заявке — на ведение расписания или на
// приём записок. Остальным придётся говорить внутри самого продукта.
//
// Запускать на сервере: локально приходского и пользовательского нет вовсе.
//
//   npm run migration:contacts
//   npm run migration:contacts -- --access-log '/var/log/nginx/access.log*'
//   npm run migration:contacts -- --out /tmp/pereezd   # выписать в CSV
//
// Списки содержат персональные данные: в CSV они пишутся только по --out, и
// класть их следует туда, откуда потом уберут.
import "@/scripts/lib/env";
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { basename, dirname, join } from "node:path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const args = process.argv.slice(2);
const optionOf = (name: string): string | null => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? null : null;
};

const ACCESS_LOG = optionOf("--access-log");
const OUT = optionOf("--out");

/** Как показывать того, у кого почты нет. */
interface Person {
    userId: string;
    name: string;
    /** Телефон или почта из заявки — единственный источник связи, какой у нас есть. */
    contact: string | null;
    /** Откуда контакт: заявка на ведение расписания, заявка на приём записок. */
    contactFrom: string | null;
    /** Чем входит: vk, google, telegram. Не канал связи, но опознаёт человека. */
    auth: string;
}

const csv = (rows: (string | number | null)[][]): string =>
    rows.map((row) => row.map((cell) => {
        const text = cell === null || cell === undefined ? "" : String(cell);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(",")).join("\n") + "\n";

const write = (name: string, rows: (string | number | null)[][]) => {
    if (!OUT) return;
    mkdirSync(OUT, { recursive: true });
    const path = join(OUT, name);
    writeFileSync(path, csv(rows));
    console.log(`  выписано: ${path}`);
};

const run = async () => {
    const client = await clientPromise;
    const db = client.db("typikon-users");

    // --- Контакты, оставленные людьми самими -------------------------------
    //
    // Собираются ЗАРАНЕЕ и одной картой: и ключи, и расписание упираются в один
    // и тот же вопрос «как с этим человеком связаться», а ответ лежит в двух
    // разных заявках.
    const contacts = new Map<string, { contact: string; from: string }>();

    for (const claim of await db.collection("templeClaims").find({}).toArray() as any[]) {
        if (claim.userId && claim.contact) {
            contacts.set(String(claim.userId), { contact: claim.contact, from: "заявка на расписание" });
        }
    }
    for (const claim of await db.collection("commemoratorClaims").find({}).toArray() as any[]) {
        if (claim.userId && claim.email) {
            contacts.set(String(claim.userId), { contact: claim.email, from: "заявка на записки" });
        }
    }

    const userIds = new Set<string>();
    const collect = (id: unknown) => {
        if (typeof id === "string" && ObjectId.isValid(id)) userIds.add(id);
    };

    // --- 1. Ключи публичного API -------------------------------------------
    const tokens = await db.collection("apiTokens").find({}).sort({ createdAt: 1 }).toArray() as any[];
    const now = new Date();
    const live = tokens.filter((t) => !t.revokedAt && (!t.expiresAt || new Date(t.expiresAt) > now));
    live.forEach((t) => collect(t.userId));

    // --- 2. Ответственные за расписание ------------------------------------
    const admins = await db.collection("templeAdmins").find({}).toArray() as any[];
    admins.forEach((a) => collect(a.userId));

    const published = await db.collection("parishSchedules")
        .find({ status: "published" }).toArray() as any[];
    const publishedBySlug = new Map<string, number>();
    for (const schedule of published) {
        publishedBySlug.set(schedule.parishSlug, (publishedBySlug.get(schedule.parishSlug) ?? 0) + 1);
    }

    // --- Люди одним запросом -----------------------------------------------
    const users = userIds.size
        ? await db.collection("users")
            .find({ _id: { $in: [...userIds].map((id) => new ObjectId(id)) } })
            .toArray() as any[]
        : [];
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const personOf = (userId: string | null): Person | null => {
        if (!userId) return null;
        const user = userById.get(String(userId));
        const contact = contacts.get(String(userId));
        const named = [user?.name, user?.surname].filter(Boolean).join(" ").trim();
        return {
            userId: String(userId),
            name: named || "(имени не оставлял)",
            contact: contact?.contact ?? null,
            contactFrom: contact?.from ?? null,
            auth: Object.keys(user?.auth ?? {}).join(", ") || "—",
        };
    };

    console.log("\n=== 1. Ключи публичного API ===");
    console.log(`Всего ключей: ${tokens.length}, из них действующих: ${live.length}.`);
    const tokenRows: (string | number | null)[][] = [
        ["prefix", "имя ключа", "тариф", "заведён", "последний запрос", "владелец", "связь", "откуда связь", "вход"],
    ];
    let unreachableKeys = 0;
    for (const token of live) {
        const person = personOf(token.userId);
        if (!person?.contact) unreachableKeys += 1;
        console.log(
            `  ${token.prefix.replace(/…$/, "")}… «${token.name}» [${token.tier}]`
            + ` — ${person ? person.name : "выдан скриптом (партнёр или приложение)"}`
            + (person?.contact ? `, связь: ${person.contact} (${person.contactFrom})` : ", связи нет"),
        );
        tokenRows.push([
            token.prefix, token.name, token.tier,
            token.createdAt ? new Date(token.createdAt).toISOString().slice(0, 10) : null,
            token.lastUsedAt ? new Date(token.lastUsedAt).toISOString().slice(0, 10) : null,
            person?.name ?? "выдан скриптом", person?.contact ?? null, person?.contactFrom ?? null,
            person?.auth ?? null,
        ]);
    }
    if (live.length) {
        console.log(`  Не дотянемся письмом: ${unreachableKeys} из ${live.length}.`);
        console.log("  Для них остаётся заголовок Sunset в ответах и полоса в профиле.");
    }
    write("api-keys.csv", tokenRows);

    console.log("\n=== 2. Ответственные за расписание приходов ===");
    console.log(`Связей «человек ведёт храм»: ${admins.length}; приходов с опубликованным расписанием: ${publishedBySlug.size}.`);
    const adminRows: (string | number | null)[][] = [
        ["храм", "опубликовано месяцев", "ответственный", "связь", "откуда связь", "вход", "право подтверждалось"],
    ];
    let unreachableAdmins = 0;
    for (const admin of admins) {
        const person = personOf(admin.userId);
        if (!person?.contact) unreachableAdmins += 1;
        const months = publishedBySlug.get(admin.templeSlug) ?? 0;
        console.log(
            `  ${admin.templeSlug} — ${person?.name ?? "?"}`
            + (person?.contact ? `, связь: ${person.contact}` : ", связи нет")
            + (months ? `, опубликовано месяцев: ${months}` : ", ещё не публиковал"),
        );
        adminRows.push([
            admin.templeSlug, months, person?.name ?? null, person?.contact ?? null,
            person?.contactFrom ?? null, person?.auth ?? null,
            admin.confirmedAt ? new Date(admin.confirmedAt).toISOString().slice(0, 10) : null,
        ]);
    }
    if (admins.length) {
        console.log(`  Не дотянемся письмом: ${unreachableAdmins} из ${admins.length}.`);
    }
    write("parish-admins.csv", adminRows);

    // Приходы, публикующие расписание, но без единого ответственного: расписание
    // идёт, а спросить не с кого — их тоже надо увидеть.
    const orphaned = [...publishedBySlug.keys()]
        .filter((slug) => !admins.some((a) => a.templeSlug === slug));
    if (orphaned.length) {
        console.log(`  Публикуют, но ответственного нет: ${orphaned.join(", ")}`);
    }

    console.log("\n=== 3. Приходские сайты с нашей рамкой ===");
    if (!ACCESS_LOG) {
        console.log("Пропущено: нужен --access-log '/var/log/nginx/access.log*'.");
        console.log("Учёта рамок у нас нет — кто её поставил, видно только по Referer в журналах.");
    } else {
        const referrers = await countEmbedReferrers(ACCESS_LOG);
        if (!referrers.size) {
            console.log("Ни одного обращения к /embed/ с чужого сайта в этих журналах.");
        }
        const rows: (string | number | null)[][] = [["сайт", "обращений", "последний раз"]];
        [...referrers.entries()]
            .sort((a, b) => b[1].hits - a[1].hits)
            .forEach(([host, stat]) => {
                console.log(`  ${host} — обращений: ${stat.hits}${stat.lastSeen ? `, последний раз: ${stat.lastSeen}` : ""}`);
                rows.push([host, stat.hits, stat.lastSeen]);
            });
        write("embed-sites.csv", rows);
        console.log(`  Всего сайтов: ${referrers.size}. Каждому — письмо и полоса внутри рамки.`);
    }

    console.log("\nПочты пользователей у нас нет вовсе: поле email заводится пустым и не");
    console.log("заполняется нигде. Всё, чем мы располагаем, — контакты из заявок; до");
    console.log("остальных дотягиваемся только внутри продукта.");

    await client.close();
};

/**
 * Кто ставит нашу рамку — по журналам nginx. Разбирается не строка целиком, а
 * только то, что нужно: запрос к /embed/ и заголовок Referer, откуда берётся имя
 * чужого сайта. Свои же адреса отбрасываются — предпросмотр в сборщике виджета
 * тоже ходит к /embed/.
 */
const countEmbedReferrers = async (pattern: string) => {
    const found = new Map<string, { hits: number; lastSeen: string | null }>();
    const files = expand(pattern);

    if (!files.length) {
        console.log(`Журналов по образцу ${pattern} не нашлось.`);
        return found;
    }
    console.log(`Журналов: ${files.length}.`);

    // Общий формат nginx: адрес - - [дата] "GET /путь HTTP/1.1" код размер "referer" "агент"
    const LINE = /^(\S+) \S+ \S+ \[([^\]]+)\] "(?:GET|HEAD) ([^ "]+)[^"]*" \d+ \S+ "([^"]*)"/;

    for (const file of files) {
        const stream = file.endsWith(".gz")
            ? createReadStream(file).pipe(createGunzip())
            : createReadStream(file);

        const lines = createInterface({ input: stream, crlfDelay: Infinity });
        for await (const line of lines) {
            const match = LINE.exec(line);
            if (!match) continue;

            const [, , when, path, referer] = match;
            if (!path.startsWith("/embed/") && path !== "/embed.js") continue;
            if (!referer || referer === "-") continue;

            let host: string;
            try {
                host = new URL(referer).host;
            } catch {
                continue;
            }
            // Свои страницы (сборщик виджета) — не чужой сайт.
            if (host.includes("typikon.")) continue;

            const stat = found.get(host) ?? { hits: 0, lastSeen: null };
            stat.hits += 1;
            stat.lastSeen = when.slice(0, 11);
            found.set(host, stat);
        }
    }

    return found;
};

/** Образец вида access.log* — без оболочки, чтобы его можно было передать в кавычках. */
const expand = (pattern: string): string[] => {
    if (existsSync(pattern) && !pattern.includes("*")) return [pattern];

    const dir = dirname(pattern);
    const name = basename(pattern);
    if (!existsSync(dir)) return [];

    const prefix = name.split("*")[0];
    const suffix = name.includes("*") ? name.split("*").pop()! : "";
    return readdirSync(dir)
        .filter((file) => file.startsWith(prefix) && file.endsWith(suffix))
        .map((file) => join(dir, file))
        .sort();
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});

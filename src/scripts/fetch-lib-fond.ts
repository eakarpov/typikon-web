// Забирает названия описей с lib-fond.ru в коллекцию `sources`.
//
// Ссылки на сканы у текстов ведут на лист рукописи («…/f-7-13/#image-21»), и
// что это за рукопись, из адреса не прочесть — только шифр. Название стоит на
// самой странице описи, в <h1>, и оно же есть то, что нужно показать читателю:
//
//   Ф.7 №13. Паренесис Ефрема Сирина. [Другое заглавие:] Заголовок рукописи:
//   "Книги святаго и праведнаго отца нашего Ефрема Сурианина глаголемыя
//   гречьскыим языком Паренесис…"
//
// Забираем раз и кладём в свою коллекцию: одна опись стоит источником у
// десятков текстов, и ходить за ней при каждом показе страницы значило бы
// ставить чужой сайт на путь нашего рендера (ровно та беда, из-за которой
// заведён кэш в src/lib/dneslov.ts).
//
// HTML разбираем регулярным выражением, без парсера. Обычно это плохая мысль,
// здесь — нет: нужен ровно один <h1> с плоским текстом, и заводить ради него
// cheerio или jsdom в зависимости приложения незачем. Если разметка описи
// изменится, скрипт скажет об этом пустым названием, а не тихо соврёт.
//
// Идемпотентен: описи, которые уже забраны, не трогает. Запуск:
//   npm run db:lib-fond  [-- --force]
import "@/scripts/lib/env";
import { Agent, fetch as undiciFetch } from "undici";
import clientPromise from "@/lib/mongodb";
import { libFondCipher, libFondUrl } from "@/lib/libFond";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DELAY_MS = 1200;      // вежливая пауза: описей три десятка, спешить некуда
const TIMEOUT_MS = 30000;
const RETRIES = 4;

// Своё соединение с БОЛЬШИМ сроком на установку связи. Умолчание undici — 10
// секунд, и lib-fond в него укладывается не всегда: две описи из тридцати
// пяти падали с UND_ERR_CONNECT_TIMEOUT, тогда как curl с тридцатью секундами
// брал их с первой попытки. Дело не в сертификате и не в блокировке — сайт
// просто отвечает медленно, и торопить его нечем.
const agent = new Agent({ connect: { timeout: TIMEOUT_MS } });

const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const decode = (s: string) => s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const fetchTitle = async (url: string): Promise<string | null> => {
    let last: any = null;
    let html = "";
    for (let i = 0; i < RETRIES; i++) {
        try {
            const res = await undiciFetch(url, {
                headers: { "User-Agent": UA },
                dispatcher: agent,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            html = await res.text();
            last = null;
            break;
        } catch (e: any) {
            last = e;
            if (i < RETRIES - 1) await sleep(2000 * (i + 1));
        }
    }
    if (last) throw new Error(last.cause?.message || last.message);
    const m = html.match(H1_RE);
    const title = m ? decode(m[1]) : "";
    return title || null;
};

const main = async () => {
    const force = process.argv.includes("--force");
    const client = await clientPromise;
    const db = client.db("typikon");
    const sources = db.collection("sources");
    await sources.createIndex({ url: 1 }, { unique: true });

    // Какие описи вообще упомянуты. Берём из самих текстов, а не списком в
    // коде: ссылки правятся в админке, и захардкоженный перечень разошёлся бы
    // с содержимым молча.
    const links = await db.collection("texts")
        .distinct("link", { link: { $regex: "lib-fond\\.ru" } }) as string[];
    const urls = [...new Set(links.map(libFondUrl).filter(Boolean))] as string[];
    console.log(`описей упомянуто: ${urls.length} (ссылок у текстов: ${links.length})`);

    let fetched = 0, kept = 0;
    const failed: string[] = [];

    for (const url of urls) {
        const existing = await sources.findOne({ url });
        if (existing?.title && !force) {
            // Шифр считается у нас и стоит даром, поэтому освежаем его даже
            // тогда, когда за названием не идём: правка его разбора не должна
            // требовать повторного обхода чужого сайта.
            const cipher = libFondCipher(url);
            if (existing.cipher !== cipher) {
                await sources.updateOne({ url }, { $set: { cipher } });
            }
            kept++;
            continue;
        }

        try {
            const title = await fetchTitle(url);
            await sources.updateOne(
                { url },
                {
                    $set: {
                        url,
                        title,
                        cipher: libFondCipher(url),
                        fetchedAt: new Date(),
                    },
                },
                { upsert: true },
            );
            if (title) {
                fetched++;
                console.log(`  ${title.slice(0, 96)}`);
            } else {
                // Страница ответила, а названия в ней нет — это про разметку,
                // а не про сеть, и молчать об этом нельзя.
                failed.push(`${url} — <h1> не найден`);
            }
        } catch (e: any) {
            failed.push(`${url} — ${e.message}`);
        }
        await sleep(DELAY_MS);
    }

    console.log(`\nзабрано: ${fetched}, было раньше: ${kept}, не вышло: ${failed.length}`);
    for (const line of failed) console.log(`  ! ${line}`);

    const withCipher = await sources.countDocuments({ cipher: { $ne: null } });
    console.log(`  описей всего в базе: ${await sources.countDocuments()}, из них с шифром: ${withCipher}`);
    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

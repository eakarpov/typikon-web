import { Metadata } from "next";
import Link from "next/link";
import clientPromise from "@/lib/mongodb";
import { myFont } from "@/utils/font";
import { cached, CacheTag } from "@/lib/cache";
import { versificationRows } from "@/lib/bible/concordance";
import { DUMP_URL, dumpBase, formatCount, readManifest } from "@/lib/dump";
import Lookup from "@/app/versification/Lookup";

// Согласование библейских нумераций как отдельный ресурс.
//
// Таблица разобрана у нас попутно, ради собственной сверки: без неё параллельное
// чтение не собрать вообще — пара «глава:стих» не значит ничего, пока не сказано,
// чьим счётом она названа. Публичного соответствия такого охвата в сети
// практически нет, а нужно оно всякому, кто работает больше чем с одним изданием.
// Поэтому у него свой адрес, а не строчка на странице выгрузки: ссылаться будут
// на страницу, а не на файл внутри архива.
export const revalidate = 86400;

export const metadata: Metadata = {
    title: "Согласование библейских нумераций",
    description:
        "Соответствия стихов между церковнославянским, греческим, латинским, румынским "
        + "и китайским изданиями Библии: 192 106 стихов шести изданий. Таблицей, файлом и ручкой API.",
};

const rows = cached(
    async () => versificationRows((await clientPromise).db("typikon")),
    ["versification-rows"],
    [CacheTag.BIBLE],
    86400,
);

const VersificationPage = async () => {
    const editions = await rows();
    const manifest = readManifest();
    const total = editions.reduce((sum, row) => sum + row.verses, 0);
    const titles = Object.fromEntries(editions.map((row) => [row.edition, row.shortTitle || row.title]));

    return (
        <div className={`${myFont.variable} flex flex-col gap-6 pt-4 pb-8 font-serif`}>
            <section className="flex flex-col gap-2">
                <h1 className="text-xl font-bold">Согласование библейских нумераций</h1>
                <p>
                    Пара «глава:стих» сама по себе не значит ничего, пока не сказано, чьим
                    счётом она названа. У румынской Псалтири в девятом псалме на стих меньше,
                    чем у славянской. Песнь трёх отроков напечатана в румынском издании
                    отдельной книгой, а славянский канон держит её внутри третьей главы
                    Даниила. Греческие Притчи идут в 29 главах против славянского 31.
                </p>
                <p>
                    Поэтому у каждого стиха собрания два адреса: <b>родной</b> — как
                    напечатано в самом издании, и <b>канонический</b> — приведённый правилами
                    к Елизаветинской Библии. Канонический адрес и есть общий язык: им названы
                    зачала, по нему сводится параллельное чтение, по нему же здесь ищется стих.
                </p>
                <p className="text-slate-700">
                    Таблица собрана не ради этой страницы: она понадобилась нам самим, чтобы
                    показывать издания рядом и не выдавать соседний стих за нужный. Всего
                    в ней {formatCount(total)} стихов {editions.length} изданий.
                </p>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Посмотреть стих</h2>
                <Lookup editionTitles={titles} />
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">Издания и расхождения</h2>
                <div className="overflow-x-auto">
                    <table className="text-sm border-collapse">
                        <thead>
                            <tr className="text-left border-b border-slate-300">
                                <th className="pr-4 py-1 font-normal">код</th>
                                <th className="pr-4 py-1 font-normal">издание</th>
                                <th className="pr-4 py-1 font-normal text-right">стихов</th>
                                <th className="pr-4 py-1 font-normal text-right">со сдвинутым адресом</th>
                                <th className="py-1 font-normal text-right">книг отдельно</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editions.map((row) => (
                                <tr key={row.edition} className="border-b border-slate-100 align-top">
                                    <td className="pr-4 py-1"><code>{row.edition}</code></td>
                                    <td className="pr-4 py-1">
                                        {row.title}
                                        {row.year ? <span className="text-slate-500">, {row.year}</span> : null}
                                    </td>
                                    <td className="pr-4 py-1 text-right tabular-nums">{formatCount(row.verses)}</td>
                                    <td className="pr-4 py-1 text-right tabular-nums">{formatCount(row.shifted)}</td>
                                    <td className="py-1 text-right tabular-nums">{row.detachedBooks || ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-slate-700">
                    «Со сдвинутым адресом» — стихи, чей напечатанный адрес не совпал с
                    каноническим. У Елизаветинской там ноль, и это не оценка издания: канон
                    по ней и определён, мерить её собой бессмысленно. «Книг отдельно» —
                    сколько книг издание напечатало самостоятельно там, где канон держит их
                    частью другой книги.
                </p>
                <p className="text-slate-700">
                    Соответствие здесь — <b>места, а не текста</b>. У стиха может не оказаться
                    пары в другом издании вовсе; разорванный надвое стих даёт два места в
                    одном издании. Где счёт разошёлся, глава прочитана построчно по обеим
                    книгам — иначе таблица выдавала бы соседний стих за нужный.
                </p>
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">Взять целиком</h2>
                <p>
                    Всю таблицу отдаём файлом — по строке на стих, с обоими адресами. Формат
                    JSON Lines и он же в CSV, оба под gzip; условия — CC BY 4.0, как у всего
                    слоя Библии.
                </p>
                {manifest ? (
                    <ul className="flex flex-col gap-1">
                        <li>
                            <a
                                href={`${dumpBase(manifest)}/bible/bible-concordance.jsonl.gz`}
                                className="text-amber-800 underline underline-offset-4"
                            >
                                <code>bible-concordance.jsonl.gz</code>
                            </a>
                            {" "}— строка JSON на стих
                        </li>
                        <li>
                            <a
                                href={`${dumpBase(manifest)}/bible/bible-concordance.csv.gz`}
                                className="text-amber-800 underline underline-offset-4"
                            >
                                <code>bible-concordance.csv.gz</code>
                            </a>
                            {" "}— то же таблицей, для тех, кто работает не программой
                        </li>
                    </ul>
                ) : (
                    <p className="text-slate-700">
                        Файлы лежат в <Link href="/data" className="text-amber-800 underline underline-offset-4">выгрузке корпуса</Link>.
                    </p>
                )}
                <p className="text-slate-700">
                    Ссылаться следует на версию выгрузки, а не на <code>{DUMP_URL}/latest/</code>:
                    состав корпуса меняется, и адрес версии — единственное, что завтра означает
                    то же, что сегодня. Подробнее — на странице{" "}
                    <Link href="/data" className="text-amber-800 underline underline-offset-4">выгрузки</Link>.
                </p>
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">Спросить программой</h2>
                <p>
                    Один стих отдаёт ручка{" "}
                    <Link href="/api" className="text-amber-800 underline underline-offset-4">
                        публичного API
                    </Link>
                    ; ключа для неё не нужно.
                </p>
                <pre className="overflow-x-auto bg-slate-50 border border-slate-200 p-3 text-sm">
{`GET /api/v2/concordance?ref=psaltir.9.13
GET /api/v2/concordance?ref=pritchi.24.1&from=grc-lxx-pat`}
                </pre>
                <p className="text-slate-700">
                    Без <code>from</code> адрес считается каноническим, с ним — родным счётом
                    названного издания. Для работы со всей таблицей ручка не годится: берите файл.
                </p>
            </section>
        </div>
    );
};

export default VersificationPage;

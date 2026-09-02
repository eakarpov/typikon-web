import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { plural } from "@/utils/plural";
import {
    DUMP_URL,
    DumpLayerInfo,
    formatBuiltAt,
    formatBytes,
    formatCount,
    readManifest,
} from "@/lib/dump";

// Выгрузка корпуса: что отдаётся целиком, на каких условиях и как это взять.
//
// Страница нужна не ради удобства, а ради честности. robots.txt закрывает пятнадцать
// обучающих обходчиков со словами «против распространения корпуса не возражаем,
// возражаем против выкачки постранично вместо API» — а публичный API отмерен
// тридцатью запросами в минуту, и корпус через него забирается сутками. Пока законного
// пути взять всё разом не было, эта просьба висела в воздухе.
export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Выгрузка корпуса — Уставные чтения",
    description:
        "Корпус уставных чтений одним архивом: тексты, ударения, чтения дня, зачала, "
        + "святые, храмы и согласование библейских нумераций. CC BY 4.0, с контрольными суммами.",
};

const Layer = ({ layer }: { layer: DumpLayerInfo }) => {
    const records = layer.files.reduce((sum, file) => sum + file.records, 0);
    const bytes = layer.files.reduce((sum, file) => sum + file.bytes, 0);

    return (
        <section className="flex flex-col gap-2">
            <h3 className="font-bold">
                {layer.title}{" "}
                <span className="font-normal text-slate-500">
                    — {formatCount(records)} {plural(records, "запись", "записи", "записей")},{" "}
                    {formatBytes(bytes)}
                </span>
            </h3>
            <p>
                Условия:{" "}
                <a
                    href={layer.license.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-800 underline underline-offset-4"
                >
                    {layer.license.name}
                </a>
                . Ссылаться так: <span className="text-slate-700">{layer.attribution}</span>
            </p>
            {layer.rationale.split("\n\n").map((paragraph) => (
                <p key={paragraph} className="text-slate-700">{paragraph}</p>
            ))}
            <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                    <thead>
                        <tr className="text-left border-b border-slate-300">
                            <th className="pr-4 py-1 font-normal">файл</th>
                            <th className="pr-4 py-1 font-normal">что внутри</th>
                            <th className="pr-4 py-1 font-normal text-right">записей</th>
                            <th className="pr-4 py-1 font-normal text-right">размер</th>
                            <th className="py-1 font-normal">sha256</th>
                        </tr>
                    </thead>
                    <tbody>
                        {layer.files.map((file) => (
                            <tr key={file.path} className="border-b border-slate-100 align-top">
                                <td className="pr-4 py-1">
                                    <a
                                        href={`${DUMP_URL}/${file.path}`}
                                        className="text-amber-800 underline underline-offset-4"
                                    >
                                        <code>{file.path}</code>
                                    </a>
                                </td>
                                <td className="pr-4 py-1">{file.title}</td>
                                <td className="pr-4 py-1 text-right tabular-nums">
                                    {formatCount(file.records)}
                                </td>
                                <td className="pr-4 py-1 text-right tabular-nums">
                                    {formatBytes(file.bytes)}
                                </td>
                                <td className="py-1">
                                    <code className="text-xs text-slate-500">
                                        {file.sha256.slice(0, 12)}…
                                    </code>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

const DataPage = () => {
    const manifest = readManifest();

    return (
        <div className={`${myFont.variable} flex flex-col gap-6 pt-4 pb-8 font-serif`}>
            <section className="flex flex-col gap-2">
                <h1 className="text-xl font-bold">Выгрузка корпуса</h1>
                <p>
                    Корпус можно взять целиком и разом, не обходя сайт постранично и не
                    выбирая его через API по тридцать запросов в минуту. Один набор файлов,
                    открытый формат, контрольные суммы и ясные условия на каждый слой.
                </p>
                <p>
                    Формат — <b>JSON Lines</b>, сжатый gzip: одна запись в строке, читается
                    чем угодно. Дампа Mongo здесь намеренно нет — он читается только Mongo и
                    везёт наружу нашу схему вместе со всеми её случайностями.
                </p>
            </section>

            {!manifest ? (
                <section className="flex flex-col gap-2">
                    <p className="text-slate-700">
                        Выгрузка сейчас собирается. Пока её нет, корпус доступен через{" "}
                        <Link href="/api" className="text-amber-800 underline underline-offset-4">
                            публичный API
                        </Link>
                        .
                    </p>
                </section>
            ) : (
                <>
                    <section className="flex flex-col gap-2">
                        <h2 className="text-lg font-bold">Как брать</h2>
                        <p>
                            Собрана {formatBuiltAt(manifest.builtAt)}. Начните с{" "}
                            <a
                                href={`${DUMP_URL}/manifest.json`}
                                className="text-amber-800 underline underline-offset-4"
                            >
                                manifest.json
                            </a>{" "}
                            — там перечислены все файлы с числом записей, размерами и
                            контрольными суммами.
                        </p>
                        <p className="border-l-2 border-slate-300 pl-3 text-slate-700">
                            {manifest.citation}
                        </p>
                        <p className="text-slate-700">
                            Выгрузка воспроизводима: две сборки на одной базе дают одинаковые
                            суммы. Поэтому обновление проверяется сверкой, а не перекачкой.
                        </p>
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-lg font-bold">Слои</h2>
                        <p>
                            Условия у слоёв <b>разные</b>, и общей лицензии у выгрузки нет.
                            Рядом с файлами каждого слоя лежат его собственные LICENSE и README.
                        </p>
                        {manifest.layers.map((layer) => (
                            <Layer key={layer.id} layer={layer} />
                        ))}
                    </section>

                    <section className="flex flex-col gap-2">
                        <h2 className="text-lg font-bold">Чего здесь нет</h2>
                        <p>
                            Не всё, что лежит в базе, наше — и не всё, что наше, можно отдать.
                            Наружу не идёт:
                        </p>
                        <ul className="flex flex-col gap-1 text-slate-700">
                            {Object.entries(manifest.excluded).map(([name, why]) => (
                                <li key={name}>
                                    <code className="text-sm">{name}</code> — {why}
                                </li>
                            ))}
                        </ul>
                        <p>
                            Полные условия и разбор по слоям —{" "}
                            <Link href="/license" className="text-amber-800 underline underline-offset-4">
                                условия использования
                            </Link>
                            .
                        </p>
                    </section>
                </>
            )}

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">О полноте</h2>
                <p>
                    Корпус набирается и вычитывается вручную. У текста есть отметка готовности
                    (<code className="text-sm">readiness</code>): часть вычитана, часть
                    отекстована и ждёт сверки, часть существует только сканом. Для научной
                    работы сверяйтесь с оригиналом — ссылка на скан есть у большинства текстов.
                </p>
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-lg font-bold">Если нужна не вся куча</h2>
                <p>
                    За отдельными записями ходите в{" "}
                    <Link href="/api" className="text-amber-800 underline underline-offset-4">
                        API
                    </Link>
                    : там поиск, чтения на любой день церковного года и выборка по одному
                    адресу. Выгрузка — для тех, кому нужен корпус целиком.
                </p>
            </section>
        </div>
    );
};

export default DataPage;

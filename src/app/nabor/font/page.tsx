import Details from "@/app/nabor/Details";
import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { myFont, csFontVariables } from "@/utils/font";

const FontReader = dynamic(() => import("@/app/nabor/font/FontReader"), { ssr: false });

// Разбор шрифтового файла — то, что сегодня делается только консольными
// средствами: fontTools, otfinfo, hb-shape, codechart из cslavonic (последний
// ради кодовой таблицы гоняет XeLaTeX). Всё нужное лежит в самом файле.

export const metadata: Metadata = {
    title: "Разбор шрифтового файла — Церковнославянский набор",
    description:
        "Что объявлено в шрифте: покрытие церковнославянских знаков, привязка надстрочных, "
        + "возможности OpenType, частная область. И хватит ли шрифта на ваш текст.",
    openGraph: {
        title: "Разбор шрифтового файла",
        description: "Покрытие, привязка надстрочных и частная область — прямо из файла шрифта.",
        url: "//www.typikon.su/nabor/font/",
    },
};

const Font = () => (
    <div className={`${myFont.variable} ${csFontVariables} pt-2 flex flex-col gap-5`}>
        <div className="max-w-2xl">
            <h1 className="font-bold font-serif">Разбор шрифтового файла</h1>
            <p className="font-serif text-slate-800 mt-2">
                Положите сюда файл шрифта — и увидите, что в нём объявлено: покрывает ли он
                выносные буквы, титло и уставные начертания, умеет ли ставить надстрочный знак
                над буквой, пользуется ли частной областью, юникодный он или дореформенный.
                Тут же можно спросить, хватит ли его на ваш текст.
            </p>
            {/* Оговорка вверху: она отделяет этот разбор от проверки шрифта в системе. */}
            <p className="font-serif text-slate-600 text-sm mt-2">
                <strong>Ответ точен, и файл никуда не передаётся</strong>: читается сам файл, а
                не то, что нарисовал браузер.
            </p>
            <div className="mt-2">
                <Details summary="чем это отличается от проверки шрифта">
                    Там мы измеряем, что нарисовал браузер, приметами, каждая из которых
                    по-своему неточна. Здесь читается таблица соответствий самого файла: знак
                    либо объявлен в ней, либо нет, и третьего не дано.
                </Details>
            </div>
        </div>

        <FontReader />

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Почему полнота знаков ещё не всё</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Обычный шрифт может случайно содержать нужные глифы — и всё равно не годиться.
                Церковнославянский набор держится на <strong>привязке надстрочных знаков</strong>:
                шрифт должен ставить ударение и выносную над буквой, не занимая места в строке.
                Без этого «гдⷭ҇ь» печатается как «г д с ҇ ь» — при том что ни одного заполнителя
                на экране не появится и обычная проверка скажет, что всё отображается. Измерено:
                у Arial ширина «гⷭ҇» — 134 пункта против 26 у одной «г»; у Мономаха и Ponomar
                Unicode — те же 32, что и у буквы без знаков.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Что именно читается</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Из двух десятков таблиц шрифта нужны четыре: <span className="font-mono text-xs">name</span> —
                чей шрифт и на каких условиях; <span className="font-mono text-xs">cmap</span> — что во что
                отображается (по ней же видно, юникодный он или раскладка по байтам);{" "}
                <span className="font-mono text-xs">post</span> — имена глифов, по которым читаются
                частные коды; <span className="font-mono text-xs">GPOS</span> и{" "}
                <span className="font-mono text-xs">GSUB</span> — привязка знаков и объявленные
                возможности. Очертания глифов не разбираются вовсе: рисунок здесь не нужен.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Чего пока нет</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Показа самих начертаний: разбор говорит, что знак объявлен, но не рисует его —
                для этого шрифт нужно установить или загрузить в страницу. Не разбираются
                собрания шрифтов (.ttc) и сжатые woff/woff2: первое требует выбора начертания,
                второе — распаковки. Не читается и то, какие именно правила стоят в разметке:
                мы отвечаем «привязка есть» или «привязки нет», а не пересказываем таблицу.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Что рядом</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Что покажет шрифт, уже установленный у читателя, — <Link href="/nabor/shrift"
                    className="text-red-900 hover:underline">проверка шрифта</Link>.
                Текст, набранный дореформенным шрифтом, — <Link href="/nabor/ucs"
                    className="text-red-900 hover:underline">перекодировка</Link>.
                Частные коды в тексте — <Link href="/nabor/pua"
                    className="text-red-900 hover:underline">сведение к юникоду</Link>.
            </p>
        </section>
    </div>
);

export default Font;

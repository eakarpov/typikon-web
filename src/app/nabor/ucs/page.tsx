import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { myFont, csFont } from "@/utils/font";

// Перекодировка старого набора в юникод.
//
// Окно грузится отдельным куском (next/dynamic): с ним едут таблица на 256
// записей и разбор HIP, и класть эти килобайты на остальные страницы незачем.
const Converter = dynamic(() => import("@/app/nabor/ucs/Converter"), { ssr: false });

export const metadata: Metadata = {
    title: "Перекодировка HIP и UCS в юникод — Церковнославянский набор",
    description:
        "Церковнославянский текст, набранный старым шрифтом (HIP, UCS), переводится "
        + "в юникод: титла, выносные и ударения встают на свои места. Файл или вставка, "
        + "выдача на странице и файлом в UTF-8 или UTF-16.",
    openGraph: {
        title: "Перекодировка HIP и UCS в юникод",
        description: "Старый церковнославянский набор — в юникод, прямо в браузере.",
        url: "//www.typikon.su/nabor/ucs/",
    },
};

const Ucs = () => (
    <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-5`}>
        <div className="max-w-2xl">
            <h1 className="font-bold font-serif">Перекодировка HIP и UCS в юникод</h1>
            <p className="font-serif text-slate-800 mt-2">
                До юникода церковнославянский набирали шрифтовыми кодировками: байт означал
                не букву, а место в раскладке шрифта. Пока шрифт стоял, текст читался; без
                него — рассыпался в «Взбрaнный воев0до». Здесь такой текст возвращается
                буквами: титла, выносные, ударения и звательца встают каждое на своё место.
            </p>
            {/* Оговорка вверху, а не петитом внизу: обещание про сервер — это
                то, ради чего человек вообще решится вставить сюда чужую работу. */}
            <p className="font-serif text-slate-600 text-sm mt-2">
                <strong>Ни файл, ни текст на сервер не уходят.</strong> Перекодировка
                считается прямо в браузере: таблица на 256 мест и цикл, никакой базы за
                спиной. Проверяется вкладкой «Сеть» в средствах разработчика: при загрузке
                файла и при перекодировке запросов нет вовсе. Сама страница, как и всякая
                другая на сайте, отмечается в счётчике посещений — туда уходит её адрес,
                и только он.
            </p>
        </div>

        <Converter />

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Что именно разобрано</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                <strong>HIP</strong> — формат orthlib.ru: надстрочные записаны ASCII
                (<span className="font-mono">&apos;</span> ударение,{" "}
                <span className="font-mono">=</span> звательце, <span className="font-mono">~</span> титло),
                выносная буква — обратным слэшем, разрывы строк — двойной косой. Разбор наш
                собственный, выведенный не по учебнику, а замерами по 296 чистым
                церковнославянским текстам собрания; на нём стоят 42 главы «Алфавита
                духовного», ввезённые в собрание.
            </p>
            <p className="font-serif text-sm text-slate-600 mt-2">
                <strong>UCS</strong> — раскладка шрифтов Ирмологиона (irmologion.ru). Важная
                оговорка: <strong>UCS не одна</strong>, а семейство раскладок — Hirmos,
                Irmologion, Triodion и прочие расходятся как раз в верхней половине таблицы,
                где стоят буквы с надстрочными. Разобран извод, описанный на irmologion.ru;
                если ваш текст набран другим шрифтом этого семейства, часть надстрочных
                встанет не туда, и это будет видно.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Откуда взята таблица</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Раскладка UCS — из открытого источника под CC0 (общественное достояние,
                github.com/frogstail/ucs-decoder), 129 названных мест; остальные байты
                стоят там же, где в Windows-1251. Сверена с независимым выводом той же
                раскладки — cslavonic (MIT, © Mike Kroutikov, по работе А. Андреева):
                из 129 общих мест 121 совпало знак в знак, одно — после нормализации,
                расходятся семь. Шесть из семи — один вопрос: писать ук слитно (ѹ) или
                разложенно (ᲂу); мы пишем слитно, потому что так набрано собрание.
                Оба чтения записаны в коде рядом, спор не спрятан.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Чего пока нет</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Раскладки шрифтов, объявляющих знаки в латинском расширенном блоке, разобраны
                только наполовину: кириллическая часть встаёт верно, буквы с надстрочными —
                нет, и такие знаки считаются неразобранными, а не подставляются наугад.
                Угаданная перекодировка портит текст правдоподобно, и это хуже, чем не
                перекодировать вовсе. Нет и обратной стороны — из юникода в UCS: она нужна
                тем, кто верстает старыми шрифтами, а таких всё меньше.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Что рядом</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Понять, что стоит в уже юникодной строке, — <Link href="/nabor/znaki"
                    className="text-red-900 hover:underline">разбор по знакам</Link>.
                Квадраты вместо букв — <Link href="/nabor/shrift"
                    className="text-red-900 hover:underline">проверка шрифта</Link>.
                Расставить ударения в перекодированном — <Link href="/accents"
                    className="text-red-900 hover:underline">раздел «Ударения»</Link>.
            </p>
        </section>
    </div>
);

export default Ucs;

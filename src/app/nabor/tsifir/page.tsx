import type { Metadata } from "next";
import Link from "next/link";
import { myFont, csFontVariables } from "@/utils/font";
import NumeralForm from "@/app/nabor/tsifir/NumeralForm";
import CivilForm from "@/app/nabor/tsifir/CivilForm";

// Два преобразования на одной странице, и это не экономия места.
//
// Оба служат одному: прочтению церковнославянского написания средствами, с
// которыми работает нынешняя техника. Цифирь переводит число, гражданка — буквы;
// по отдельности ни то, ни другое на самостоятельную страницу не выходит.
// Оба применялись в проекте внутренне — цифирь при разборе румынского набора
// 1688 года, гражданка при сведении написаний в поиске — и наружу не выводились.

export const metadata: Metadata = {
    title: "Цифирь и гражданка — Церковнославянский набор",
    description:
        "Буквенное число в обе стороны: «ѳ҃і» — 19, 1764 — «҂аѱѯ҃д». И перевод "
        + "церковнославянского начертания в гражданское: ѣ→е, ꙋ→у, ѡ→о.",
    openGraph: {
        title: "Цифирь и гражданка",
        description: "Буквенное число в обе стороны и ЦС-начертание гражданкой.",
        url: "//www.typikon.su/nabor/tsifir/",
    },
};

const Tsifir = () => (
    <div className={`${myFont.variable} ${csFontVariables} pt-2 flex flex-col gap-6`}>
        <div className="max-w-2xl">
            <h1 className="font-bold font-serif">Цифирь и гражданка</h1>
            <p className="font-serif text-slate-800 mt-2">
                Два перевода, которыми старое написание читается нынешними средствами:
                буквенное число — арабским, церковнославянское начертание — гражданским.
            </p>
        </div>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold">Цифирь</h2>
            <p className="font-serif text-slate-600 text-sm mt-1 mb-3">
                Число, записанное буквами: «ѳ҃і» — 19, «҂аѱѯ҃д» — 1764. Введите цифирь —
                прочтём числом; введите число — запишем цифирью. <strong>Помета
                обязательна</strong>: без титла «ми» — предлог, а не 48, и чтение его как
                числа привело бы к произвольному разрыву текста.
            </p>
            <NumeralForm />
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold">Гражданка</h2>
            <p className="font-serif text-slate-600 text-sm mt-1 mb-3">
                Церковнославянское начертание гражданским: ѣ→е, ꙋ→у, ѡ→о, ѧ→я, ѳ→ф, ѕ→з,
                диграф ᲂу — одной буквой «у». Тем же самым у нас сводятся написания при
                поиске: 305 текстов собрания набраны ЦС-графикой, и без этого перевода они
                не находятся по гражданскому запросу.
            </p>
            <CivilForm />
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Откуда это взято</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Значения букв цифири — по книгам собрания; написание проверено титульными
                годами Ифики («҂зсо҃в» и «҂аѱѯ҃д» — разница ровно 5508, то есть эры сошлись).
                Где книги расходятся в начертании, берём то, которого в собрании больше:
                семьдесят пишем широким ѻ (72 текста против 6 с узким о), четыреста — ꙋ.
                Читается при этом любое написание, включая ѹ и ᲂу.
            </p>
        </section>

        <section className="max-w-2xl">
            <h2 className="font-serif font-bold text-sm">Что рядом</h2>
            <p className="font-serif text-sm text-slate-600 mt-1">
                Текст, набранный старым шрифтом и оттого нечитаемый, — <Link
                    href="/nabor/ucs" className="text-red-900 hover:underline">перекодировка</Link>.
                Понять, что именно стоит в строке, — <Link href="/nabor/znaki"
                    className="text-red-900 hover:underline">разбор по знакам</Link>.
                Расставить ударения — <Link href="/accents"
                    className="text-red-900 hover:underline">раздел «Ударения»</Link>.
            </p>
        </section>
    </div>
);

export default Tsifir;

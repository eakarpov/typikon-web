import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { SITE_URL } from "@/utils/site";
import Reference from "./Reference";
import Translit from "./Translit";

// Кириллица для польского.
//
// Оговорка стоит вверху: это не существующий проект вроде русификаций XIX века,
// а построение, у которого видно цену каждого решения. Читать его вслух можно —
// в отличие от китайской азбуки, здесь запись отвечает нынешнему языку.

export const metadata: Metadata = {
    title: "Польская кириллица — Уставные чтения",
    description:
        "Кириллица для польского языка: не транслит латиницы, а правописание. " +
        "Ять склеивает корень, который латиница рвёт (mieć/miał → мѣць/мѣл), " +
        "ѡ держит старопольскую долготу, диграфы исчезают. Живой перевод текста.",
    openGraph: {
        title: "Польская кириллица",
        description:
            "Не транслит латиницы, а правописание: то, что польская запись потеряла, " +
            "здесь пишется буквой — ять, долгота, мягкость.",
        url: `${SITE_URL}/azbuki/polish/`,
    },
};

const PolishCyrillic = () => {
    setMeta();

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="flex flex-col gap-2 max-w-3xl">
                <h1 className="font-serif font-bold text-lg">Польская кириллица</h1>
                <p className="font-serif">
                    Не транслит латиницы, а правописание: то, что польская запись потеряла,
                    здесь пишется буквой. Ять склеивает корень, который латиница рвёт
                    (mieć/miał → <span className="font-serif">мѣць/мѣл</span>, świat/świecie →{" "}
                    <span className="font-serif">свѣт/свѣцє</span>), <span>ѡ</span> держит
                    старопольскую долготу (Bóg/Boga → <span>Бѡг/Бога</span>), а диграфы
                    исчезают: Szczebrzeszynie — это <span>Щебр̌ешынѣ</span>.
                </p>
                <p className="font-serif text-slate-600">
                    Это <strong>построение, а не письменность в употреблении</strong>:
                    по-польски так не пишут. Но в отличие от китайской азбуки читать её
                    вслух можно — она отвечает нынешнему языку, и перевод в обе стороны
                    механичен везде, кроме ятя: где он стоит, знает только словник.
                </p>
                <p className="font-serif text-sm text-slate-500">
                    Раздел из{" "}
                    <Link href="/opyty" className="text-amber-800 hover:underline">Опытов</Link>
                    {" — "}он работает, но не закончен. Другие азбуки — в{" "}
                    <Link href="/azbuki" className="text-amber-800 hover:underline">общем списке</Link>.
                </p>
            </div>

            <Translit />
            <Reference />
        </div>
    );
};

export default PolishCyrillic;

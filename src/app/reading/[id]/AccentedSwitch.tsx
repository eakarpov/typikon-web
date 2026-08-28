'use client';
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Переключатель показа с машинными ударениями. Появляется только у текстов,
// размеченных не полностью, — у остальных подсказывать нечего.
//
// Состояние держится в адресе, а не в памяти: страницу чтения дают почитать по
// ссылке, и в ней должно быть видно, в каком виде текст показан.
const AccentedSwitch = ({ alias, showAccents, marked, expected }: {
    alias: string;
    showAccents: boolean;
    marked: number;
    expected: number;
}) => {
    // В состоянии «как в книге» точного числа не называем: оно считается по
    // покрытию, а после разметки — по самой разметке, и цифры немного расходятся.
    // Показывать две разные при переключении хуже, чем не показывать одну.
    const params = useSearchParams();
    const range = params?.get("range");
    const query = (accents: boolean) => {
        const next = new URLSearchParams();
        if (range) next.set("range", range);
        if (accents) next.set("accents", "1");
        const search = next.toString();
        return `/reading/${alias}${search ? `?${search}` : ""}`;
    };

    const style = (active: boolean) =>
        `font-serif border rounded px-2 py-0.5 text-sm ${
            active ? "border-amber-800 text-amber-800 font-bold" : "border-slate-300 text-slate-600"
        }`;

    return (
        <div className="flex flex-row flex-wrap items-center gap-2 my-2 no-pdf">
            <Link href={query(false)} className={style(!showAccents)} scroll={false}>
                Как в книге
            </Link>
            <Link href={query(true)} className={style(showAccents)} scroll={false}>
                С ударениями
            </Link>
            <span className="font-serif text-sm text-slate-500">
                {showAccents
                    ? `машинная разметка, ${marked} из ${expected} слов`
                    : "в этом тексте ударения проставлены не везде"}
            </span>
        </div>
    );
};

export default AccentedSwitch;

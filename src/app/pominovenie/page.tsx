import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { publicCommemorators } from "@/lib/pomyannik/commemorators";
import { NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";

// КТО ПРИНИМАЕТ ЗАПИСКИ ОТ ВСЕХ.
//
// Единственная открытая страница всего помянника — и открыта она нарочно: у
// человека, которому некуда подать записку, должно быть место, где искать.
// Стоят здесь только те, кто сам решил принимать от всех; прочие принимают по
// своей ссылке и в списке не показываются.
//
// САН МЫ НЕ УДОСТОВЕРЯЕМ, и сказать это надо на самой странице, а не в мелком
// шрифте: список выглядит как ручательство сайта, а он им не является. Мы
// сверили страницу епархии и ответное письмо — это всё, за что мы отвечаем.

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Кому подать записку — Уставные чтения",
    description: "Священники, принимающие поминальные записки через сайт. Без оплат.",
    openGraph: {
        title: "Кому подать записку",
        description: "Священники, принимающие поминальные записки. Оплат на сайте нет.",
        url: "//www.typikon.su/pominovenie/",
    },
};

const PominoveniePage = async () => {
    const people = await publicCommemorators();

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Кому подать записку</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Священники, согласившиеся принимать поминальные записки через сайт от всех.
                    Записка собирается из вашего помянника: имена сверяются со святцами и
                    выходят церковнославянским письмом в родительном падеже.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    <strong>Оплат на сайте нет.</strong> Записка идёт священнику напрямую; сайт
                    в этом не участвует и ничего с этого не имеет.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    <strong>Сана мы не удостоверяем</strong> — за него отвечает епархия. Мы
                    сверили два: страницу епархии, где человек назван, и ответ на письмо,
                    посланное на адрес в её домене. Ссылка на страницу епархии стоит у каждого,
                    и посмотреть её вы можете сами.
                </p>
            </div>

            {people.length === 0 ? (
                <p className="font-serif text-sm text-slate-600">
                    Пока никто не открыл приём для всех. Если вам дали ссылку-приглашение —
                    она работает и без этого списка.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {people.map(person => (
                        <li key={person.slug} className="font-serif">
                            <Link href={`/pominovenie/${person.slug}`}
                                  className="text-red-900 hover:underline">
                                {person.title}
                            </Link>
                            {person.place && (
                                <span className="text-slate-600 text-sm"> · {person.place}</span>
                            )}
                            {person.accepts.length > 0 && (
                                <span className="block text-slate-500 text-xs">
                                    принимает: {person.accepts
                                        .map(k => NOTE_KIND_BY_KEY[k]?.label ?? k).join(", ")}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <p className="font-serif text-sm border-t pt-3">
                <Link href="/pomyannik/priem" className="text-red-900 hover:underline">
                    Священникам: как начать принимать записки →
                </Link>
            </p>
        </div>
    );
};

export default PominoveniePage;

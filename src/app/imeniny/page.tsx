import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { allNames, keyOf, nameEntry } from "@/lib/imeniny/store";
import Result from "@/app/imeniny/Result";

// Именины: когда праздновать день своего святого.
//
// ПРАВИЛО НАРОДНОЕ, А НЕ УСТАВНОЕ, и сказать об этом надо вверху, как в
// словаре ударений и в трапезе: Церковь единого порядка не устанавливает —
// где-то именины назначают по дню крещения, где-то по восьмому дню от
// рождения, где-то по святому, чьё имя дали. Мы считаем самый ходовой обычай
// и не выдаём его за единственный.
//
// УКАЗАТЕЛЬ ИМЁН ВЫВЕДЕН НАМИ. Готового у собрания нет: `saints.title` —
// заголовок, а не имя. Разбор построен скриптом (npm run names:index) и
// сказано об этом прямо: 1 071 имя, 817 святых из 826, соборные памяти —
// догадкой.
//
// Форма обычная, без JavaScript: ответ приходит адресом, и им можно
// поделиться — «мои именины» это ровно та ссылка, которую пересылают.

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Именины: когда день вашего святого — Уставные чтения",
    description:
        "Имя и день рождения — ближайшая память святого с этим именем по святцам. "
        + "Все дни памяти имени, с переводом в гражданский календарь.",
    openGraph: {
        title: "Именины: когда день вашего святого",
        description: "Ближайшая память святого с вашим именем — по святцам и церковному календарю.",
        url: "//www.typikon.su/imeniny/",
    },
};

const CLASS = "border rounded px-2 py-1 font-serif bg-white";

type Props = { searchParams: { name?: string; born?: string } };

const bornOf = (raw?: string) => {
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? ""));
    if (!parsed) return null;
    const month = Number(parsed[2]), day = Number(parsed[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { month, day };
};

const Imeniny = async ({ searchParams }: Props) => {
    const key = keyOf(searchParams.name);
    const [entry, names] = await Promise.all([
        key ? nameEntry(key) : Promise.resolve(null),
        allNames(),
    ]);
    const born = bornOf(searchParams.born);
    const year = new Date().getFullYear();

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-5`}>
            <div>
                <h1 className="font-bold font-serif">Именины</h1>
                <p className="font-serif text-slate-800 mt-2 max-w-2xl">
                    День своего святого — не день рождения и не всегда день крещения. Назовите имя
                    и день рождения: покажем ближайшую после него память святого с этим именем и
                    все прочие дни этого имени в году.
                </p>
                {/* Оговорка вверху, обычным кеглем: обычай легко принять за
                    церковное установление, а он им не является. */}
                <p className="font-serif text-slate-600 text-sm mt-2 max-w-2xl">
                    <strong>Правило это обычай, а не устав.</strong> Церковь единого порядка не
                    устанавливает: именины назначают и по дню крещения, и по восьмому дню от
                    рождения, и по тому святому, чьё имя дали при наречении. Мы считаем самый
                    ходовой обычай — ближайшую память после дня рождения — и решать за вас не
                    беремся: все дни имени показаны рядом.
                </p>
            </div>

            <form method="get" className="flex flex-wrap gap-3 items-end font-serif text-sm">
                <label className="flex flex-col gap-1">
                    имя
                    <input className={CLASS} name="name" defaultValue={searchParams.name ?? ""}
                           placeholder="Николай" list="imeniny-names" autoComplete="off" />
                </label>
                <label className="flex flex-col gap-1">
                    день рождения
                    <input className={CLASS} type="date" name="born" defaultValue={searchParams.born ?? ""} />
                </label>
                <button className="border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100">
                    посмотреть
                </button>
                <datalist id="imeniny-names">
                    {names.map(n => <option key={n.key} value={n.name} />)}
                </datalist>
            </form>

            {key && !entry && (
                <p className="font-serif text-slate-700">
                    Имени «{searchParams.name}» в святцах нашего собрания нет. Оно могло быть
                    записано иначе — попробуйте церковную форму: Иоанн вместо Ивана, Георгий
                    вместо Юрия, Дими́трий вместо Дмитрия.
                </p>
            )}

            {entry && (
                <section>
                    <h2 className="font-bold font-serif">{entry.name}</h2>
                    <p className="text-xs text-slate-500 font-serif mb-2">
                        святых с этим именем: {entry.saints.length}
                    </p>
                    <Result entry={entry} born={born} year={year} />
                    <p className="text-sm mt-3">
                        <Link href={`/imeniny/${encodeURIComponent(entry.name)}`}
                              className="text-red-900 font-serif hover:underline">
                            страница имени {entry.name} →
                        </Link>
                    </p>
                </section>
            )}

            <section className="max-w-2xl">
                <h2 className="font-serif font-bold text-sm">Откуда это взято</h2>
                <p className="font-serif text-sm text-slate-600 mt-1">
                    Дни памяти — из святцев собрания, переведённые в гражданский календарь:
                    неподвижные сдвигом на тринадцать дней, подвижные отсчётом от Пасхи нужного
                    года. А вот <strong>указателя имён у святцев нет</strong>, и он выведен нами
                    разбором заголовков: 1 071 имя, 817 святых из 826.
                </p>
            </section>
        </div>
    );
};

export default Imeniny;

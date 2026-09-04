import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { keyOf, nameEntry } from "@/lib/imeniny/store";
import Result from "@/app/imeniny/Result";

// Страница одного имени: все дни памяти святых, его носивших.
//
// Своим адресом, а не одним лишь ответом формы: «когда именины у Николая» —
// вопрос, который задают поисковику, а не нам, и страница должна на него
// отвечать сама. Форма же на /imeniny отвечает на более узкий вопрос — про
// день рождения, — и делиться её ответом незачем.

export const revalidate = 86400;

type Props = { params: { name: string } };

const decode = (raw: string) => {
    try {
        return decodeURIComponent(raw);
    } catch {
        return "";
    }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const entry = await lookup(params.name);
    if (!entry) return { title: "Имя не найдено — Уставные чтения" };
    return {
        title: `Именины ${entry.name}: дни памяти — Уставные чтения`,
        description: `Когда именины у носящих имя ${entry.name}: все дни памяти святых с этим `
            + `именем по святцам, в гражданском календаре.`,
    };
}

const lookup = async (raw: string) => {
    const key = keyOf(decode(raw));
    return key ? nameEntry(key) : null;
};

const NamePage = async ({ params }: Props) => {
    const entry = await lookup(params.name);
    if (!entry) notFound();

    const year = new Date().getFullYear();

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-4`}>
            <div>
                <Link href="/imeniny" className="text-xs text-red-900 font-serif hover:underline">
                    ← ко всем именам
                </Link>
                <h1 className="font-bold font-serif mt-1">Именины: {entry.name}</h1>
                <p className="text-sm text-slate-500 font-serif">
                    святых с этим именем в святцах собрания: {entry.saints.length}
                </p>
            </div>

            <p className="font-serif text-slate-600 text-sm max-w-2xl">
                {/* Та же оговорка, что и на входе в раздел: страницу имени
                    открывают из поиска, минуя её. */}
                <strong>Именины — обычай, а не устав.</strong> Ближайшая память после дня
                рождения — самый ходовой порядок, но не единственный: назначают и по дню
                крещения, и по восьмому дню от рождения.{" "}
                <Link href={`/imeniny?name=${encodeURIComponent(entry.name)}`}
                      className="text-red-900 hover:underline">
                    посчитать по дню рождения →
                </Link>
            </p>

            <Result entry={entry} born={null} year={year} />

            <p className="text-xs text-slate-400 font-serif max-w-2xl">
                Дни памяти переведены в гражданский календарь: неподвижные — сдвигом на
                тринадцать дней, подвижные — отсчётом от Пасхи {year} года. Само имя выведено
                разбором заголовков святцев, а не взято из них готовым: указателя имён у собрания
                нет.
            </p>
        </div>
    );
};

export default NamePage;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont, csFont } from "@/utils/font";
import { commemoratorBySlug } from "@/lib/pomyannik/commemorators";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";
import Zapiska from "@/app/pomyannik/zapiska/Zapiska";

export const generateMetadata = async (
    props: { params: Promise<{ slug: string }> },
): Promise<Metadata> => {
    const { slug } = await props.params;
    const person = await commemoratorBySlug(slug);
    if (!person) return { title: "Кому подать записку" };
    return {
        title: `${person.title} — подать записку`,
        description: `Поминальная записка: ${person.title}`
            + `${person.place ? `, ${person.place}` : ""}. Оплат на сайте нет.`,
    };
};

const CommemoratorPage = async (props: { params: Promise<{ slug: string }> }) => {
    const { slug } = await props.params;
    const person = await commemoratorBySlug(slug);
    if (!person) notFound();

    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    const userId = session?.userId as string | undefined;

    const persons = userId ? await listPersons(userId) : [];
    const slavonic = persons.length
        ? await slavonicNames(persons.map(p => p.churchName || p.name))
        : {};

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl print:hidden">
                <h1 className="font-bold font-serif">{person.title}</h1>
                {person.place && <p className="font-serif text-slate-700 mt-1">{person.place}</p>}
                {person.about && (
                    <p className="font-serif text-slate-600 text-sm mt-2 whitespace-pre-wrap">
                        {person.about}
                    </p>
                )}
                {person.accepts.length > 0 && (
                    <p className="font-serif text-slate-600 text-sm mt-2">
                        Принимает: {person.accepts.map(k => NOTE_KIND_BY_KEY[k]?.label ?? k).join(", ")}.
                    </p>
                )}
                {person.dioceseUrl && (
                    <p className="font-serif text-sm mt-2">
                        <a href={person.dioceseUrl} target="_blank" rel="noreferrer noopener"
                           className="text-red-900 hover:underline break-all">
                            страница епархии, по которой мы его сверяли →
                        </a>
                    </p>
                )}
                <p className="font-serif text-slate-600 text-sm mt-2">
                    <strong>Оплаты здесь нет</strong>, и сана мы не удостоверяем: за него
                    отвечает епархия. Мы сверили страницу выше и ответ на письмо, посланное на
                    адрес в её домене.
                </p>
            </div>

            {!userId ? (
                <p className="font-serif text-slate-800 max-w-2xl">
                    Записка собирается из вашего помянника.{" "}
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>,
                    чтобы подать.
                </p>
            ) : persons.length === 0 ? (
                <p className="font-serif text-sm text-slate-600">
                    Ваш помянник пока пуст.{" "}
                    <Link href="/pomyannik/vvod" className="text-red-900 hover:underline">
                        Вписать имена
                    </Link>.
                </p>
            ) : (
                <Zapiska persons={persons} slavonic={slavonic}
                         to={{ title: person.title, place: person.place,
                               slug: person.slug, accepts: person.accepts }} />
            )}

            <p className="font-serif text-sm border-t pt-3">
                <Link href="/pominovenie" className="text-red-900 hover:underline">
                    ← кто ещё принимает записки
                </Link>
            </p>
        </div>
    );
};

export default CommemoratorPage;

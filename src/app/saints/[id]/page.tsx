import { notFound, permanentRedirect } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";
import { setMeta } from "@/lib/meta";
import { getItems, getLinkedNoble, getMemory, getMentions } from "@/app/saints/[id]/api";
import Content from "@/app/saints/[id]/Content";
import { myFont } from "@/utils/font";
import { dneslovIdsOf, getSaintByAddress, type Saint } from "@/lib/saints";
import { memoriesOfSaint } from "@/lib/memories";
import { dedicationsOfSaint } from "@/lib/temples";

// Адрес страницы святого — наш слуг (`saints.slug`). Номер памяти святцев
// (/saints/3030) остаётся рабочим навсегда и уводит постоянным редиректом: такие
// ссылки стоят в разметке самих текстов корпуса, и переписать их означало бы
// править корпус. Разбор адреса — в @/lib/saints.

type Props = {
    params: { id: string }
}

/** Что показать в заголовке: имя из нашего каталога, а не из чужого ответа по сети. */
const heading = (saint: Saint | null, address: string) =>
    saint?.name || saint?.title || `Память №${address}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const address = params.id;
    const saint = await getSaintByAddress(address);
    const name = heading(saint, address);
    const url = `//www.typikon.su/saints/${saint?.slug || address}`;

    return {
        title: `Страница святого - ${name}`,
        description: `Уставные чтения с упоминанием или авторством святого - ${name}`,
        openGraph: {
            type: "website",
            url,
            title: `Страница святого - ${name}`,
            description: `Уставные чтения с упоминанием или авторством святого - ${name}`,
        },
    };
}

const SaintItem = async ({ params: { id: address } }: Props) => {
    setMeta();

    const saint = await getSaintByAddress(address);

    // Пришли по старому адресу — уводим на новый. Постоянным: адрес сменился
    // насовсем, и поисковикам стоит об этом знать.
    if (saint?.slug && saint.slug !== address) permanentRedirect(`/saints/${saint.slug}`);

    // Слуга такого нет — значит нет и страницы. Раньше адресами были одни числа, и
    // мусор в них не заводился; теперь адрес — произвольный текст, и отдавать на любую
    // опечатку двухсотку с надписью «ничего не нашлось» значит плодить бесконечные
    // мягкие 404. Номера — исключение: по ним могут найтись тексты и без записи в
    // каталоге (например, у памяти, которая исчезла у святцев).
    if (!saint && !/^\d+$/.test(address)) notFound();

    // Тексты и акафисты по-прежнему подписаны номером святцев. Номеров у записи
    // может быть несколько — тогда это две их памяти, сведённые нами в одно лицо,
    // и тексты надо собрать по всем.
    const dneslovIds = dneslovIdsOf(saint);
    const known = dneslovIds.length ? dneslovIds : (/^\d+$/.test(address) ? [address] : []);

    const itemPromise = Promise.allSettled([
        getItems(known),
        getMemory(known[0]),
        getMentions(known),
        getLinkedNoble(known),
        // Досье: службы, назначенные этому лицу книгами, и храмы, ему посвящённые.
        // Ни то, ни другое не собирается заново — обе связи уже проставлены и до
        // сих пор просто не сходились на одной странице.
        memoriesOfSaint(known),
        dedicationsOfSaint(known),
    ]);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content
                    id={known[0] ?? address}
                    itemPromise={itemPromise}
                    // Только простые поля: дальше клиентский компонент, и документ
                    // Mongo целиком туда не сериализуется (ObjectId, Date).
                    facts={{
                        name: saint?.name ?? null,
                        altNames: saint?.altNames ?? [],
                        type: saint?.type ?? null,
                        orders: saint?.orders ?? [],
                        baseYear: saint?.baseYear ?? null,
                        memoryDates: saint?.memoryDates ?? [],
                        roundelUrl: saint?.roundelUrl ?? null,
                        images: (saint?.images ?? []).map((img) => ({
                            url: img.url, thumbUrl: img.thumbUrl ?? null, title: img.title ?? null,
                        })),
                    }}
                />
            </Suspense>
        </div>
    );
};

export default SaintItem;

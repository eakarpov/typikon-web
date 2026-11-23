import Content from "@/app/library/Content";
import {Suspense} from "react";
import {getItems} from "@/app/library/api";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {myFont} from "@/utils/font";
import Link from "next/link";
import {pageMetadata} from "@/lib/seo/metadata";
import {readLibraryQuery} from "@/utils/libraryBooks";

// Нужная страница каталога рендерится из URL, а выборка книг кэшируется на час.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
    title: "Библиотека текстов",
    description: "Библия, богослужебные книги, творения святых отцов, Пролог и жития святых. Оглавления книг, редакции и фильтры по языку, начертанию и тематике.",
    path: "/library",
});

const Library = async ({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) => {
    const itemsData = getItems();
    const query = readLibraryQuery(searchParams);
    setMeta();

    return (
        <div className="pt-2"><nav aria-label="Разделы библиотеки" className="flex gap-4 py-3"><Link href="/study">Каталог</Link><Link href="/study?tab=mine">Моё чтение</Link><Link href="/study?tab=topics">Изучить тему</Link></nav>
            <div className={myFont.variable}>
                <h1 className="font-serif font-bold mb-2">Библиотека текстов</h1>
                <p className="font-serif">
                    Книги для чтения целиком: Библия, богослужебные тексты, творения святых отцов, жития и справочная литература.
                </p>
                <p className="font-serif">
                    Часть текстов ещё не отекстована — <Link href="/texting" className="text-amber-800">помогите проекту с отекстовкой</Link>.
                </p>
                <Suspense fallback={<p>Загрузка книг…</p>}>
                    <Content itemsPromise={itemsData} query={query} />
                </Suspense>
            </div>
        </div>
    );
};

export default Library;

import Content from "@/app/library/Content";
import {Suspense} from "react";
import {getItems} from "@/app/library/api";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {myFont} from "@/utils/font";
import Link from "next/link";
import {pageMetadata} from "@/lib/seo/metadata";

// Фильтры читают URL на клиенте. В статической сборке useSearchParams скрывает
// весь список за Suspense до JavaScript. Динамический HTML сохраняет карточки
// и ссылки для обходчика; сама выборка books по-прежнему кэшируется на час.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
    title: "Библиотека текстов",
    description: "Библия, богослужебные книги, творения святых отцов, Пролог и жития святых. Оглавления книг, редакции и фильтры по языку, начертанию и тематике.",
    path: "/library",
});

const Library = async () => {
    const itemsData = getItems();
    setMeta();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <h1 className="font-serif font-bold mb-2">Библиотека текстов</h1>
                <p className="font-serif">
                    Книги для чтения целиком: Библия, богослужебные тексты, творения святых отцов, жития и справочная литература.
                </p>
                <p className="font-serif">
                    Часть текстов ещё не отекстована — <Link href="/texting" className="text-amber-800">помогите проекту с отекстовкой</Link>.
                </p>
                <Suspense fallback={<div>Loading...</div>}>
                    <Content itemsPromise={itemsData} />
                </Suspense>
            </div>
        </div>
    );
};

export default Library;

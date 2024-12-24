import SearchForm from "@/app/components/search/Form";
import React, { Suspense } from "react";
import {myFont} from "@/utils/font";

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any[], IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [items, error] = await itemsPromise;

    if (error) return null;

    return (
        <div>
            <span className="font-serif">
                Поиск по названию текста.<br/>
                Для поиска используйте только кириллические буквы А-Я/а-я<br/>
            </span>
            <Suspense>
                <SearchForm initial={items} />
            </Suspense>
        </div>
    );
};

export default Content;

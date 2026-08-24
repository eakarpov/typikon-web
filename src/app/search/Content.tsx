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
                Поиск по названию и содержимому текстов.<br/>
                Ударения и церковнославянское написание учитывать не нужно:
                «стражи» находит «стра́жи», «иоанна» — «і҆ѡа́нна».<br/>
            </span>
            <Suspense>
                <SearchForm initial={items} />
            </Suspense>
        </div>
    );
};

export default Content;

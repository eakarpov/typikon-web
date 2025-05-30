import {Suspense} from "react";
import Content from "@/app/dictionary/Content";
import { searchData } from "./api";
import SearchForm from "@/app/dictionary/SearchForm";
import {myFont} from "@/utils/font";

const Search = (req: { searchParams: { query?: string; }}) => {
    if (!req.searchParams.query) {
        return (
            <div className={myFont.variable}>
                <span className="font-serif">
                    Вы не задали никакого запроса. Поиск по названию текста.
                </span>
                <div>
                    <Suspense>
                        <SearchForm />
                    </Suspense>
                </div>
            </div>
        );
    }

    const data = searchData(req.searchParams.query);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={data} />
            </Suspense>
        </div>
    )
};

export default Search;

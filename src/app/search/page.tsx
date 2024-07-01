import {Suspense} from "react";
import Content from "@/app/search/Content";
import { searchData } from "./api";
import SearchForm from "@/app/components/search/Form";

const Search = (req: { searchParams: { query?: string; }}) => {
    if (!req.searchParams.query) {
        return (
            <div>
                Вы не задали никакого запроса. Поиск по названию текста.
                <div>
                    <SearchForm />
                </div>
            </div>
        );
    }

    const data = searchData(req.searchParams.query);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            {/* @ts-expect-error Async Server Component */}
            <Content itemsPromise={data} />
        </Suspense>
    )
};

export default Search;

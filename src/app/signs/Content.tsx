import PublicSignsListView from "@/app/signs/PublicSignsListView";
import {SignsListResult} from "@/lib/signs/list";

interface ISearchParams {
    page?: string;
    q?: string;
    month?: string;
}

interface IContent {
    itemsPromise: Promise<[SignsListResult, null]>;
    searchParams: ISearchParams;
}

const Content = async ({ itemsPromise, searchParams }: IContent) => {
    const [result] = await itemsPromise;

    if (!result || result.error) {
        return (
            <div>
                <p>
                    Ошибка при загрузке данных
                </p>
            </div>
        )
    }

    return (
        <div className="mt-2">
            <h1 className="font-serif font-bold">Памяти по знаку Типикона</h1>
            <PublicSignsListView result={result} searchParams={searchParams} />
        </div>
    );
};

export default Content;

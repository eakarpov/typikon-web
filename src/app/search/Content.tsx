import Link from "next/link";
import SearchForm from "@/app/components/search/Form";

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
            Поиск по названию текста.<br/>
            <SearchForm initial={items} />
        </div>
    );
};

export default Content;

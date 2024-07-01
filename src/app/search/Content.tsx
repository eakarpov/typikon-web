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
            <SearchForm />
            {items.map(item => (
                <div key={item.id}>
                    <Link href={`/reading/${item.id}`}>
                        {item.name}
                    </Link>
                </div>
            ))}
        </div>
    );
};

export default Content;

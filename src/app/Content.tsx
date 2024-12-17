import Link from "next/link";

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
        <div className="flex flex-col">
            <h3 className="text-xl font-bold font-serif">Последние добавленные материалы</h3>
            {items.map((item, index) => (
                <div key={item.id} className="font-serif flex flex-row">
                    <span>{index + 1}.&nbsp;</span>
                    <Link href={`/reading/${item.alias || item.id}`} className="text-red-600">
                        {item.name}
                    </Link>
                    <span className="font-normal">
                        &nbsp;(Обновлено {item.updatedAt.toLocaleDateString()})
                    </span>
                </div>
            ))}
        </div>
    );
};

export default Content;

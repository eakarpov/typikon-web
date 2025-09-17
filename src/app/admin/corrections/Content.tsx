import Link from "next/link";
import {useCallback} from "react";

interface ICorrection {
    _id: string;
    userId: string;
    correction: any;
    selection: any;
    textId: string;
}

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const [items, error] = await itemsPromise;

    const onDelete = useCallback((item: ICorrection) => () => {
        console.log(item);
    }, []);

    if (error) {
        return (
            <div>
                Ошибка получения
            </div>
        );
    }

    return (
        <div>
            <div>
                Количество предложенных исправлений - {items.length}
            </div>
            {items.map((item: ICorrection) => (
                <div key={item._id.toString()}>
                    <div>
                        {item.userId}
                    </div>
                    <div>
                        {JSON.stringify(item.selection)}
                    </div>
                     <div>
                         {JSON.stringify(item.correction)}
                     </div>
                    <div>
                        <Link href={`/reading/${item.textId}`}>
                            {item.textId}
                        </Link>
                    </div>
                    <div onClick={onDelete(item)}>
                        Удалить
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

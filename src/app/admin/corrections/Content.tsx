import Link from "next/link";
import DeleteItem from "@/app/admin/corrections/DeleteItem";
import {ICorrection} from "@/types/dto/corrections";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<any[]> }) => {

    const [items, error] = await itemsPromise;

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
                    <DeleteItem item={item} />
                </div>
            ))}
        </div>
    );
};

export default Content;

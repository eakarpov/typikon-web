import Link from "next/link";
import ApproveItem from "@/app/admin/texting/ApproveItem";
import RejectItem from "@/app/admin/texting/RejectItem";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[any[], any]> }) => {

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
                Предложений на рассмотрении - {items.length}
            </div>
            {items.map((item: any) => (
                <div key={item.id} className="flex flex-col border-b-2 py-2 mb-2">
                    <div className="flex flex-row items-center">
                        <Link href={`/reading/${item.textId}`} className="font-bold">
                            {item.text?.name || item.textId}
                        </Link>
                        {item.text?.link && (
                            <a
                                href={item.text.link}
                                target="_blank"
                                rel="noreferrer"
                                className="pl-2 text-amber-800"
                            >
                                Скан
                            </a>
                        )}
                    </div>
                    <div className="text-stone-500 text-sm">
                        Пользователь: {item.userId}
                    </div>
                    <div className="whitespace-pre-wrap">
                        {item.content}
                    </div>
                    {item.comment && (
                        <div className="text-stone-600">
                            Комментарий: {item.comment}
                        </div>
                    )}
                    <div className="flex flex-row gap-2 mt-2">
                        <ApproveItem id={item.id} />
                        <RejectItem id={item.id} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

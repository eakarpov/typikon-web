import Link from "next/link";
import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";
import {ReadinessButton} from "@/app/components/DayPart";

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any[], IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [items, error] = await itemsPromise;

    if (error) {
        return (
            <div>
                <p>
                    Ошибка при загрузке данных
                </p>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="mt-2">
                <p className="font-serif">
                    Сейчас нет документов, ожидающих отекстовки.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-2">
            {items.map((item: any) => (
                <div key={item.id} className="flex flex-col mb-4">
                    <div className="flex flex-row items-center">
                        <span className="w-fit text-xs pr-2">
                            <ReadinessButton value={item.readiness} />
                        </span>
                        <Link
                            className="cursor-pointer font-bold font-serif"
                            href={`/texting/${item.id}`}
                        >
                            {item.bookName && (
                                <span className="font-normal text-stone-500">{item.bookName}. </span>
                            )}
                            {item.name || item.id}
                        </Link>
                    </div>
                    {item.description && (
                        <p className="font-serif text-stone-600">
                            {item.description}
                        </p>
                    )}
                    <div className="flex flex-row items-center">
                        {item.link && (
                            <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                                <a href={item.link} target="_blank" rel="noreferrer">
                                    Скан текста&nbsp;
                                </a>
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            </span>
                        )}
                        <Link
                            href={`/texting/${item.id}`}
                            className="cursor-pointer font-serif text-amber-800"
                        >
                            Предложить свой вариант
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

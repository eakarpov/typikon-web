import Link from "next/link";

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any[], IError?]>;
}

const Content = async ({ itemsPromise }: IContent) => {
    const [items, error] = await itemsPromise;

    if (error) {
        return (
            <div>
                <p>Ошибка при загрузке данных</p>
            </div>
        );
    }

    return (
        <div className="mt-2">
            <h1 className="font-serif font-bold">Общие службы</h1>
            <p className="pt-2 font-serif text-stone-400">
                Чтения общие по чину святого (преподобным, святителям, мученикам и т.д.) —
                используются, когда для конкретного дня нет собственных, специально
                назначенных чтений.
            </p>
            <div className="flex flex-col space-y-1 pt-2">
                {items.map((day: any) => (
                    <Link
                        key={day.id}
                        href={`/weeks/${day.alias || day.id}`}
                        className="cursor-pointer font-serif"
                    >
                        {day.name}
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Content;

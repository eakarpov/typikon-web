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
        )
    }

    return (
        <div className="mt-2">
            <h1 className="font-serif font-bold">Памяти по знаку Типикона</h1>
            <div className="pt-2 font-serif">
                <p>
                    Данный раздел на сегодня в разработке.
                </p>
            </div>

            {items.map((sign: any) => (
                <div key={sign.id} className="flex flex-row mb-4">
                    <p className="text-slate-400 font-serif">
                        {sign.name} - ({sign.date}.{sign.month}) - {sign.sign} (Источик: {sign.source})
                    </p>
                </div>
            ))}
        </div>
    );
};

export default Content;

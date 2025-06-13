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
            Количество предложенных исправлений - {items.length}
        </div>
    );
};

export default Content;

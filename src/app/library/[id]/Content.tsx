import Link from "next/link";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item, err] = await itemPromise;

    if (err) {
        return (
            <div>
                Ошибка поиска
            </div>
        );
    }
    if (!item) {
        return (
          <div>
              Ничего не нашлось
          </div>
        );
    }

    return (
        <div className="flex flex-col pt-2">
            <p>
                <strong>{item.name}</strong>
            </p>
            <div className="pt-2">
                {item.texts.map((text: any) => (
                    <p key={text._id.toString()}>
                        <Link
                            href={`/reading/${text._id.toString()}`}
                            className="cursor-pointer"
                        >
                            {text.name || text._id.toString()}
                        </Link>
                    </p>
                ))}
            </div>
        </div>
    );
};

export default Content;

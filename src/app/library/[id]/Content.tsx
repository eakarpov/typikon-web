import Link from "next/link";
import CountMeta from "@/app/meta/CountMeta";
import DneslovRoundImage from "@/lib/common/DneslovRoundImage";

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
            <CountMeta />
            <h1 className="font-bold">{item.name}</h1>
            {item.author && (
                <p>
                    <strong>Автор: </strong>{item.author}
                </p>
            )}
            {item.translator && (
                <p>
                    <strong>Переводчик: </strong>{item.translator}
                </p>
            )}
            <h2>Содержание:</h2>
            <div className="pt-2">
                {item.texts.map((text: any) => (
                    <div className="flex flex-row" key={text._id.toString()}>
                        {false && (
                            <div style={{ width: "42px"}}>
                                <DneslovRoundImage id={text.dneslovId} />
                            </div>
                        )}
                        <Link
                            href={`/reading/${text._id.toString()}`}
                            className="cursor-pointer font-serif"
                        >
                            {text.name || text._id.toString()}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Content;

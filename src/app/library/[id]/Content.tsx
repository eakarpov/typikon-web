import Link from "next/link";
import CountMeta from "@/app/meta/CountMeta";
import DneslovRoundImage from "@/lib/common/DneslovRoundImage";
import {UserCircleIcon} from "@heroicons/react/24/outline";

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
            <h1 className="font-bold font-serif">{item.name}</h1>
            {item.author && (
                <p className="font-serif">
                    <strong>Автор: </strong>{item.author}
                </p>
            )}
            {item.translator && (
                <p className="font-serif">
                    <strong>Переводчик: </strong>{item.translator}
                </p>
            )}
            <h2 className="font-serif">Содержание:</h2>
            <div className="pt-2">
                {item.texts.map((text: any) => (
                    <div className="flex flex-row items-center" key={text._id.toString()}>
                        <div style={{ width: "42px", height: "42px", display: 'flex', alignItems: 'center' }}>
                            <DneslovRoundImage
                                textType={text.type}
                                id={text.dneslovId}
                            />
                        </div>
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

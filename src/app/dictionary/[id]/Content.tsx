import React, {Suspense} from "react";

const labels = {
    A: "прилагательное",
    S: "существительное",
    m: "мужской род",
    anim: "одушевлённое",
    persn: "личное имя"
}

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any, IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [item, error] = await itemsPromise;

    if (error) return null;

    if (!item) return null;

    return (
        <div className="font-serif">
            <p>
                Слово -
                <span className="font-bold">
                    {item.name}
                </span>
            </p>
            <p>
                Свойства - {item.properties?.split(",").map((el: keyof typeof labels) => labels[el]).join(",")}
            </p>
            {/*<p>*/}
            {/*    Схема склонения - {item.scheme}*/}
            {/*</p>*/}
        </div>
    );
};

export default Content;
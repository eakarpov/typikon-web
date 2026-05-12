import React  from "react";
import State from "@/app/nobles/families/[id]/Family";

const Content = async ({ itemPromise }: {itemPromise: any}) => {
    const [item, error] = await itemPromise;

    if (!item || error) {
        return (
            <div>
                <p>
                    Данные не получены. Редактирование недоступно.
                </p>
            </div>
        );
    }

    return <State value={item} />;

};

export default Content;
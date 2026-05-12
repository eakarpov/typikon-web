import React  from "react";
import Family from "@/app/nobles/states/[id]/State";

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

    return <Family value={item} />;

};

export default Content;
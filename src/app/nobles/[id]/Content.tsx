import React  from "react";
import Nobles from "@/app/nobles/[id]/Nobles";

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

    return <Nobles value={item} />;

};

export default Content;
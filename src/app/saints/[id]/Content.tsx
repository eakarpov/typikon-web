import React from "react";
import SaintPage from "@/app/saints/[id]/SaintPage";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [first, second, third, fourth] = await itemPromise;
    const [items] = first.value;
    const [mentions] = third.value;
    const [linkedNoble] = fourth.status === "fulfilled" ? fourth.value : [null];

    if (!second.value) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SaintPage item={second.value} items={items} mentions={mentions} linkedNoble={linkedNoble} />
    )
};

export default Content;
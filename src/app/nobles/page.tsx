import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/nobles/Content";

const NoblesPage = async () => {

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                <Content />
            </Suspense>
        </div>
    );
};

export default NoblesPage;
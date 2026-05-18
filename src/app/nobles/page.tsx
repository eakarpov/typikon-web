import {myFont} from "@/utils/font";
import {Suspense} from "react";
import Content from "@/app/nobles/Content";

const NoblesPage = async () => {

    return (
        <div className={myFont.variable}>
            <p className="font-serif">
                Для просмотра древа князей и царей, выберите точку отсчета - список доступен по имени в кириллице, соблюдая заглавные буквы.
                После перехода к выбранному имени будет доступно дерево 1-го уровня (родители/дети/супруги), правления, которые относятся к данному имени и параллели из других родов, которые жили в то же время.
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                <Content />
            </Suspense>
        </div>
    );
};

export default NoblesPage;
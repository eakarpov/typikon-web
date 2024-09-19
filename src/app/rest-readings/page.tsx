import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Чтения на год",
    description: "Уставные чтения вне триодных периодов Постной и Цветной Триодей.",
    openGraph: {
        title: "Чтения на год",
        description: "Уставные чтения вне триодных периодов Постной и Цветной Триодей.",
        url: "//www.typikon.su/rest-readings/",
        type: "website",
    },
};

const RestReadings = () => {
    setMeta();

    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке.
            </p>
            <p>
                В данном разделе будет информация об уставных чтения с начала Петрова поста до недели о мытаре и фарисее.
            </p>
        </div>
    );
};

export default RestReadings;

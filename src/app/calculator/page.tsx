import Editor from "@/app/calculator/Editor";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Чтения на день",
    description: 'Уставные чтения на выбранный день годового и триодного круга.',
    openGraph: {
        title: 'Чтения на день',
        description: 'Уставные чтения на выбранный день годового и триодного круга.',
        url: "//www.typikon.su/calculator/"
    },
}

const ReadingCalculator = () => {
    setMeta();

    return (
        <div className="pt-2">
            <Editor />
        </div>
    );
};

export default ReadingCalculator;

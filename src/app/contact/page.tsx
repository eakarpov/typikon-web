import Content from "@/app/contact/Content";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Обратная связь",
    description: 'Уставные чтения, обратная связь с пользователями.',
    openGraph: {
        title: 'Обратная связь',
        description: 'Уставные чтения, обратная связь с пользователями.',
        url: "//www.typikon.su/contact/"
    },
}

const Library = async () => {
    setMeta();
    return (
        <div className="pt-2">
            <h1>
                Обратная связь
            </h1>
            <p>
                На данный момент можно оставить замечание/пожелание или связаться с командой проекта через данную форму обратной связи.
            </p>
            <Content />
        </div>
    );
};

export default Library;

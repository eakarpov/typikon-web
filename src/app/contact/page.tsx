import Content from "@/app/contact/Content";

const Library = async () => {

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

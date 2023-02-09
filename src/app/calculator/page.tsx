import Editor from "@/app/calculator/Editor";

const ReadingCalculator = () => {
    return (
        <div className="pt-2">
            <p>
                Данный раздел на сегодня в разработке.
            </p>
            <p>
                Предполагается следующий вариант использования: выбор в двух полях дня по пасхальному кругу и календарной даты. На основании этого формирование веб-версии чтения на заданную конфигурацию дня.
            </p>
            <Editor />
        </div>
    );
};

export default ReadingCalculator;

const About = () => {
    return (
        <div className="flex flex-col gap-3 py-4">
            <h1>
                <strong>Информация о портале</strong>
            </h1>
            <p>
                Корпус церковнославянских уставных чтений по Типикону: тексты, привязка к дням
                церковного года, зачала и знаки месяцеслова.
            </p>
            <p>
                История версий переехала в{" "}
                <a href="/news" className="text-amber-800 underline underline-offset-4">новости</a>:
                там у каждого выпуска свой адрес, а о новом можно узнать по{" "}
                <a href="/rss.xml" className="text-amber-800 underline underline-offset-4">RSS</a>,
                не заходя на эту страницу.
            </p>
            <h2>
                В работе: выпуск 6.0
            </h2>
            <ul>
                <li>
                    - Типизация
                </li>
                <li>
                    - Алиасы в разделе Библиотека
                </li>
            </ul>
            <h2>
                Дальше
            </h2>
            <ul>
                <li>
                    - Готовность Цветной Триоди
                </li>
            </ul>
        </div>
    );
};

export default About;

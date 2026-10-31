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
                Выпущена версия 6.5
            </h2>
            <p>
                <a href="/news/versiya-6-5" className="text-amber-800 underline underline-offset-4">
                    Что нового в выпуске 6.5
                </a>
            </p>
        </div>
    );
};

export default About;

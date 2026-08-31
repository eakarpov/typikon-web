import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";

// Человеческая документация к публичному API. Машинное описание — /api/v2/openapi.json,
// оно собирается из тех же констант, что и сами ручки.
export const revalidate = 86400;

export const metadata: Metadata = {
    title: "API — Уставные чтения",
    description:
        "Публичный API корпуса уставных чтений: тексты, книги, чтения на день, зачала. " +
        "Корпус под лицензией CC BY 4.0.",
};

const Endpoint = ({ method = "GET", path, children }: { method?: string; path: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1 border-l-2 border-slate-300 pl-3 py-1">
        <code className="text-sm">
            <span className="text-slate-500">{method}</span> {path}
        </code>
        <p className="text-sm text-slate-700">{children}</p>
    </div>
);

const Example = ({ children }: { children: React.ReactNode }) => (
    <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto">
        {children}
    </pre>
);

const ApiDocs = () => (
    <div className={`${myFont.variable} flex flex-col gap-6 pt-4 pb-8 font-serif`}>
        <section className="flex flex-col gap-2">
            <h1 className="text-xl font-bold">API</h1>
            <p>
                Корпус доступен машинам так же, как людям: тексты, книги, чтения на любой
                день церковного года, зачала и знаки месяцеслова. Попробовать можно без
                ключа; для настоящей работы ключ заводится за минуту в профиле.
            </p>
            <p>
                Базовый адрес — <code>https://www.typikon.su/api/v2</code>. Машинное описание:{" "}
                <a href="/api/v2/openapi.json" className="text-amber-800 underline underline-offset-4">
                    openapi.json
                </a>
                . Начать знакомство удобно с{" "}
                <a href="/api/v2" className="text-amber-800 underline underline-offset-4">
                    /api/v2
                </a>{" "}
                — там счётчики корпуса и список ручек.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Лицензия</h2>
            <p>
                Корпус — под{" "}
                <a
                    href="https://creativecommons.org/licenses/by/4.0/deed.ru"
                    className="text-amber-800 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                >
                    CC BY 4.0
                </a>
                : берите свободно, в том числе для коммерческих целей, указывая источник.
            </p>
            <p className="border-l-2 border-slate-300 pl-3 text-slate-700">
                Корпус «Уставные чтения» (typikon.su), CC BY 4.0
            </p>
            <p>
                Оригиналы памятников — в общественном достоянии. Сканы, русские переводы и
                сведения о святых принадлежат их владельцам, см.{" "}
                <Link href="/license" className="text-amber-800 underline underline-offset-4">
                    условия использования
                </Link>
                .
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Ключи и ограничения</h2>
            <p>
                Корпус свободен, а вот силы сервера — нет: один нетерпеливый скрипт в
                несколько потоков способен занять собой всё. Поэтому доступ отмерен, и чем
                лучше мы знаем клиента, тем больше ему полагается.
            </p>
            <ul className="flex flex-col gap-1 list-disc pl-5">
                <li>
                    <b>Без ключа</b> — 60 запросов в час с адреса, кроме поиска. Этого хватает
                    попробовать ручку и написать первый запрос.
                </li>
                <li>
                    <b>С ключом</b> — 30 запросов в минуту и 10 000 в сутки, все разделы,
                    включая поиск. Ключ выпускается в{" "}
                    <Link href="/profile#tokens" className="text-amber-800 underline underline-offset-4">
                        профиле
                    </Link>{" "}
                    после входа на сайт; их может быть до пяти.
                </li>
                <li>
                    <b>Нужно больше</b> — напишите через обратную связь и расскажите, для чего:
                    приложениям и постоянным потребителям ключи выдаются со своими числами.
                </li>
            </ul>
            <p>
                Ключ передаётся заголовком <code>Authorization: Bearer …</code> (или{" "}
                <code>X-Api-Key</code>, если первый занят прокси). Он именной — не зашивайте
                его в страницу, которую отдаёте посетителям: всё, что попало в браузер,
                публично. Пропавший ключ отзывается в профиле, старый при этом сразу
                перестаёт работать.
            </p>
            <Example>{`curl -H "Authorization: Bearer tk_…" \\
  "https://www.typikon.su/api/v2/search?q=пасха"`}</Example>
            <p>
                В каждом ответе видно, сколько осталось: <code>X-RateLimit-Remaining</code> и{" "}
                <code>X-Quota-Remaining</code>. Суточный счётчик обнуляется в полночь UTC
                (03:00 московского времени).
            </p>
        </section>

        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Чтения на день</h2>
            <p>
                Главное, ради чего стоит идти в этот API. Дата гражданская — всё остальное
                считается: подвижный круг с отступкой и преступкой, неподвижный календарь,
                памяти месяцеслова и зачала с текстом стихов.
            </p>
            <Endpoint path="/api/v2/calendar/{ГГГГ-ММ-ДД}">
                Что читается в этот день. Параметр <code>lang=cs|ro</code> — язык зачал.
            </Endpoint>
            <Endpoint path="/api/v2/calendar/today">Он же на сегодня.</Endpoint>
            <Endpoint path="/api/v2/days/{alias}">
                День по постоянному адресу — <code>pascha</code>, <code>march-30</code>,{" "}
                <code>post-1-sb</code>, — без пересчёта подвижного круга.
            </Endpoint>
            <Example>{`curl https://www.typikon.su/api/v2/calendar/2026-04-12

{
  "date": "2026-04-12",
  "churchDate": "2026-03-30",
  "movable": { "week": 1, "day": 0, "type": "Pascha" },
  "memories": { "primary": { "name": "..." }, "secondary": [] },
  "day": {
    "name": "Пасха",
    "readings": [
      { "slot": "song6", "title": "По шестой песни", "items": [ ... ] },
      { "slot": "gospelLiturgy", "title": "Евангелие на Литургии",
        "items": [ { "pericope": { "label": "Ин. 1", "verses": [ ... ] } } ] }
    ]
  }
}`}</Example>
        </section>

        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Тексты и книги</h2>
            <Endpoint path="/api/v2/texts">
                Список. Фильтры: <code>book</code>, <code>readiness</code>, <code>saint</code>,{" "}
                <code>updatedSince</code>. Тела текста здесь нет — оно в карточке.
            </Endpoint>
            <Endpoint path="/api/v2/texts/{alias|id}">
                Текст целиком. Для библейских книг — со стихами.
            </Endpoint>
            <Endpoint path="/api/v2/books">Книги корпуса.</Endpoint>
            <Endpoint path="/api/v2/books/{id}">Книга со списком своих текстов.</Endpoint>
            <Endpoint path="/api/v2/search?q=">
                Поиск по названию и содержимому. Ударения и церковнославянское написание
                набирать не нужно: «стражи» находит «стра́жи», «иоанна» — «і҆ѡа́нна».
                Фрагмент возвращается в исходном написании.
            </Endpoint>
            <Example>{`curl "https://www.typikon.su/api/v2/texts?readiness=ready&limit=2"

{
  "items": [ { "id": "...", "alias": "prolog-08-11-eupl", "name": "..." } ],
  "total": 2356,
  "limit": 2,
  "offset": 0
}`}</Example>
        </section>

        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Справочники</h2>
            <Endpoint path="/api/v2/pericopes">
                Зачала: источник, книга, номер, диапазоны стихов и дни, когда читается.
            </Endpoint>
            <Endpoint path="/api/v2/signs">
                Знаки Типикона по месяцеслову. Месяц и число — по старому стилю.
            </Endpoint>
            <Endpoint path="/api/v2/months">Месяцы, и <code>/months/{"{alias}"}</code> — с днями.</Endpoint>
            <Endpoint path="/api/v2/weeks">
                Седмицы Триоди, <code>cycle=triodion|penticostarion</code>.
            </Endpoint>
            <Endpoint path="/api/v2/news">
                Новости сайта: что пополнилось в корпусе и что изменилось. Тело записи —
                markdown. Отдельная новость — <code>/api/v2/news/{"{alias}"}</code>,
                для читалок — <a href="/rss.xml" className="text-amber-800 underline underline-offset-4">RSS</a>.
            </Endpoint>
                        <Endpoint path="/api/v2/saints/{id}">
                Тексты памяти святого и тексты, где он упоминается. Идентификатор — из
                святцев dneslov.org.
            </Endpoint>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Ударения</h2>
            <p>
                Где в церковнославянском слове стоит ударение — 294 тысячи основ из трёх
                источников: <code>corpus</code> — книжные чтения (с частотами),{" "}
                <code>chants</code> — гимнография, Октоих, Минеи, Триоди, Часослов (с частотами),{" "}
                <code>lexicon</code> — порождённые парадигмы словаря церковнославянского
                (с грамматикой). Источники пересекаются лишь частично, поэтому пустой{" "}
                <code>corpus</code> при непустом <code>chants</code> — обычное дело.
            </p>
            <p>
                Частоты книг и песнопений <strong>не складываются</strong>: жанр переворачивает
                большинство. «Спасе» в чтениях — аорист «спасе́» (50 раз), в песнопениях —
                звательный «спа́се» (2024 раза). Берите тот источник, который отвечает вашему
                тексту; словарь при этом объяснит, отчего разница — «спасти́» aor. против
                «спа́съ» sg.voc.
            </p>
            <Endpoint path="/api/v2/accents/{word}">
                Ударение одного слова. Слать можно как есть — с ударениями, звательцем, в
                любой графике: «а҆́ще», «аще» и «А́ЩЕ» — один и тот же запрос. Слова, которого
                в словаре нет, — это <code>200</code> с <code>known: false</code>, а не{" "}
                <code>404</code>: имён собственных и редких форм там нет и не будет, и для
                потребителя это рабочий ответ, а не сбой.
            </Endpoint>
            <Endpoint path="/api/v2/accents?words=аще,земли,зело">
                До 200 слов за раз; ответ идёт в том же порядке, что и запрос. Без параметра{" "}
                <code>words</code> — сводка по словарю и ссылка на выгрузку целиком.
            </Endpoint>
            <p>
                <code>vowel</code> — номер ударной гласной с нуля, а не позиция символа:
                позиция зависит от того, разложены ли <code>ї</code> и <code>й</code>, а номер
                гласной не зависит. Знаков три: оксия <code>U+0301</code>, вария{" "}
                <code>U+0300</code>, камора <code>U+0311</code>.
            </p>
            <p>
                Поле <code>agree</code> говорит, сошлись ли все знающие слово источники на одной
                гласной.{" "}
                <code>false</code> не обязательно значит ошибку: «зе́мли» (мн. им.) и «землѝ»
                (ед. род.) оба верны и без знаков пишутся одинаково.
            </p>
            <p className="text-slate-600">
                Словарь <strong>описательный, а не нормативный</strong>: он говорит, как слово
                размечено в этом собрании и сколько раз, а не как правильно. Где ошибся
                наборщик — ошибётся и словарь; где в книгах разнобой, там расходятся и варианты.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Соглашения</h2>
            <p>
                Списки приходят в одном виде: <code>{"{ items, total, limit, offset }"}</code>.
                По умолчанию 50 записей, не больше 200 за раз.
            </p>
            <p>
                Ошибка — всегда с телом:{" "}
                <code>{'{ "error": { "code": "not_found", "message": "..." } }'}</code>. Коды:{" "}
                <code>bad_request</code>, <code>not_found</code>, <code>unauthorized</code>,{" "}
                <code>forbidden</code>, <code>rate_limited</code>, <code>quota_exceeded</code>,{" "}
                <code>internal</code>.
            </p>
            <p>
                При исчерпании частоты или суточной квоты приходит <code>429</code> с
                заголовком <code>Retry-After</code>; с непризнанным или отозванным ключом —{" "}
                <code>401</code>, а если ключ настоящий, но раздела не даёт — <code>403</code>.
            </p>
            <p>
                Запросы из браузера разрешены с любого источника. В каждом ответе есть
                заголовки <code>X-License</code> и <code>Link: rel=&quot;license&quot;</code>.
                Ответы по ключу помечены <code>Cache-Control: private</code> — общему кэшу
                их складывать незачем, остаток лимита у каждого свой.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Стабильность</h2>
            <p>
                В версии 2 поля только добавляются — существующие не переименовываются и не
                исчезают. Несовместимые изменения выйдут отдельной версией.
            </p>
            <p className="text-slate-600 text-sm">
                Версия 1 (<code>/api/v1</code>) осталась для мобильного приложения и
                выводится из обращения: её ответы помечены заголовками{" "}
                <code>Deprecation</code>, <code>Sunset</code> и{" "}
                <code>Link: rel=&quot;successor-version&quot;</code>. Новым клиентам следует
                брать вторую.
            </p>
        </section>

        <p>
            Вопросы и замечания —{" "}
            <Link href="/contact" className="text-amber-800 underline underline-offset-4">
                через обратную связь
            </Link>
            .
        </p>
    </div>
);

export default ApiDocs;

import type { Metadata } from "next";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import * as ch from "@/utils/chronology";
import { diagnose, Field, FIELDS, Record_, solve } from "@/lib/dating";
import Form from "@/app/chronology/Form";
import Result from "@/app/chronology/Result";
import Calendars, { YearNumbers } from "@/app/chronology/Calendars";
import DateForm, { INPUT_CALENDARS, InputCalendar } from "@/app/chronology/DateForm";
import Tabs, { Tab } from "@/app/chronology/Tabs";

// Хронологический решатель: числа года в обе стороны и датировка записи
// перебором. Пособие не для читателя, а для того, кто держит в руках источник
// с датой вида «в лето 6712, индикта 7, месяца марта в 5 день, в неделю» и
// хочет знать, какой это год и цела ли сама запись.
//
// Считает @/utils/chronology (сверено с Приложением Типикона, гл. 63, на 532
// годах великого индиктиона), перебирает @/lib/dating. Страница только
// спрашивает и показывает.

export const metadata: Metadata = {
    title: "Хронологический решатель — Уставные чтения",
    description:
        "Даты от Сотворения мира, индикты, круги Солнцу и Луне, вруцелето, ключевые буквы — "
        + "в обе стороны. Разбор летописной даты перебором: какой это год и нет ли в записи описки.",
    openGraph: {
        title: "Хронологический решатель",
        description:
            "Перевод дат от Сотворения мира и разбор летописных датировок на внутреннюю "
            + "непротиворечивость.",
        url: "//www.typikon.su/chronology/",
    },
};

const DEFAULT_FROM = 988;
const DEFAULT_TO = 1700;

const numeric = (value: string | undefined, min: number, max: number) => {
    if (!value) return undefined;
    const n = Number(value.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

/** Что из адреса удалось прочесть как условие записи. */
const readRecord = (params: Record<string, string | undefined>) => {
    const record: Record_ = {};
    const ranges: Partial<Record<Field, [number, number]>> = {
        indikt: [1, 15], krugSolntsu: [1, 28], krugLune: [1, 19],
        vrutseleto: [1, 7], osnovanie: [1, 30], epakta: [0, 30],
    };
    for (const field of FIELDS) {
        const bounds = ranges[field];
        if (bounds) {
            const value = numeric(params[field], bounds[0], bounds[1]);
            if (value !== undefined) (record as any)[field] = value;
        }
    }
    const letter = (params.klyuchGranits || "").trim();
    if (letter && ch.KLYUCH_LETTERS.includes(letter as any)) record.klyuchGranits = letter;

    const weekday = (params.weekday || "").trim();
    if (ch.WEEKDAYS.includes(weekday as ch.Weekday)) record.weekday = weekday as ch.Weekday;

    record.leto = numeric(params.leto, 1, 9999);
    const month = numeric(params.month, 1, 12);
    const day = numeric(params.day, 1, 31);
    // Месяц без числа день не задаёт, а число без месяца тем более: они идут
    // только парой, иначе перебору нечего прикладывать ко дню недели.
    if (month && day) { record.month = month; record.day = day; }

    return record;
};

const asked = (record: Record_) =>
    Object.values(record).some(v => v !== undefined);

/** День, набранный в форме перевода, — или null, если набрано не всё. */
const readDay = (params: Record<string, string | undefined>): number | null => {
    const day = numeric(params.dday, 1, 31);
    const month = numeric(params.dmonth, 1, 12);
    const year = numeric(params.dyear, 1, 9999);
    if (!day || !month || !year) return null;
    const calendar = (INPUT_CALENDARS.find(([key]) => key === params.dcal)?.[0]
        ?? "julian") as InputCalendar;
    const ymd = { year, month, day };
    const jdn = calendar === "gregorian" ? ch.gregorianToJdn(ymd)
        : calendar === "revised" ? ch.revisedJulianToJdn(ymd)
        : ch.julianToJdn(ymd);
    // Обратный ход ловит несуществующее число — 31 июня, 29 февраля
    // невисокосного: нормализованная дата выйдет не той, что просили.
    const back = calendar === "gregorian" ? ch.jdnToGregorian(jdn)
        : calendar === "revised" ? ch.jdnToRevisedJulian(jdn)
        : ch.jdnToJulian(jdn);
    return back.year === year && back.month === month && back.day === day ? jdn : null;
};

const todayJdn = () => {
    const now = new Date();
    return ch.gregorianToJdn({
        year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
    });
};

const Chronology = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    setMeta();

    const record = readRecord(searchParams);
    const from = numeric(searchParams.from, 1, 9999) ?? DEFAULT_FROM;
    const to = numeric(searchParams.to, 1, 9999) ?? DEFAULT_TO;
    const [first, last] = from <= to ? [from, to] : [to, from];

    const has = asked(record);
    const result = has ? solve(record, first, last) : null;
    const day = readDay(searchParams);
    const filled = Boolean(searchParams.dday && searchParams.dmonth && searchParams.dyear);

    // Вкладка по умолчанию — перевод даты: за ним приходят чаще, а разбор
    // записи нужен тому, кто уже знает, зачем пришёл. Но если в адресе стоят
    // условия записи, открывается разбор: ссылка на разбор обязана вести на
    // разбор, а не на пустую соседнюю вкладку.
    const tab: Tab = searchParams.tab === "solver" ? "solver"
        : searchParams.tab === "calendars" ? "calendars"
        : has ? "solver" : "calendars";
    const fixes = result && !result.survivors.length ? diagnose(record, first, last) : [];

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            {/* Объяснение убрано под значок. Оно нужно тому, кто пришёл сюда
                впервые, и мешает тому, кто пришёл разбирать запись, — а второй
                возвращается чаще. <details> вместо своего кода: раскрывается без
                JavaScript и сам отвечает скринридеру. */}
            <details className="flex flex-col gap-2">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex flex-row items-center gap-2">
                    <h1 className="font-serif font-bold text-lg">Хронологический решатель</h1>
                    <InformationCircleIcon
                        className="w-4 h-4 text-slate-400 hover:text-slate-600 shrink-0"
                        title="Что это и как читать ответ"
                    />
                </summary>
                <div className="flex flex-col gap-2 pt-2">
                <p className="font-serif">
                    Средневековая запись датирует себя не числом, а набором чисел:
                    «в лето 6712, индикта 7, месяца марта в 5 день, в неделю». Каждое
                    по себе широко — индикт повторяется каждые пятнадцать лет, день
                    недели каждые семь, — а вместе они сходятся в точку. Здесь эта
                    точка ищется перебором: год за годом, с проверкой каждого условия
                    порознь.
                </p>
                <p className="font-serif">
                    Перебор закончен, а не приблизителен. Круги замыкаются: индикт
                    через 15 лет, круг Солнцу через 28, круг Луне через 19, а вместе —
                    через 7980, дольше всей письменной истории. Значит запись,
                    назвавшая все три, указывает на один-единственный год, и это
                    свойство чисел, а не догадка. Писец, ставивший рядом индикт и
                    круг, ставил не украшение, а контрольную сумму.
                </p>
                {/* Оговорка вверху, а не петитом внизу: без неё «ничего не нашлось»
                    прочтут как отказ инструмента, а это ответ о записи. */}
                <p className="font-serif text-slate-600">
                    Ответов бывает три, и путать их нельзя. <b>Один год</b> — датировка
                    сошлась. <b>Несколько</b> — запись недоопределена: названного мало,
                    и это ответ о записи, а не отказ решателя. <b>Ни одного</b> — запись
                    противоречит сама себе, и тогда показывается, какое чтение её чинит.
                </p>
                <p className="font-serif text-slate-600">
                    Стиль эры не спрашивается, а выводится: лето от Сотворения мира
                    ложится на разные годы от Рождества смотря по тому, мартовский счёт,
                    сентябрьский или ультрамартовский, — а стиль источника обыкновенно
                    как раз и есть то, что требуется доказать. Поэтому перебор идёт по
                    всем трём разом, и какой подошёл — часть ответа.
                </p>
                </div>
            </details>

            <Tabs active={tab} params={searchParams} />

            {tab === "calendars" ? (
                <section className="flex flex-col gap-3">
                    <p className="font-serif text-sm text-slate-600">
                        Набрать можно юлианским, григорианским или новоюлианским счётом —
                        у них общие двенадцать месяцев. Коптский только показывается:
                        месяцев у него тринадцать со своими именами.
                    </p>
                    <DateForm values={searchParams} />
                    {/* Недобор и неверный набор — разные беды, и подпись у них разная:
                        «наберите остальное» на 31 июня звучало бы издевательством. */}
                    {!day && (filled
                        ? (
                            <p className="font-serif text-red-700">
                                Такого числа в этом месяце нет. Ниже — нынешний день.
                            </p>
                        ) : (
                            <p className="font-serif text-sm text-slate-500">
                                Пока набрано не всё — ниже нынешний день.
                            </p>
                        ))}
                    <Calendars jdn={day ?? todayJdn()} />
                    <YearNumbers jdn={day ?? todayJdn()} />
                </section>
            ) : (
                <section className="flex flex-col gap-4">
                    <Form values={searchParams} />
                    {result && <Result result={result} fixes={fixes} />}
                </section>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
                <h2 className="font-serif font-bold text-sm">Чем это проверено</h2>
                <p className="font-serif text-sm text-slate-600">
                    Счёт сверен с Приложением Типикона (гл. 63) — печатной таблицей
                    великого индиктиона на 532 года: круги Солнцу и Луне, вруцелето,
                    основание и эпакта сходятся на всех строках, целых по внутренним
                    признакам самой книги, а ключ границ отвечает нашей Пасхе.
                    Индикт считается общепринятым счётом (остаток лета от Адама на 15);
                    колонка «индикт» в разобранном Приложении расходится с ним на
                    постоянную величину, и вопрос этот пока открыт — до его решения
                    датировку по индикту стоит читать с оговоркой.
                </p>
                {/* Оговорить объём сверки обязательно: печатная таблица закрывает
                    юлианский счёт и пасхалию, а до новоюлианского и коптского не
                    достаёт вовсе — книга их не знает. Умолчать значило бы накрыть
                    их чужим ручательством. */}
                <p className="font-serif text-sm text-slate-600">
                    Новоюлианский и коптский счета этой книгой не покрыты — она их не
                    знает. Они проверены собственными свойствами: у новоюлианского
                    границы совпадения с григорианским выведены счётом и вышли теми
                    самыми, 1 марта 1600 — 28 февраля 2800; у коптского начало года
                    встаёт на 29 или 30 августа юлианского счёта, а длина — 365 дней и
                    366 в високосном. Александрийская эра проверена через
                    независимую величину: её отставание от константинопольской вышло
                    ровно шестнадцатью годами на всём промежутке.
                </p>
                <p className="font-serif text-sm text-slate-600">
                    <b>Короникон — не наш великий индиктион</b>, хотя круг у обоих
                    в 532 года и устроен одинаково. Византийский миротворный круг пошёл
                    с 1941 года, где круг Солнцу и круг Луне оба первые, а грузинские
                    идут с 781, 1313, 1845 — на девяносто шесть лет в сторону. И сам по
                    себе короникон не датирует: тот же номер приходится на каждый круг,
                    какой имеется в виду — решает историк. Начало года у него здесь
                    январское; грузинские источники указывают на осеннее, и если оно
                    подтвердится, у дат сентября–декабря номер сдвинется на единицу.
                    Проверяется это не арифметикой, а датированными надписями.
                </p>
                <p className="font-serif text-sm text-slate-600">
                    <b>Армянская эпоха держится на предании, а не на проверке.</b> Взята
                    общепринятая: 1 навасарда 1 года есть 11 июля 552-го. Внутренние
                    свойства сходятся все — год ровно 365 дней, круг замыкается за 1461
                    год, день в день равный 1460 юлианским, — но проверяют они строй, а
                    не привязку: сдвинь эпоху на год, и всё сойдётся по-прежнему. У
                    прочих календарей зацепкой служит начало года, стоящее на постоянном
                    числе; здесь оно блуждает, и нужен датированный колофон. Взят
                    древний счёт, которым датированы рукописи; позднейший исправленный,
                    с високосом, — отдельный календарь, а не поправка к этому.
                </p>
                <p className="font-serif text-sm text-slate-600">
                    <b>Эфиопский Новый год — не 11 сентября</b>, хотя так пишут везде:
                    это верно только для нашего века. Начало года прибито к юлианскому
                    счёту (29 или 30 августа — тот же день, что коптское 1 тота), а
                    разница стилей растёт на сутки за столетие: в XVII веке это было
                    9 сентября, после 2100 станет 12-е.
                </p>
                <p className="font-serif text-sm text-slate-600">
                    <b>Селевкидская эра</b> взята сирийским счётом, с началом года
                    1 октября: в нём стоят рукописи. Македонский, весенний, с началом в
                    нисане, не считаем и апрелем не приближаем — нисан месяц лунный, и
                    подмена его гражданским числом дала бы точность, которой нет.
                </p>
            </div>
        </div>
    );
};

export default Chronology;

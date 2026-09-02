import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";

// Условия использования корпуса. Дублирует LICENSE-CORPUS.md из репозитория:
// в репозитории — для тех, кто берёт данные, здесь — для тех, кто пришёл на сайт.
export const revalidate = 86400;

export const metadata: Metadata = {
    title: "Лицензия и условия использования",
    description:
        "Корпус «Уставные чтения» доступен по лицензии CC BY 4.0, оригиналы — в общественном достоянии, код — под MIT.",
};

const License = () => (
    <div className={`${myFont.variable} flex flex-col gap-4 pt-4 pb-8 font-serif`}>
        <h1 className="text-xl font-bold">Лицензия и условия использования</h1>

        <p>
            Корпусом можно пользоваться свободно — включая коммерческое использование —
            при указании источника. Ниже подробности: слоёв три, и условия у них разные.
        </p>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Оригиналы — общественное достояние</h2>
            <p>
                Пролог, Торжественник, Златоустник, Маргарит, Паренесис, Лествица, Лавсаик,
                Добротолюбие, толкования — напечатаны задолго до появления авторского права.
                Права на них нет ни у кого, включая этот проект (
                <a
                    href="https://creativecommons.org/publicdomain/mark/1.0/deed.ru"
                    className="text-amber-800 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                >
                    Public Domain Mark 1.0
                </a>
                ).
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Корпус — CC BY 4.0</h2>
            <p>
                На работу проекта — наборный текст, ударения, разбиение на главы и абзацы,
                привязку чтений к дням года, разметку зачал, сносок и упоминаний святых,
                метаданные — распространяется лицензия{" "}
                <a
                    href="https://creativecommons.org/licenses/by/4.0/deed.ru"
                    className="text-amber-800 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                >
                    Creative Commons Attribution 4.0
                </a>
                .
            </p>
            <p>Как ссылаться:</p>
            <p className="border-l-2 border-slate-300 pl-3 text-slate-700">
                Корпус «Уставные чтения» (typikon.su), CC BY 4.0
            </p>
            <p>
                Если вы изменили материал — отметьте это, чтобы изменения не приписывались
                проекту.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Код — MIT</h2>
            <p>
                Исходный код сайта и скриптов обработки — под лицензией MIT.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Каталог храмов — ODbL, а не CC BY</h2>
            <p>
                Каталог храмов и престолов выведен из чужих открытых баз: 53 091 запись из{" "}
                <a
                    href="https://www.openstreetmap.org/copyright"
                    className="text-amber-800 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                >
                    OpenStreetMap
                </a>{" "}
                и 11 763 из Wikidata. OSM распространяется под{" "}
                <a
                    href="https://opendatacommons.org/licenses/odbl/1-0/"
                    className="text-amber-800 underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                >
                    ODbL 1.0
                </a>
                : она требует указания источника и держит производные базы на тех же
                условиях. Выложить каталог под CC BY 4.0 значило бы пересдать чужую базу на
                своих условиях, поэтому он идёт отдельно и под ODbL. Наша работа здесь —
                разбор посвящений, привязка к уставу и сведение со святыми — отдаётся вместе
                с каталогом и на его условиях.
            </p>
            <p className="border-l-2 border-slate-300 pl-3 text-slate-700">
                © участники OpenStreetMap (ODbL); данные Wikidata (CC0); разметка престолов —
                проект «Уставные чтения» (typikon.su)
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Библия: у каждого издания свои условия</h2>
            <p>
                Изданий пять, и происхождение у них разное. Наша работа во всех пяти одна:
                разбор на книги, привязка к канону и согласование нумераций — таблица
                соответствия «как напечатано» и «куда легло». Она покрывается условиями
                корпуса. А набранный текст стиха наш только там, где набирали мы: румынская
                кириллица 1688 года и китайский Новый Завет 1910 года.
            </p>
            <p>
                Церковнославянская, латинская и греческая взяты готовыми оцифровками со
                стороны. Сами издания в общественном достоянии по возрасту, но оцифровка —
                чужая работа на своих условиях (у греческого Ветхого Завета это GPL-3.0), и
                наша лицензия на неё не распространяется. Поэтому в{" "}
                <Link href="/data" className="text-amber-800 underline underline-offset-4">
                    выгрузке
                </Link>{" "}
                текст стиха отдаётся по двум изданиям, а согласование нумераций — по всем пяти.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Что не покрывается</h2>
            <p>
                Сканы оригиналов в РГБ, НЭБ и других хранилищах, русские переводы на
                сторонних сайтах, сведения о святых с dneslov.org, шрифты — принадлежат
                своим правообладателям. Проект на них только ссылается либо получает по их
                API при показе страницы.
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">О точности</h2>
            <p>
                Корпус набирается вручную и вычитывается постепенно: часть текстов сверена,
                часть отекстована и ждёт проверки, часть существует только сканом. Для
                научной работы сверяйтесь с оригиналом — ссылка на скан есть у большинства
                текстов.
            </p>
        </section>

        <p className="flex flex-row gap-4">
            <Link href="/data" className="text-amber-800 underline underline-offset-4">
                Выгрузка корпуса
            </Link>
            <Link href="/about" className="text-amber-800 underline underline-offset-4">
                О проекте
            </Link>
        </p>
    </div>
);

export default License;

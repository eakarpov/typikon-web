import { Cyr, Lat, Table } from "./ui";

// Справочник по азбуке: алфавит, три устройства, разбор ятя. Всё это не
// меняется от посетителя к посетителю, поэтому рисуется на сервере, без
// клиентского кода и без ожидания словника.

const ALPHABET: [string, string][] = [
    ["а", "a"], ["б", "b"], ["в", "w"], ["г", "g"], ["г̌", "h"], ["д", "d"],
    ["ѕ", "dz"], ["ѕь, ѕи", "dź"], ["џ", "dż"], ["е", "e"], ["є", "ie"], ["ж", "ż"],
    ["з", "z"], ["и", "i"], ["й", "j"], ["к", "k"], ["л", "ł"], ["ль, ля, лє", "l"],
    ["м", "m"], ["н", "n"], ["о", "o"], ["ѡ", "ó"], ["п", "p"], ["р", "r"],
    ["р̌", "rz"], ["с", "s"], ["т", "t"], ["у", "u"], ["ф", "f"], ["х", "ch"],
    ["ц", "c"], ["ч", "cz"], ["ш", "sz"], ["щ", "szcz"], ["ы", "y"], ["ь", "мягкость"],
    ["ѣ", "ять"], ["ѧ", "ę"], ["ѩ", "ię"], ["ѫ", "ą"], ["ѭ", "ią, ją"],
    ["ю", "iu, ju"], ["я", "ia, ja"],
];

const Reference = () => (
    <div className="flex flex-col gap-6 max-w-3xl">
        <section className="flex flex-col gap-2">
            <h2 className="font-serif font-bold">Алфавит</h2>
            <p className="font-serif text-sm text-slate-600">
                41 буква. Составных две — <Cyr>р̌</Cyr> (rz) и <Cyr>г̌</Cyr> (h),
                обе с гачеком: «видоизменённая согласная». Диграфы при этом исчезают:
                szcz — это <Cyr>щ</Cyr>, и Szczebrzeszynie записывается как{" "}
                <Cyr>Щебр̌ешынѣ</Cyr>.
            </p>
            <ul className="font-serif text-sm grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                {ALPHABET.map(([cyr, lat]) => (
                    <li key={cyr} className="border-b border-slate-100 py-0.5">
                        <Cyr>{cyr}</Cyr> <span className="text-slate-400">—</span>{" "}
                        <Lat>{lat}</Lat>
                    </li>
                ))}
            </ul>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="font-serif font-bold">Три устройства</h2>
            <Table
                head={["устройство", "что значит", "примеры"]}
                rows={[
                    [<Cyr key="a">ь + гласная</Cyr>, "мягкость там, где иотированной буквы нет",
                        <span key="b"><Cyr>сьостра, цьотка, мьѡд, ньѡсл</Cyr>{" "}
                            <Lat>siostra, ciotka, miód, niósł</Lat></span>],
                    [<Cyr key="c">и + гласная</Cyr>, "глайд в заимствованиях",
                        <span key="d"><Cyr>радио, клиент, декларация</Cyr>{" "}
                            <Lat>radio, klient, deklaracja</Lat></span>],
                    [<Cyr key="e">й + гласная</Cyr>, "[j] в начале слова и после гласной",
                        <span key="f"><Cyr>йод, знайомы, крайѡв</Cyr>{" "}
                            <Lat>jod, znajomy, krajów</Lat></span>],
                ]}
            />
            <p className="font-serif text-sm text-slate-600">
                Мягкость в стечении согласных помечается один раз, на последней:{" "}
                <Cyr>снѣг</Cyr> (śnieg), <Cyr>сць</Cyr> (ść), <Cyr>сци</Cyr> (ści),{" "}
                <Cyr>свѩци</Cyr> (święci).
            </p>
        </section>

        <section className="flex flex-col gap-2">
            <h2 className="font-serif font-bold">Ять</h2>
            <p className="font-serif text-sm text-slate-600">
                Долгота и носовые пишутся буквой и читаются однозначно:{" "}
                <Cyr>ѡ</Cyr> — старопольское долгое <i>ō</i> (<Cyr>Бѡг / Бога</Cyr>),{" "}
                <Cyr>ѫ</Cyr> и <Cyr>ѧ</Cyr> — долгий и краткий носовой
                (<Cyr>дѫб / дѧбы</Cyr>). Ять — единственное место, где запись требует
                знания слова, и цена его измерена.
            </p>
            <Table
                head={["что делает", "пример", "цена и выигрыш"]}
                rows={[
                    ["склеивает корень, который польский рвёт",
                        <span key="a"><Cyr>мѣць / мѣл, повѣѕѣць / повѣѕѣл, свѣт / свѣцє</Cyr>{" "}
                            <Lat>mieć/miał, powiedzieć/powiedział, świat/świecie</Lat></span>,
                        "971 парадигма, 0,687% текста"],
                    ["читается по позиции: перед т д с з н р л даёт ia, иначе ie",
                        <span key="b"><Cyr>вѣра / вѣр̌е, лѣс / лѣсє, хлѣб</Cyr>{" "}
                            <Lat>wiara/wierze, las/lesie, chleb</Lat></span>,
                        "механично"],
                    ["но правило не берёт слов, где зубная была мягкой до падения ера",
                        <span key="c"><Cyr>свѣтны, повѣтр̌е, вѣрны, лѣтни, квѣтня</Cyr>{" "}
                            <Lat>świetny, powietrze, wierny, letni, kwietnia</Lat></span>,
                        "0,144% текста — читающий опирается на знание слова"],
                    ["сливает пары, где выжили оба рефлекса",
                        <span key="d"><Cyr>ѕѣло</Cyr> <Lat>działo и dzieło</Lat>,{" "}
                            <Cyr>бѣда</Cyr> <Lat>biada и bieda</Lat></span>,
                        "0,029% текста, всего две пары"],
                ]}
            />
        </section>
    </div>
);

export default Reference;

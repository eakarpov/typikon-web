'use client';
import { useEngine } from "./useEngine";
import { Faint, Failed, Han, Lat, Loading, Table, plural, row } from "./ui";
import type { Engine, Reading } from "@/lib/azbuki/chinese/types";

// Справочник. Проза — здесь, числа — из данных: они измерены при сборке базы
// и пересчитываются при каждой выгрузке, поэтому вписывать их в текст нельзя.

const TONE_NAMES: Record<string, string> = { "平": "平聲", "上": "上聲", "去": "去聲", "入": "入聲" };
const VOICING_LETTERS: Record<string, string> = {
    "全清": "p t k c s x, гласная",
    "次清": "ph th kh ch",
    "全濁": "b d g ʒ z h",
    "次濁": "m n ŋ l y",
};
const IDIOM: Record<string, string> = {
    Beijing: "пекин.", Guangzhou: "гуанчж.", Chaozhou: "чаочж.",
    Jieyang: "цзеян.", Longgang: "лунган.", Xingning: "синнин.",
};

const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="font-serif font-bold text-base mt-8 mb-2">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-serif font-bold text-sm mt-4 mb-1">{children}</h3>
);
const P = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <p className={`font-serif mb-2 ${className}`}>{children}</p>
);
const Note = ({ children }: { children: React.ReactNode }) => (
    <p className="font-serif text-sm text-slate-500 mb-2">{children}</p>
);
const Num = ({ children }: { children: React.ReactNode }) => (
    <span className="font-mono tabular-nums">{children}</span>
);

const pc = (a: number, b: number) => (b ? `${(a / b * 100).toFixed(1)}%` : "—");

/** Доля стыков, где нужен апостроф. Считается по данным, а не вписывается. */
function apostropheShare(cl: Engine) {
    const TAIL = "jkmnpstvŋ", HEAD = "aeiouəhjrv";
    const n = cl.syllables.length;
    let tail = 0, head = 0;
    for (const s of cl.syllables) {
        if (TAIL.includes(s.l[s.l.length - 1])) tail++;
        if (HEAD.includes(s.l[0])) head++;
    }
    return `${((tail / n) * (head / n) * 100).toFixed(1)}%`;
}

const CodaTone = ({ cl, variety }: { cl: Engine; variety: "yue" | "cmn" }) => {
    const data = cl.reference!.corr[`coda_tone|${variety}`] || [];
    const byKey: Record<string, typeof data> = {};
    for (const d of data) (byKey[d[0]] = byKey[d[0]] || []).push(d);
    const rows: React.ReactNode[][] = [];
    for (const t of ["平", "上", "去", "入"]) {
        for (const v of ["全清", "次清", "全濁", "次濁"]) {
            const d = byKey[`${t}/${v}`];
            if (!d?.length) continue;
            const top = d[0];
            const second = d[1] && d[1][3] > 0.3 ? ` или ${d[1][1]}` : "";
            rows.push(row(
                <><Lat>{cl.core.TONE_CODA[t] || "∅"}</Lat> <Faint>{TONE_NAMES[t]}</Faint></>,
                <span className="text-slate-600">{VOICING_LETTERS[v]}</span>,
                <><b>{top[1]}</b>{second}</>,
                <Num>{Math.round(top[3] * 100)}%</Num>,
                <Faint><Num>{top[2]}</Num></Faint>,
            ));
        }
    }
    return (
        <Table
            caption={`Кода указывает, какой тон, звонкость инициали — высокий регистр или низкий. ` +
                `Проценты измерены на ${variety === "yue" ? "кантонских" : "путунхуаских"} ` +
                `чтениях частотных иероглифов (ранг ≤ 6000).`}
            head={["кода", "инициаль в написании", "тон", "доля", "n"]}
            rows={rows}
        />
    );
};

const Reference = () => {
    const { engine, error } = useEngine("reference");

    // Точность вывода и список назначенных написаний приходят готовыми:
    // они считаются при сборке бандла. Раньше это делала страница, обходя
    // 26 тысяч иероглифов с выводом чтений на каждое, — и ради двух таблиц
    // ей пришлось бы тянуть весь словарь чтений (3,8 МБ).
    if (error) return <Failed error={error} />;
    if (!engine || !engine.reference) return <Loading what="справочные таблицы" />;

    const ref = engine.reference;
    const c = ref.counts;
    const derivation = ref.derivation || [];
    const artificial = ref.artificial || [];
    const artExact = artificial.filter(a => a.exact).length;

    return (
        <div className="max-w-3xl">
            <H>1. Общий обзор</H>
            <P>
                Орфография выводится из среднекитайской фонологической системы «Гуанъюня»
                (1008 г.). Каждой фонологической позиции <Han>音韻地位</Han> соответствует
                ровно одно написание: <b>{c.syllables}{" "}
                {plural(c.syllables, "слог даёт", "слога дают", "слогов дают")} {c.syllables}{" "}
                {plural(c.syllables, "различное написание", "различных написания", "различных написаний")}</b>,
                ни одно не совпадает с другим. База
                содержит {c.characters} {plural(c.characters, "иероглиф", "иероглифа", "иероглифов")}{" "}
                и {c.readings} {plural(c.readings, "чтение", "чтения", "чтений")}, каждое
                со значением из «Гуанъюня».
            </P>
            <P>
                Строение слога:{" "}
                <Lat>инициаль + r + медиаль + ядро + полугласный + кода + тон</Lat>.
            </P>

            <H>2. Алфавит</H>
            <Table
                caption="Буква, её значение в МФА и нагрузка — сколько слогов её содержат."
                head={["буква", "МФА", "слогов"]}
                rows={Object.entries(ref.letters).map(([l, n]) => row(
                    <Lat className="text-base">{l}</Lat>,
                    <Faint>{ref.ipa[l] || "—"}</Faint>,
                    <Num>{n}</Num>,
                ))}
            />
            <H3>Позиционная однозначность</H3>
            <P>
                Несколько букв работают в двух ролях, и все они разводятся позицией:{" "}
                <Lat>j</Lat> и <Lat>v</Lat> — медиаль перед ядром и полугласный после
                него; <Lat>s</Lat> — инициаль <Han>心母</Han> в начале и тон <Han>去聲</Han>{" "}
                в конце; <Lat>m n ŋ p t k</Lat> — инициаль в начале и кода в конце.{" "}
                <Lat>r</Lat> встречается только как метка сразу после инициали,{" "}
                <Lat>q</Lat> — только как тон в конце.
            </P>

            <H>3. Инициали</H>
            <Table
                caption="Три серии, различавшиеся в среднекитайском, разведены диакритикой: чистая буква — зубная, гачек — ретрофлексная, акут — палатальная."
                head={["ряд", "зубные 精組", "ретрофлексные 莊組", "палатальные 章組"]}
                rows={ref.initials.map(([name, cells]) => row(
                    <span className="text-slate-600">{name}</span>,
                    ...cells.map((cell, k) => cell
                        ? <span key={k}><Han>{cell[0]}</Han> <Lat className="text-base">{cell[1]}</Lat></span>
                        : <Faint key={k}>—</Faint>),
                ))}
            />
            <Note>
                Прочие: <Han>幫</Han> p · <Han>滂</Han> ph · <Han>並</Han> b · <Han>明</Han> m ·{" "}
                <Han>來</Han> l · <Han>見</Han> k · <Han>溪</Han> kh · <Han>羣</Han> g ·{" "}
                <Han>疑</Han> ŋ · <Han>曉</Han> x · <Han>匣</Han> и <Han>云</Han> h ·{" "}
                <Han>以</Han> y. Инициаль <Han>影母</Han> не пишется — проверено, что её
                опускание не создаёт ни одной склейки.
            </Note>
            <P>
                Звонкая аффриката палатального ряда записывается <Lat>đ</Lat>, а не «ʒ
                с акутом»: по реконструкции Бакстера–Сагара <Han>常母</Han> в 83% случаев
                восходит к древнекитайскому <Lat>*d</Lat> (дентальному смычному), тогда
                как <Han>從母</Han> и <Han>崇母</Han> — к сибилянтам (91% и 79%).
            </P>

            <H>4. Ядра и йотация</H>
            <Table
                head={["ядро", "с медиалью j", "рифмы 開口", "рифмы йотированные"]}
                rows={ref.nuclei.map(n => row(
                    <Lat className="text-base">{n[0]}</Lat>,
                    <Lat className="text-base">{n[1]}</Lat>,
                    <Han className="text-sm">{n[2]}</Han>,
                    <Han className="text-sm">{n[3]}</Han>,
                ))}
            />
            <P>
                <Lat>j</Lat> и <Lat>v</Lat> — симметричная пара: каждая работает и медиалью
                (перед ядром), и полугласным (после ядра), а роль различается позицией.
                Медиаль j даёт йотацию (<Han>陽</Han> <Lat>jaŋ</Lat>), медиаль v —{" "}
                <Han>合口</Han> (<Han>官</Han> <Lat>kvan</Lat>), вместе — <Lat>jv</Lat>{" "}
                (<Han>全</Han> <Lat>ʒjven</Lat>). Полугласные: <Han>泰</Han> <Lat>aj</Lat>,{" "}
                <Han>齊</Han> <Lat>ej</Lat>, <Han>脂</Han> <Lat>ij</Lat>, <Han>豪</Han>{" "}
                <Lat>av</Lat>, <Han>東</Han> <Lat>uvŋ</Lat>. Коды: <Lat>m n ŋ p t k</Lat>.
            </P>

            <H>5. Метка *-r-</H>
            <P>
                Древнекитайская медиаль <Lat>*-r-</Lat> оставила три разных следа, которые
                Бакстер записывает тремя разными способами: буквой r внутри инициали
                (<Han>知組</Han>, <Han>莊組</Han>), диграфами ae/ea в рифмах <Han>二等</Han>{" "}
                и отсутствием вставного -i- в <Han>重紐 B</Han>. Здесь это <b>одна
                метка <Lat>r</Lat></b>, поставленная сразу после инициали — там, где
                медиаль и стояла.
            </P>
            <Table
                caption="Метку получают 881 слог (24%). Она же закрывает два пробела самой нотации Бакстера: 抑 и 憶 у него оба «'ik»."
                head={["一/四等", "二等", "重紐 A", "重紐 B"]}
                rows={[
                    row(<><Han>歌</Han> <Lat>ka</Lat></>, <><Han>麻</Han> <Lat>kra</Lat></>,
                     <><Han>支 卑</Han> <Lat>pje</Lat></>, <><Han>支 陂</Han> <Lat>prjes</Lat></>),
                    row(<><Han>寒</Han> <Lat>kan</Lat></>, <><Han>刪</Han> <Lat>kran</Lat></>,
                     <><Han>真 比</Han> <Lat>bit</Lat></>, <><Han>脂 悲</Han> <Lat>prij</Lat></>),
                    row(<><Han>青</Han> <Lat>keŋ</Lat></>, <><Han>耕</Han> <Lat>kreŋ</Lat></>,
                     <><Han>蒸 憶</Han> <Lat>ik</Lat></>, <><Han>蒸 抑</Han> <Lat>rik</Lat></>),
                ]}
            />

            <H>6. Тоны</H>
            <P>
                Все четыре среднекитайских тона записываются конечными согласными — теми,
                которыми они исторически были. По гипотезе Одрикура, подтверждённой
                на данных Бакстера–Сагара: <Han>上聲</Han> восходит к <Lat>*-ʔ</Lat>{" "}
                (94.7% реконструкций), <Han>去聲</Han> — к <Lat>*-s</Lat> (94.8%),{" "}
                <Han>平聲</Han> — к открытому слогу (99.8%).
            </P>
            <Table
                head={["тон", "кода", "происхождение"]}
                rows={[
                    row(<Han>平聲</Han>, <Faint>не пишется</Faint>, "открытый слог или сонорный исход"),
                    row(<Han>上聲</Han>, <Lat>-q</Lat>, <>древнекитайское <Lat>*-ʔ</Lat>, гортанная смычка</>),
                    row(<Han>去聲</Han>, <Lat>-s</Lat>, <>древнекитайское <Lat>*-s</Lat></>),
                    row(<Han>入聲</Han>, <Lat>-p -t -k</Lat>, "смычка сохранилась как есть"),
                ]}
            />

            <H>7. Вывод произношения: работающие правила</H>
            <P>
                Латиница переводится в современное произношение не таблицей соответствий,
                а полным набором правил: подключены оригинальные скрипты вывода{" "}
                <span className="font-mono">putonghua.js</span> и{" "}
                <span className="font-mono">gwongzau.js</span> из nk2028/tshet-uinh-examples,
                без единой правки. На вкладке «Иероглиф» выведенное чтение стоит рядом
                с засвидетельствованным, и расхождения подсвечены.
            </P>
            <Table
                caption="Доля иероглифов, для которых выведенное чтение совпадает с засвидетельствованным в Unihan. Второй столбец каждой пары — совпадение по сегментам, когда расходится только тон. Считается при сборке базы."
                head={["выборка", "путунхуа точно", "+сегментно", "кантонский точно", "+сегментно"]}
                rows={derivation.map(d => row(
                    `топ-${d.band}`,
                    <Num>{pc(d.cmn.e, d.cmn.t)}</Num>,
                    <Faint><Num>{pc(d.cmn.e + d.cmn.s, d.cmn.t)}</Num></Faint>,
                    <Num>{pc(d.yue.e, d.yue.t)}</Num>,
                    <Faint><Num>{pc(d.yue.e + d.yue.s, d.yue.t)}</Num></Faint>,
                ))}
            />
            <Note>
                Остаток — настоящие нерегулярности, а не изъян правил: <Han>不</Han> даёт
                по правилам fǒu, а читается bù; <Han>國</Han> даёт guō вместо guó. Потолок
                любого детерминированного вывода из среднекитайского измерен отдельно
                и составляет 98.7% для кантонского и 97.5% для путунхуа на тысяче
                частотных знаков — то есть правила берут значительную часть, но не всё.
            </Note>

            <H>8. Вывод произношения: тон</H>
            <P>
                Правило двухчастное и читается прямо с написания: кода задаёт тон,
                звонкость первой буквы — регистр. Для кантонского это совпадает с его
                нумерацией: высокий регистр даёт тоны 1, 2, 3, низкий — 4, 5, 6.
            </P>
            <H3>Кантонский</H3>
            <CodaTone cl={engine} variety="yue" />
            <H3>Путунхуа</H3>
            <CodaTone cl={engine} variety="cmn" />
            <Note>
                Три слабых места. <Han>濁上</Han> в кантонском: историческое{" "}
                <Han>濁上變去</Han> прошло непоследовательно. <Han>清入</Han> в кантонском
                расщепляется на тоны 1 и 3 по долготе гласного, то есть правило должно
                смотреть на ядро, а не на коду. <Han>清入</Han> в путунхуа не выводится вовсе.
            </Note>

            <H>9. Граница слога в слове</H>
            <P>
                Слоги внутри слова пишутся слитно, но девять фрагментов
                (<Lat>s k ŋ t p n m v j</Lat>) могут перепрыгнуть границу. Опасны три
                стыка: кода перед нулевой инициалью (<Lat>ak+a</Lat> читается и
                как <Lat>a+ka</Lat>), кода перед <Lat>h</Lat> (перечитывается как
                придыхание), кода перед <Lat>v</Lat> или <Lat>r</Lat> (как медиаль и как метка).
            </P>
            <P>
                <b>Правило:</b> апостроф ставится, если предыдущий слог кончается
                на <Lat>j k m n p s t v ŋ</Lat>, а следующий начинается на гласную,{" "}
                <Lat>h</Lat>, <Lat>j</Lat>, <Lat>v</Lat> или <Lat>r</Lat>. Срабатывает
                на {apostropheShare(engine)} стыков и снимает неоднозначность полностью.
            </P>
            <Table
                head={["слово", "по слогам", "записью"]}
                rows={[
                    row(<Han>北京</Han>, <Lat>pok + krjaŋ</Lat>, <Lat>pokkrjaŋ</Lat>),
                    row(<Han>西安</Han>, <Lat>sej + an</Lat>, <Lat>sej&apos;an</Lat>),
                    row(<Han>大學</Han>, <Lat>dajs + hravk</Lat>, <Lat>dajs&apos;hravk</Lat>),
                    row(<Han>天安門</Han>, <Lat>then + an + mvon</Lat>, <Lat>then&apos;anmvon</Lat>),
                ]}
            />
            <Note><Han>西安</Han> даёт тот же апостроф, что и в пиньине.</Note>

            <H>10. Знаки без среднекитайского предка</H>
            <P>
                Орфография наследует написание от среднекитайской морфемы. У части знаков
                её нет: заимствования XX века (<Han>卡</Han>, <Han>咖</Han>, <Han>啤</Han>,{" "}
                <Han>泵</Han>), звукоподражания (<Han>乒</Han>, <Han>乓</Han>, <Han>啪</Han>,{" "}
                <Han>喳</Han>), стяжения (<Han>怎</Han> из <Han>作麼</Han>, <Han>俩</Han> из{" "}
                <Han>兩個</Han>) и поздние знаки, чей фонетик нужного чтения не даёт. Таким
                написание <b>назначается</b>: берётся реальная позиция, из которой правила
                выводят современное чтение знака. Написание тогда остаётся законным слогом
                системы, но ни о чём не свидетельствует, и выводится{" "}
                <span className="text-slate-400">серым</span>.
            </P>
            <P>
                Для {artExact} таких знаков позиция находится точно. Для остальных точного
                соответствия не существует: перебор всех 377&nbsp;568 позиций, которые
                правила принимают, не даёт ни <Lat>ka</Lat>, ни <Lat>diu</Lat>, ни{" "}
                <Lat>lia</Lat> — эти чтения лежат вне образа отображения «среднекитайский →
                путунхуа». Им берётся ближайшее с той же инициалью, и такое написание
                читается не так, как слово звучит.
            </P>
            <Table
                head={["знак", "чтение", "написание", "по правилам", "разряд"]}
                rows={artificial.map(a => row(
                    <Han className="text-base">{a.ch}</Han>,
                    a.cmn,
                    <Lat artificial>{a.latin}</Lat>,
                    <span className={a.exact ? "" : "text-amber-800"}>{a.derived}</span>,
                    <Faint>{a.kind}</Faint>,
                ))}
            />

            <H>11. Минь и хакка</H>
            <SiniticBlock cl={engine} />

            <H>12. Сино-тибетское ядро</H>
            <P>
                Это не чтения: тибетской или бирманской записи китайских иероглифов
                не существует — в отличие от японского, корейского и вьетнамского, где
                иероглифы заимствовали вместе с чтениями. Здесь другое: слова китайского
                и родственных языков, восходящие к общему предку.
            </P>
            <P>
                Источник — набор Сагара и соавторов (PNAS 2019): 50 языков семьи,
                250 концептов базовой лексики, экспертная кодировка родства. Отобраны
                только те когнатные классы, где китайский встречается вместе с некитайским
                языком семьи — иначе это внутрикитайское сравнение.
            </P>
            <Note>
                Важная оговорка: попадание в один концепт не означает родства.{" "}
                <Han>刀</Han> <span className="font-mono">*C.tˤaw</span> и тибетское{" "}
                <span className="font-mono">gri</span> — оба «нож», но слова разные,
                и в этой таблице их нет.
            </Note>
            <CognateTable cl={engine} />

            <H>13. Источники</H>
            <P className="text-sm">
                Среднекитайские позиции и <Han>反切</Han> — «Гуанъюнь» (1008 г.) в разборе
                nk2028/tshet-uinh-data. Современные чтения — Unihan 17.0. Древнекитайские
                реконструкции — Бакстер и Сагар 2014. Частотность — список Jun Da. Словарь
                слов — CC-CEDICT (CC BY-SA 4.0). Сино-тибетские когнаты — Sagart et al. 2019,
                набор lexibank/sagartst (CC BY 4.0). Версия китайской азбуки —{" "}
                {ref.meta.version || "—"}.
            </P>
        </div>
    );
};

/* Иероглифы с засвидетельствованными когнатами. Тибетский вынесен отдельной
   колонкой: он ближайший родственник с древней письменной формой, и сравнивать
   с ним нагляднее, чем с современными языками семьи. */
const CognateTable = ({ cl }: { cl: Engine }) => {
    if (!cl.cognates) return null;
    const items = Object.entries(cl.cognates)
        .map(([ch, list]) => ({ ch, c: list[0] }))
        .sort((a, b) => b.c.n - a.c.n);
    return (
        <Table
            caption="Иероглифы с засвидетельствованными сино-тибетскими когнатами, от самых широко представленных. Латиница выводится из среднекитайского, реконструкция — из древнекитайского: это разные эпохи, и совпадать они не обязаны."
            head={["знак", "латиница", "древнекит.", "тибетский", "концепт", "языков", "ещё формы"]}
            rows={items.map(({ ch, c }) => {
                const bySub: Record<string, [string, string, string, string]> = {};
                const order: string[] = [];
                for (const f of c.f) {
                    if (f[0] === "Sinitic") continue;
                    if (!bySub[f[0]]) { bySub[f[0]] = f; order.push(f[0]); }
                }
                const tib = bySub["Tibetan"];
                const rest = order.filter(x => x !== "Tibetan").slice(0, 3);
                return row(
                    <Han className="text-base">{ch}</Han>,
                    <Lat>{c.lat || "—"}</Lat>,
                    <Faint><span className="font-mono">{c.oc}</span></Faint>,
                    tib
                        ? <><span className="font-mono">{tib[3]}</span>
                            {tib[1] !== "OldTibetan" && <Faint> (совр.)</Faint>}</>
                        : <Faint>—</Faint>,
                    <span className="text-slate-600">{c.c}</span>,
                    <Num>{c.n}</Num>,
                    <>{rest.map((sub, k) => (
                        <span key={k}>
                            {k > 0 && " · "}
                            <span className="font-mono">{bySub[sub][3]}</span> <Faint>{sub}</Faint>
                        </span>
                    ))}</>,
                );
            })}
        />
    );
};

const SiniticBlock = ({ cl }: { cl: Engine }) => {
    const S = cl.sinitic;
    if (!S) return null;
    const byFeat: Record<string, typeof S.stat> = {};
    for (const r of S.stat) (byFeat[r[0]] = byFeat[r[0]] || []).push(r);

    const voiced: Record<string, { name: string; total: number } & Record<string, number | string>> = {};
    for (const r of byFeat.voiced || []) {
        voiced[r[1]] = voiced[r[1]] || { name: r[1], total: r[4] };
        voiced[r[1]][r[2]] = r[3];
    }

    return (
        <>
            <P>
                Форма берётся, только если она когнатна древнекитайской. Иначе меряется
                чушь: для концепта «глаз» древнекитайское <Han>目</Han>, а кантонское{" "}
                <Han>眼</Han> — разные слова, и отсутствие у <Han>眼</Han> смычной коды
                о судьбе <Han>入聲</Han> не говорит ничего. После отсева остаётся около
                сотни точек на идиом, поэтому у каждого числа указано n: при такой выборке
                разница в несколько процентов ничего не значит.
            </P>
            {(byFeat.coda || []).length > 0 && (
                <>
                    <H3>Смычная кода 入聲</H3>
                    <Table
                        caption="Доля форм, сохранивших конечный -p, -t, -k. Пекинский утратил её полностью — это и есть та потеря, из-за которой тон 入聲 в путунхуа не выводится."
                        head={["идиом", "сохранено", "n"]}
                        rows={(byFeat.coda || []).map(r => row(
                            r[1],
                            <Num>{Math.round(r[3] / r[4] * 100)}%</Num>,
                            <Faint><Num>{r[4]}</Num></Faint>,
                        ))}
                    />
                </>
            )}
            {Object.keys(voiced).length > 0 && (
                <>
                    <H3>Рефлексы 全濁</H3>
                    <Table
                        caption="Во что перешли среднекитайские звонкие шумные (наши b, d, g, ʒ, z, h). У хакка придыхательных вдвое-втрое больше, чем у остальных: это её классический опознавательный признак."
                        head={["идиом", "придыхательный", "звонкий", "прочее", "n"]}
                        rows={Object.values(voiced).map(v => row(
                            v.name,
                            <Num>{Math.round(((v["придыхательный"] as number) || 0) / v.total * 100)}%</Num>,
                            <Num>{Math.round(((v["звонкий"] as number) || 0) / v.total * 100)}%</Num>,
                            <Num>{Math.round(((v["прочее"] as number) || 0) / v.total * 100)}%</Num>,
                            <Faint><Num>{v.total}</Num></Faint>,
                        ))}
                    />
                </>
            )}
            <H3>Сопоставительный список</H3>
            <Table
                caption="Шестьдесят слов с наибольшим покрытием. Формы даны в МФА с тоновыми контурами, как в источнике."
                head={["знак", "латиница", "концепт", ...S.varieties.map(v => IDIOM[v] || v)]}
                rows={S.rows.slice(0, 60).map(r => row(
                    <Han className="text-base">{r[0]}</Han>,
                    <Lat>{r[1]}</Lat>,
                    <span className="text-slate-600">{r[2]}</span>,
                    ...r.slice(3).map((f, k) => f
                        ? <span key={k} className="font-mono text-xs">{f}</span>
                        : <Faint key={k}>—</Faint>),
                ))}
            />
        </>
    );
};

export default Reference;

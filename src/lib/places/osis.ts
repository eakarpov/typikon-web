// Ссылки OSIS («Gen.35.19», «1Kgs.12.28») — в книгу канона сайта (@/utils/bibleCanon).
//
// Здесь только соответствие КНИГ. OpenBible нумерует главы и стихи по английской
// (масоретской) традиции, а эталон сайта — Елизаветинская Библия; где нумерации
// расходятся (Псалтирь, Малахия, Иоиль и другие), перевод стиха сделает этап 2 со
// сверкой по славянскому тексту. Для сопоставления мест со статьями энциклопедии
// хватает и совпадения без поправок: ссылки там в основном на исторические книги,
// где нумерации одни.
//
// Книги Царств: английские 1–2 Samuel и 1–2 Kings — это 1–4 Царств славянской Библии.
// Ezra — «1 Ездры», Nehemiah — «Неемии».
export const OSIS_TO_CANON: Record<string, string> = {
    Gen: "bytie", Exod: "iskhod", Lev: "levit", Num: "chisla", Deut: "vtorozakonie",
    Josh: "iisus-navin", Judg: "sudi", Ruth: "ruf",
    "1Sam": "1-tsarstv", "2Sam": "2-tsarstv", "1Kgs": "3-tsarstv", "2Kgs": "4-tsarstv",
    "1Chr": "1-paralipomenon", "2Chr": "2-paralipomenon", Ezra: "1-ezdry", Neh: "neemii", Esth: "esfir",
    Job: "iova", Ps: "psaltir", Prov: "pritchi", Eccl: "ekklesiast", Song: "pesn-pesney",
    Isa: "isaii", Jer: "ieremii", Lam: "plach-ieremii", Ezek: "iezekiilya", Dan: "daniila",
    Hos: "osii", Joel: "ioilya", Amos: "amosa", Obad: "avdiya", Jonah: "iony", Mic: "mikheya",
    Nah: "nauma", Hab: "avvakuma", Zeph: "sofonii", Hag: "aggeya", Zech: "zakharii", Mal: "malakhii",
    Matt: "matfeya", Mark: "marka", Luke: "luki", John: "ioanna", Acts: "deyaniya",
    Rom: "rimlyanam", "1Cor": "1-korinfyanam", "2Cor": "2-korinfyanam", Gal: "galatam", Eph: "efesyanam",
    Phil: "filippiytsam", Col: "kolossyanam", "1Thess": "1-fessaloniyitsam", "2Thess": "2-fessaloniyitsam",
    "1Tim": "1-timofeyu", "2Tim": "2-timofeyu", Titus: "titu", Phlm: "filimonu", Heb: "evreyam",
    Jas: "iakova", "1Pet": "1-petra", "2Pet": "2-petra", "1John": "1-ioanna-posl", "2John": "2-ioanna-posl",
    "3John": "3-ioanna-posl", Jude: "iudy", Rev: "otkrovenie",
};

/** «Gen.35.19» → «bytie.35.19»; незнакомая книга или битая ссылка — null. */
export const osisToKey = (osis: string): string | null => {
    const m = osis.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
    const canon = m && OSIS_TO_CANON[m[1]];
    return canon ? `${canon}.${m![2]}.${m![3]}` : null;
};

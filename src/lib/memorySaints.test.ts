import { test } from "node:test";
import assert from "node:assert/strict";
import { bare, nominativeAdjective, nominativeName, personOf } from "./memorySaints";

test("имя: мужские окончания", () => {
    assert.equal(nominativeName("Алекса́ндра", false), "Алекса́ндр");
    assert.equal(nominativeName("Се́ргия", false), "Се́ргий");
    assert.equal(nominativeName("Андре́я", false), "Андре́й");
    assert.equal(nominativeName("Никола́я", false), "Никола́й");
    assert.equal(nominativeName("Серафи́ма", false), "Серафи́м");
    assert.equal(nominativeName("Ники́ты", false), "Ники́та");
    assert.equal(nominativeName("Па́вла", false), "Па́вел");
    assert.equal(nominativeName("Лу́ки", false), "Лука́");
});

test("имя: женские окончания", () => {
    assert.equal(nominativeName("Варва́ры", true), "Варва́ра");
    assert.equal(nominativeName("Мари́и", true), "Мари́я");
    assert.equal(nominativeName("О́льги", true), "О́льга");
});

test("прозвание", () => {
    assert.equal(nominativeAdjective("Не́вскаго", false), "Не́вский");
    assert.equal(nominativeAdjective("Вели́каго", false), "Вели́кий");
    assert.equal(nominativeAdjective("Пра́веднаго", false), "Пра́ведный");
    assert.equal(nominativeAdjective("Ки́евския", true), "Ки́евская");
});

test("лицо из подписи: Александр Невский", () => {
    const p = personOf("Свята́го благове́рнаго вели́каго кня́зя Алекса́ндра Не́вскаго, Влади́мирскаго и Новгоро́дскаго чудотво́рца, нарече́ннаго во и́ноцех Алекси́я")!;
    assert.equal(p.name, "Алекса́ндр Не́вский");
    assert.equal(p.key, "александр невский");
    assert.equal(p.several, false);
});

test("лицо из подписи: прозвание из оборота «епископа Воронежскаго»", () => {
    assert.equal(personOf("Святи́теля и чудотво́рца Митрофа́на, пе́рваго епи́скопа Воро́нежскаго")!.name, "Митрофа́н Воро́нежский");
    assert.equal(personOf("Обре́тение моще́й святи́теля Митрофа́на, епи́скопа Воро́нежскаго")!.key, "митрофан воронежский");
    assert.equal(personOf("Преподо́бнаго и Богоно́снаго отца́ на́шего Серафи́ма, Саро́вскаго чудотво́рца")!.name, "Серафи́м Саро́вский");
});

test("без прозвания и несколько лиц — видно по разбору", () => {
    const p = personOf("И́же во святы́х отца́ на́шего Митрофа́на, Патриа́рха Константи́ня гра́да")!;
    assert.equal(p.epithet, null);
    assert.equal(personOf("Святы́х благове́рных кня́зей Бори́са и Гле́ба")!.several, true);
});

test("женское лицо", () => {
    const p = personOf("Свята́го мучени́цы Татиа́ны", "muchenitsa-edina")!;
    assert.equal(p.feminine, true);
    assert.equal(p.given, "Татиа́на");
});

test("сличение без ударений", () => {
    assert.equal(bare("Серги́й Ра́донежский"), "сергий радонежский");
});

test("дательный Минеи дополнительной и звание с опечаткой", () => {
    assert.equal(personOf("новосвященномученику Платону, епископу Ревельскому")!.name, "Платон Ревельский");
    assert.equal(personOf("святителю Николаю Японскому")!.name, "Николай Японский");
    assert.equal(personOf("Священномученника Василия Максимова, пресвитера Кабановскаго")!.given, "Васи́лий".replace("и́", "и"));
});

test("ударное окончание прозвания и «Ина служба»", () => {
    assert.equal(nominativeAdjective("Тверска́го", false), "Тверско́й");
    assert.equal(personOf("И́на слу́жба свята́го Са́ввы Се́рбскаго")!.name, "Са́вва Се́рбский");
});

test("подпись заглавными, «Канон» и женское «-ской»", () => {
    assert.equal(personOf("СВЯТА́ГО СВЯЩЕННОМУ́ЧЕНИКА ГРИГО́РИЯ, ЕПИ́СКОПА ШЛИССЕЛЬБУ́РЖСКАГО")!.name, "Григо́рий Шлиссельбу́ржский");
    assert.equal(personOf("Кано́н умили́тельный преподо́бному и Богоно́сному отцу́ на́шему Се́ргию Ра́донежскому")!.given, "Се́ргий");
    assert.equal(personOf("Преподобныя Параске́вы Се́рбской")!.name, "Параске́ва Се́рбская");
});

test("прозвание брата не переходит к лицу", () => {
    const p = personOf("Свята́го благове́рного кня́зя Фео́дора Яросла́вича, бра́та свята́го благове́рнаго вели́кого кня́зя Алекса́ндра Не́вскаго")!;
    assert.equal(p.given, "Фео́дор");
    assert.equal(p.epithet, null);
});

test("дательный мужских на «-а»", () => {
    assert.equal(personOf("святителю Луке Симферопольскому")!.name, "Лука Симферопольский");
});

test("события памяти не становятся лицами", () => {
    assert.equal(personOf("Пра́зднование святи́телю Никола́ю ра́ди чудотво́рнаго его́ о́браза «Зара́йскаго»"), null);
    assert.equal(personOf("Возвраще́ние ико́ны Ку́рской-Коренны́я"), null);
    assert.equal(personOf("Преподо́бнаго Али́пия, иконопи́сца Пече́рскаго")!.name, "Али́пий Пече́рский");
    assert.equal(personOf("свята́го святи́телю Никола́ю Чудотво́рцу")!.given, "Никола́й");
});

test("составное имя и подпись «В Неделю…»", () => {
    assert.equal(personOf("Свята́го великому́ченика Иоа́нна-Влади́мира, кня́зя Се́рбскаго")!.name, "Иоа́нн-Влади́мир Се́рбский");
    assert.equal(personOf("В Неде́лю о разсла́бленном. Пренесе́ние моще́й свята́го му́ченика Гео́ргия Бо́лгарскаго")!.name, "Гео́ргий Бо́лгарский");
});

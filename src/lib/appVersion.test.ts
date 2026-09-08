import { test } from "node:test";
import assert from "node:assert/strict";
import { latestOf, versionLabel, LAST_KNOWN } from "@/lib/appVersion";

// Версия приложения. Число здесь стоит дороже прочих: по нему установленная копия
// решает, есть ли новая, и ошибка в меньшую сторону не видна никому — все просто
// остаются на старом.

test("версия берётся из имени выпуска, а не из порядка файлов", () => {
    assert.deepEqual(
        latestOf(["app-2.0.0.apk", "app-0.3.0.apk", "app-1.4.0.apk"]),
        { major: 2, minor: 0, patch: 0 },
    );
    assert.deepEqual(
        latestOf(["app-1.4.0.apk", "app-2.0.0.apk"]),
        { major: 2, minor: 0, patch: 0 },
    );
});

test("номер сравнивается тройкой, а не по частям", () => {
    // 1.9 против 2.0: минор девять больше нуля, и сравнение по частям объявило бы
    // старшей 1.9. Та же ошибка была в приложении и уже однажды чинилась.
    assert.deepEqual(latestOf(["app-1.9.0.apk", "app-2.0.0.apk"]),
        { major: 2, minor: 0, patch: 0 });
    assert.deepEqual(latestOf(["app-2.0.1.apk", "app-2.0.0.apk"]),
        { major: 2, minor: 0, patch: 1 });
    assert.deepEqual(latestOf(["app-2.10.0.apk", "app-2.9.0.apk"]),
        { major: 2, minor: 10, patch: 0 });
});

test("app.apk без номера в счёт не идёт", () => {
    // Это копия последнего выпуска, и версии в себе она не несёт. Приняв её за
    // выпуск, мы не смогли бы сказать, какой именно.
    assert.equal(latestOf(["app.apk"]), null);
    assert.deepEqual(latestOf(["app.apk", "app-1.4.0.apk"]),
        { major: 1, minor: 4, patch: 0 });
});

test("посторонний файл не отменяет ответа", () => {
    // Каталог общий; отказать в версии из-за чужого файла значило бы уронить
    // проверку обновлений на пустом месте.
    assert.deepEqual(
        latestOf([".DS_Store", "readme.txt", "app-1.4.0.apk", "app-1.4.apk", "app-x.y.z.apk"]),
        { major: 1, minor: 4, patch: 0 },
    );
});

test("пустой каталог — это «не знаю», а не нулевая версия", () => {
    // Ноль означал бы «новее вашей ничего нет» и был бы враньём; на этот случай
    // отвечает последнее известное число.
    assert.equal(latestOf([]), null);
    assert.equal(versionLabel(LAST_KNOWN), "2.0.0");
});

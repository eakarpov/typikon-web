import {test} from "node:test";
import assert from "node:assert/strict";
import {checkTelegramText, checkTelegramPhoto} from "./checkContent";

const png = () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

test("проверяется файл изображения, а не расширение или заголовок ответа", () => {
    assert.deepEqual(checkTelegramPhoto(png()), {width: 1, height: 1, format: "png", bytes: png().length});
    assert.throws(() => checkTelegramPhoto(Buffer.from("<html>error page</html>")), /распознать изображение/);
});

test("выявляются слишком большой файл, размеры и узкая панорама", () => {
    assert.throws(() => checkTelegramPhoto(new Uint8Array(10 * 1024 * 1024 + 1)), /10 МБ/);
    const huge = png(); huge.writeUInt32BE(9000, 16); huge.writeUInt32BE(2000, 20);
    assert.throws(() => checkTelegramPhoto(huge), /10000/);
    const wide = png(); wide.writeUInt32BE(1000, 16);
    assert.throws(() => checkTelegramPhoto(wide), /20:1/);
});

test("готовится та же сокращённая подпись, что будет отправлена с фото", () => {
    const result = checkTelegramText({text: "слово ".repeat(500), imageUrl: "https://example.org/photo.png", sourceTextId: "63c9638ce99d9f4d9010c598"});
    assert.equal(result.shortened, true);
    assert.ok(result.textLength <= 1024);
});

test("обнаруживаются пустой текст, неверная разметка и переполнение текстового поста", () => {
    for (const text of ["", "<b>Текст", "<b><i>Текст</b></i>", "<h1>Заголовок</h1>", "<a>Ссылка</a>", "<span>Текст</span>", "текст & ещё", "x".repeat(4097)]) {
        assert.throws(() => checkTelegramText({text}));
    }
    assert.deepEqual(checkTelegramText({text: '<b>А&amp;Б</b> <a href="https://example.org">ссылка</a>'}), {textLength: 10, shortened: false});
});

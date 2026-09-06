import fs from "node:fs";
import path from "node:path";
// @ts-ignore — у wawoff2 нет типов.
import { compress } from "wawoff2";

// Перевод шрифтов в woff2 — долг, записанный в ROADMAP ещё аудитом блока 2:
// public/fonts весит больше мегабайта в TTF и OTF, и половина этого веса едет
// до первой отрисовки.
//
// СЖАТИЕ, А НЕ ОБРЕЗКА. woff2 — то же самое содержимое, упакованное иначе:
// таблицы шрифта, разметка и все знаки остаются как были. Сабсеттинг (выброс
// неиспользуемых знаков) дал бы больше, но для церковнославянского он опасен:
// выносные, титла и уставные начертания легко не попасть в набор, а обнаружится
// это на чьём-нибудь тексте, а не у нас. Поэтому только сжатие.
//
// Заодно это снимает вопрос лицензий: перевод в другой формат прямо разрешён
// условиями OFL и не требует переименования, тогда как обрезка — уже
// переделка, и её пришлось бы объявлять.

const FONTS_DIR = path.join(process.cwd(), "public/fonts");

const run = async () => {
    const files = process.argv.slice(2).length
        ? process.argv.slice(2)
        : fs.readdirSync(FONTS_DIR).filter((f) => /\.(ttf|otf)$/i.test(f)).map((f) => path.join(FONTS_DIR, f));

    let before = 0;
    let after = 0;
    for (const file of files) {
        const input = fs.readFileSync(file);
        const target = file.replace(/\.(ttf|otf)$/i, ".woff2");
        const out = Buffer.from(await compress(new Uint8Array(input)));
        fs.writeFileSync(target, new Uint8Array(out));
        before += input.length;
        after += out.length;
        console.log(`${path.basename(file)} ${(input.length / 1024).toFixed(0)} КБ → `
            + `${path.basename(target)} ${(out.length / 1024).toFixed(0)} КБ `
            + `(−${Math.round(100 - (out.length / input.length) * 100)}%)`);
    }
    console.log(`итого: ${(before / 1024).toFixed(0)} КБ → ${(after / 1024).toFixed(0)} КБ, `
        + `сэкономлено ${((before - after) / 1024).toFixed(0)} КБ`);
};

run().catch((e) => {
    console.error("ошибка:", e instanceof Error ? e.message : e);
    process.exit(1);
});

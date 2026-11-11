import {imageSize} from "image-size";
import {photoCaption} from "./photoCaption";
import {visibleLength, CAPTION_LIMIT, MESSAGE_LIMIT} from "./postText";

const TAG = /<(?:[^"'<>]|"[^"]*"|'[^']*')+>/g;
const ALLOWED = new Set(["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "span", "tg-spoiler", "a", "code", "pre", "blockquote", "tg-emoji"]);

/** Проверяем доступную локально часть правил HTML Telegram. */
export const checkTelegramText = (post: {text: string; imageUrl?: string | null; sourceTextId?: string | null}) => {
    const text = post.imageUrl?.trim() ? photoCaption(post) : post.text;
    const length = visibleLength(text);
    if (!text.trim() || !length) throw new Error("Текст поста пуст");
    if (length > (post.imageUrl?.trim() ? CAPTION_LIMIT : MESSAGE_LIMIT)) throw new Error("Текст превышает допустимую длину Telegram");
    const stack: string[] = [];
    for (const match of text.matchAll(TAG)) {
        const tag = /^<(\/)?([\w-]+)\b/.exec(match[0]);
        if (!tag || !ALLOWED.has(tag[2])) throw new Error(`Неподдерживаемый HTML-тег: ${match[0]}`);
        if (tag[1]) {
            if (stack.pop() !== tag[2]) throw new Error("Нарушен порядок закрытия HTML-тегов");
        } else {
            if (tag[2] === "a" && !/\bhref\s*=\s*(["']).+?\1/.test(match[0])) throw new Error("У ссылки отсутствует адрес href в кавычках");
            if (tag[2] === "span" && !/\bclass\s*=\s*(["'])tg-spoiler\1/.test(match[0])) throw new Error("Telegram поддерживает span только с class=\"tg-spoiler\"");
            stack.push(tag[2]);
        }
    }
    if (stack.length) throw new Error("В тексте есть незакрытые HTML-теги");
    const plain = text.replace(TAG, "");
    if (/<|&(?!amp;|lt;|gt;|quot;|#\d+;|#x[\da-f]+;)/i.test(plain)) throw new Error("Экранируйте символы < и & в тексте как &lt; и &amp;");
    return {textLength: length, shortened: text !== post.text};
};

export const checkTelegramPhoto = (bytes: Uint8Array) => {
    if (!bytes.byteLength) throw new Error("Файл фотографии пуст");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Фотография больше допустимых 10 МБ");
    let size;
    try { size = imageSize(bytes); } catch { throw new Error("По ссылке не удалось распознать изображение: проверьте файл фотографии"); }
    if (!["jpg", "png", "webp"].includes(size.type || "")) throw new Error("Для фотографии используйте JPEG, PNG или WebP");
    const {width, height} = size;
    if (!width || !height || width + height > 10000) throw new Error("Сумма ширины и высоты фотографии должна быть не больше 10000 пикселей");
    if (Math.max(width, height) / Math.min(width, height) > 20) throw new Error("Соотношение сторон фотографии должно быть не больше 20:1");
    return {width, height, format: size.type!, bytes: bytes.byteLength};
};

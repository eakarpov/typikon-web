'use client';
import {useEffect, useRef} from "react";

// Запоминает абзац, на котором читатель остановился.
//
// Отметка — первый абзац, ещё видимый под верхней кромкой окна. Пишется она не на
// каждую прокрутку, а когда место устоялось: через несколько секунд после
// последнего движения и при уходе со страницы. Открыть текст и тут же закрыть —
// не чтение: первая отметка ставится не раньше, чем страница побыла открытой.
//
// Компонент ничего не рисует и ставится только вошедшему: анониму отметку
// хранить негде.

const SETTLE_MS = 4000;
const MIN_OPEN_MS = 10000;
/** Кромка под шапкой сайта: абзац, ушедший под неё, считается прочитанным. */
const TOP_EDGE_PX = 96;

const currentParagraph = (): { paragraph: number; total: number } | null => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-paragraph-index]");
    if (!nodes.length) return null;
    let paragraph = nodes.length - 1;
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].getBoundingClientRect().bottom > TOP_EDGE_PX) {
            paragraph = i;
            break;
        }
    }
    return {paragraph, total: nodes.length};
};

const ReadingProgressTracker = ({textId}: { textId: string }) => {
    const sent = useRef<number | null>(null);

    useEffect(() => {
        if (!/^[0-9a-f]{24}$/i.test(textId)) return;
        // Выдержка (?range=…) показывает часть текста, и счёт абзацев в ней свой:
        // отметка из неё увела бы не туда в полном тексте.
        if (new URLSearchParams(window.location.search).has("range")) return;
        const openedAt = Date.now();
        let timer: ReturnType<typeof setTimeout> | null = null;

        const send = (leaving: boolean) => {
            if (Date.now() - openedAt < MIN_OPEN_MS) return;
            const place = currentParagraph();
            if (!place || place.paragraph === sent.current) return;
            sent.current = place.paragraph;
            fetch("/api/reading-progress", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({textId, ...place}),
                keepalive: leaving,
            }).catch(() => undefined); // отметка — удобство, а не данные: не дошла, и ладно
        };

        // Задержка — не меньше остатка до MIN_OPEN_MS: прокрутка в первые секунды
        // иначе сняла бы первую отметку и не поставила своей.
        const schedule = () => {
            if (timer) clearTimeout(timer);
            const untilOpen = MIN_OPEN_MS - (Date.now() - openedAt) + 200;
            timer = setTimeout(() => send(false), Math.max(SETTLE_MS, untilOpen));
        };
        const onHide = () => { if (document.visibilityState === "hidden") send(true); };

        // Первая отметка — и без прокрутки: короткий текст читают не листая.
        schedule();
        window.addEventListener("scroll", schedule, {passive: true});
        document.addEventListener("visibilitychange", onHide);
        return () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener("scroll", schedule);
            document.removeEventListener("visibilitychange", onHide);
            send(true);
        };
    }, [textId]);

    return null;
};

export default ReadingProgressTracker;

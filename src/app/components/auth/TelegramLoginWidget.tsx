'use client';
import {memo, useEffect, useRef} from "react";

/**
 * Виджет Telegram — один на два места: вход и привязка в профиле.
 *
 * Сценарий вставляется В СВОЙ КОНТЕЙНЕР, а не выносится в конец страницы через
 * next/script. Виджет подменяет собою тот тег, из которого запущен, и при выносе
 * его рамка оставалась в теле документа насовсем: ради этого прежде держался
 * отдельный TelegramLoginRemover, стиравший её по идентификатору при уходе со
 * страницы. Внутри контейнера рамка уходит вместе с ним, сама собой.
 *
 * Обработчик остаётся глобальным: виджет зовёт функцию по ИМЕНИ, записанному в
 * data-onauth, и другого уговора с ним нет.
 */
const TelegramLoginWidget = ({
    bot,
    onAuth,
}: {
    bot: string;
    onAuth: (fields: Record<string, unknown>) => void;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const handler = useRef(onAuth);
    useEffect(() => { handler.current = onAuth; }, [onAuth]);

    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        window.onTelegramAuth = (fields: any) => handler.current(fields);

        const script = document.createElement("script");
        script.async = true;
        script.src = "https://telegram.org/js/telegram-widget.js?23";
        script.setAttribute("data-telegram-login", bot);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-radius", "6");
        script.setAttribute("data-request-access", "write");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        container.appendChild(script);

        return () => {
            container.innerHTML = "";
            delete window.onTelegramAuth;
        };
    }, [bot]);

    return <div ref={ref} />;
};

export default memo(TelegramLoginWidget);

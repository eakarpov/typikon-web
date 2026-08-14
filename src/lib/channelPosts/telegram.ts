// Отправка поста в Telegram — общая логика для крона (src/scripts/publish-channel-posts.ts)
// и для ручной кнопки "Отправить сейчас" в /admin/channel-posts (используется прямо из Next.js,
// поэтому без импортов из src/scripts — там свой бутстрап окружения через @next/env).

export interface TelegramPostInput {
    text: string;
    imageUrl?: string | null;
}

export const sendChannelPostToTelegram = async (
    post: TelegramPostInput,
    botToken: string,
    channelId: string,
) => {
    const method = post.imageUrl ? "sendPhoto" : "sendMessage";
    const body = post.imageUrl
        ? { chat_id: channelId, photo: post.imageUrl, caption: post.text, parse_mode: "HTML" }
        : { chat_id: channelId, text: post.text, parse_mode: "HTML", disable_web_page_preview: true };

    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
        throw new Error(`Telegram: ${data.description || res.status}`);
    }
    return data.result;
};

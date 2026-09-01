import nodemailer from "nodemailer";

// ПИСЬМО ЧЕЛОВЕКУ, а не отчёт себе. Прежде почтой пользовалась одна форма
// обратной связи, и слала она всегда НАМ; теперь надо писать и наружу — тому,
// чью заявку разобрали. Оттого отправитель вынесен сюда.
//
// ПИСЬМО НЕ ОБЯЗАНО ДОЙТИ, И ЭТО НЕ ПОВОД ВАЛИТЬ ДЕЛО. Решение по заявке
// записано в базу и видно на странице; письмо только избавляет человека от
// нужды туда заглядывать. Не ушло — пишем в лог и живём дальше: отменять
// назначение оттого, что почта капризничает, было бы нелепо.

const transporter = () => {
    if (!process.env.EMAIL || !process.env.EMAIL_PASSWORD) return null;
    return nodemailer.createTransport({
        host: "smtp.yandex.ru",
        port: 465,
        secure: true,
        auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASSWORD },
    });
};

export const sendMail = async (
    to: string, subject: string, text: string,
): Promise<boolean> => {
    const t = transporter();
    if (!t) {
        console.warn(`почта не настроена — письмо «${subject}» для ${to} не ушло`);
        return false;
    }
    try {
        await t.sendMail({ from: process.env.EMAIL, to, subject, text });
        return true;
    } catch (e) {
        console.error(`письмо «${subject}» для ${to} не ушло:`, e);
        return false;
    }
};

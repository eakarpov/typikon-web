import { NextApiRequest, NextApiResponse } from 'next'
import * as nodemailer from "nodemailer";
import {checkCaptcha} from "@/lib/captcha";
import {CONTACT_LIMIT, clientIp, rateLimit} from "@/lib/rateLimit";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        if (!rateLimit(req, res, CONTACT_LIMIT)) return;
        const {email, theme, value, captcha, isMobile} = req.body ?? {};

        const verdict = checkCaptcha(clientIp(req), captcha);
        if (verdict === "wrong") {
            res.status(400).send("Неправильный токен");
            return;
        }
        if (verdict === "missing") {
            res.status(400).send("Не найдена запись");
            return;
        }

        if (typeof email !== "string" || typeof value !== "string" || !email || !value) {
            res.status(400).send("Пустая форма");
            return;
        }
        if (email.length > 254 || value.length > 20000 || (theme != null && (typeof theme !== "string" || theme.length > 300))) {
            res.status(400).send("Слишком длинно");
            return;
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.yandex.ru",
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOption = {
            from: process.env.EMAIL,
            to: process.env.EMAIL,
            subject: theme || "Default theme",
            text: `${email}: ${value}${isMobile ? " (Отправлено из приложения)" : ""}`,
        };

        transporter.sendMail(mailOption, (err, data) => {
            if (err) {
                res.status(500).end();
                reportError(err, { where: "pages/api/contact: письмо не ушло", source: "api" });
            } else {
                res.status(200).end();
            }
        });
    } else {
        res.status(404).end();
    }
}
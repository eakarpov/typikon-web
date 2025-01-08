import { NextApiRequest, NextApiResponse } from 'next'
import * as nodemailer from "nodemailer";
import {store} from "@/lib/captcha";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const {email, theme, value, captcha} = req.body;

        const ip: string = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress as string;
        // const data = await readCaptcha(ip as string);
        if (store[ip]) {
            const { token } = store[ip];
            if (token !== captcha) {
                res.status(400).send("Неправильный токен");
                return;
            } else {
                delete store[ip];
            }
        } else {
            res.status(400).send("Не найдена запись");
            return;
        }

        if (!email || !value) {
            res.status(400).send("Пустая форма");
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
            text: `${email}: ${value}`,
        };

        transporter.sendMail(mailOption, (err, data) => {
            if (err) {
                res.status(500).end();
                console.log(err, process.env.EMAIL, process.env.EMAIL_PASSWORD);
            } else {
                res.status(200).end();
            }
        });
    } else {
        res.status(404).end();
    }
}
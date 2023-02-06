import { NextApiRequest, NextApiResponse } from 'next'
import * as nodemailer from "nodemailer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const {email, theme, value} = req.body;
        if (!email || !value) {
            res.status(400).end();
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
                console.log(err);
            } else {
                res.status(200).end();
            }
        });
    } else {
        res.status(404).end();
    }
}
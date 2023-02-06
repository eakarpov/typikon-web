"use client";

import {useState} from "react";

const Content = () => {
    const [email, setEmail] = useState("");
    const [theme, setTheme] = useState("");
    const [value, setValue] = useState("");

    const [sent, setIsSent] = useState(false);
    const [error, setError] = useState(false);

    const onSend = () => {
        setIsSent(false);
        setError(false);
        fetch(`/api/contact`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                theme,
                value,
            }),
        }).then(res => {
            if (res.status === 200) {
                setIsSent(true);
            } else {
                setError(true);
            }
        });
    };
    return (
        <div className="flex flex-col">
            <label>
                E-mail обратной связи (обязательно)
            </label>
            <input
                className="border-2"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />

            <label>
                Тема письма
            </label>
            <input
                className="border-2"
                value={theme}
                onChange={e => setTheme(e.target.value)}
            />

            <label>
                Текст письма (обязательно)
            </label>
            <textarea
                className="border-2"
                value={value}
                onChange={e => setValue(e.target.value)}
            />

            <div className="flex items-start">
                <button onClick={onSend}>Отправить</button>
            </div>
            {sent && (
                <div>
                    <p>Письмо отправлено</p>
                </div>
            )}
            {error && (
                <div>
                    <p>Ошибка при отправке письма</p>
                </div>
            )}
        </div>
    );
};

export default Content;

"use client";

import {useEffect, useState} from "react";

const Content = () => {
    const [email, setEmail] = useState("");
    const [theme, setTheme] = useState("");
    const [value, setValue] = useState("");
    const [captcha, setCaptcha] = useState("");

    const [sent, setIsSent] = useState(false);
    const [error, setError] = useState(false);
    const [img, setImg] = useState<string|null>(null);
    const [force, setForce] = useState(false);

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
                captcha,
            }),
        }).then(res => {
            if (res.status === 200) {
                setIsSent(true);
                setForce(old => !old);
                setCaptcha("");
            } else {
                setError(true);
                setForce(old => !old);
                setCaptcha("");
            }
        });
    };

    useEffect(() => {
        fetch('/api/captcha', {
            method: 'POST',
        }).then((res) => res.blob()).then(res => {
            const urlImg = URL.createObjectURL(new Blob([res], { type: 'image/png' }));
            setImg(urlImg);
        });
    }, [force]);

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

            <label>
                CAPTCHA
            </label>
            <input
                className="border-2"
                value={captcha}
                onChange={e => setCaptcha(e.target.value)}
            />
            <img style={{ width: 300 }} src={img} />

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

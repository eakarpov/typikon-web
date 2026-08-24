'use client';
import { useEffect } from "react";

// Регистрируем service worker только в проде: в dev он кэширует ответы Next и мешает
// горячей перезагрузке. Проверять офлайн-режим надо на сборке (npm run build && npm start).
const ServiceWorkerRegistrar = () => {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;
        if (!("serviceWorker" in navigator)) return;

        // Регистрация после load, чтобы не соперничать за сеть с первой отрисовкой.
        const register = () => {
            navigator.serviceWorker.register("/sw.js").catch((e) => {
                console.error("Не удалось зарегистрировать service worker", e);
            });
        };

        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register);
            return () => window.removeEventListener("load", register);
        }
    }, []);

    return null;
};

export default ServiceWorkerRegistrar;

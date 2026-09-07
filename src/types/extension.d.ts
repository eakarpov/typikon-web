// Обработчики, которые внешние скрипты входа вызывают у окна: Google Identity
// Services зовёт handleCredentialResponse, виджет Telegram — onTelegramAuth.
// Оба назначаются из src/app/login/Content.tsx.
//
// export {} обязателен: без него файл не модуль, а declare global в немодуле
// не расширяет Window вовсе — объявление стояло, а типы его не видели.
export {};

declare global {
    interface Window {
        handleCredentialResponse: (res: any) => Promise<void>;
        onTelegramAuth: (userData: any) => Promise<void>;
    }
}

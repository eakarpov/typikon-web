// Обработчики и объекты, которые внешние скрипты входа ищут у окна.
//
// Виджет Telegram зовёт функцию по ИМЕНИ, записанному в data-onauth, — иначе с
// ним не сговориться, и onTelegramAuth остаётся глобальным. Google Identity
// Services глобального имени не требует: обработчик передаётся ему прямо в
// accounts.id.initialize, поэтому прежнего handleCredentialResponse здесь
// больше нет. Назначается всё из src/app/login/Content.tsx.
//
// export {} обязателен: без него файл не модуль, а declare global в немодуле
// не расширяет Window вовсе — объявление стояло, а типы его не видели.
export {};

declare global {
    interface Window {
        onTelegramAuth?: (userData: any) => void;
        google?: any;
    }
}

// У trek-captcha нет ни своих типов, ни пакета в @types. Объявление снято с
// самого lib/captcha.js: generate({size, style}) отдаёт GIF в буфере и разгадку
// строкой.
declare module "trek-captcha" {
    interface GeneratedCaptcha {
        buffer: Buffer;
        token: string;
    }

    export default function generate(options?: { size?: number; style?: number }): Promise<GeneratedCaptcha>;
}

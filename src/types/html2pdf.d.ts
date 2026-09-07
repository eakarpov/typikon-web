// html2pdf.js поставляет свои типы, но её Html2PdfOptions не знает про
// pagebreak — ключ, который сама библиотека понимает и который здесь нужен:
// без него разрыв страницы приходится на середину строки чтения.
export {};

declare module "html2pdf.js" {
    interface Html2PdfOptions {
        pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[]; avoid?: string | string[] };
    }
}

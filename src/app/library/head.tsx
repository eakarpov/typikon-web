import CommonMeta from "@/app/components/CommonMeta";

export default function Head() {
    return (
        <>
            <CommonMeta />
            <title>Библиотека текстов</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения, объединенные в книги для полного прочтения." />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Библиотека уставных текстов" />
            <meta property="og:url" content="//www.typikon.su/library/" />
            <meta property="og:description" content="Уставные чтения, объединенные в книги для полного прочтения." />
        </>
    )
}

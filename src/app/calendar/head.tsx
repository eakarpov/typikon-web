import CommonMeta from "@/app/components/CommonMeta";

export default function Head() {
    return (
        <>
            <CommonMeta />
            <title>Чтения на календарный день</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения на календарный день." />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Уставные чтения на календарный день" />
            <meta property="og:url" content="//www.typikon.su/calendar/" />
            <meta property="og:description" content="Уставные чтения на календарный день." />
        </>
    )
}

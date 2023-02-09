import CommonMeta from "@/app/components/CommonMeta";

export default function Head() {
    return (
        <>
            <CommonMeta />
            <title>Чтения на день</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения на выбранный день годового и триодного круга." />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Уставные чтения на день" />
            <meta property="og:url" content="//www.typikon.su/reading-calculator/" />
            <meta property="og:description" content="Уставные чтения на выбранный день годового и триодного круга." />
        </>
    )
}

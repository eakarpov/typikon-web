import CommonMeta from "@/app/components/CommonMeta";

export default function Head() {
    return (
        <>
            <CommonMeta />
            <title>Чтения на год</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения вне триодных периодов Постной и Цветной Триодей." />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Уставные чтения на год" />
            <meta property="og:url" content="//www.typikon.su/rest-readings/" />
            <meta property="og:description" content="Уставные чтения вне триодных периодов Постной и Цветной Триодей." />
        </>
    )
}

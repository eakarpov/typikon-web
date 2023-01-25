import { analyticsConnector } from "@/utils/google";

export default function Head() {
    return (
        <>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0"></script>
            <script>{analyticsConnector}</script>
            <title>Чтения на год</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения вне триодных периодов Постной и Цветной Триодей." />
            <link rel="icon" href="/favicon.ico" />
        </>
    )
}

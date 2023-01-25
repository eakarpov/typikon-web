import { analyticsConnector } from "@/utils/google";

export default function Head() {
    return (
        <>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0"></script>
            <script>{analyticsConnector}</script>
            <title>Чтения на день</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения на выбранный день годового и триодного круга." />
            <link rel="icon" href="/favicon.ico" />
        </>
    )
}

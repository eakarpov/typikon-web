import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import SavedLinks from "@/app/offline/SavedLinks";

// Страница показывается service worker'ом, когда сети нет, а запрошенное чтение
// в кэш ещё не попало. Держится в кэше с установки приложения, поэтому она
// намеренно простая: ни запросов к базе, ни картинок.
export const metadata: Metadata = {
    title: "Нет сети",
    description: "Страница недоступна без интернета",
};

const Offline = () => (
    <div className={`${myFont.variable} flex flex-col gap-3 pt-6`}>
        <h1 className="text-xl font-bold font-serif">Нет соединения</h1>
        <p className="font-serif">
            Эта страница ещё не сохранена для чтения без интернета.
        </p>
        <p className="font-serif">
            Чтения, которые вы уже открывали, доступны и сейчас — откройте их
            из истории браузера или по прежним ссылкам.
        </p>
        <SavedLinks />
        <p className="font-serif">
            <Link href="/" className="text-amber-800 underline underline-offset-4">
                На главную
            </Link>
        </p>
    </div>
);

export default Offline;

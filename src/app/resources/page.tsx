import {myFont} from "@/utils/font";
import {memo} from "react";
import Link from "next/link";

const Resources = () => {

    return (
        <div className={myFont.variable}>
            <div className="flex flex-col font-serif">
                <div className="flex flex-row">
                    <h1 className="font-bold">
                        Полезные ресурсы
                    </h1>
                </div>
                <div className="flex flex-row">
                    <h2 className="font-bold">
                        Внутренние
                    </h2>
                </div>
                <ul>
                    <li>
                        <Link href="/dictionary">
                            <span>
                                Склонение/спряжение церковнославянских слов
                            </span>
                        </Link>
                    </li>
                </ul>
                <div className="flex flex-row">
                    <h2 className="font-bold">
                        Внешние
                    </h2>
                </div>
                <ul>
                    <li>
                        <Link href="https://dneslov.org/">
                            <span>
                                Днеслов
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="https://osanna.russportal.ru">
                            <span>
                                Портал Осанна
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="https://ustavschik.livejournal.com/">
                            <span>
                                ЖЖ Уставщик
                            </span>
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default memo(Resources);

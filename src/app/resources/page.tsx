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
                        <Link href="https://dneslov.org/" target="_blank" referrerPolicy="no-referrer">
                            <span>
                                <b>Днеслов</b> (Церковный календарь
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="https://osanna.russportal.ru" target="_blank" referrerPolicy="no-referrer">
                            <span>
                                <b>Портал Осанна</b> (Киевские минеи)
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="https://ustavschik.livejournal.com/" target="_blank" referrerPolicy="no-referrer">
                            <span>
                                <b>ЖЖ Уставщик</b> (Новые и редкие богослужебные тексты)
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="http://znamen.ru/" target="_blank" referrerPolicy="no-referrer">
                            <span>
                                <b>znamen.ru</b> (Знаменные ноты)
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="http://scripta-bulgarica.eu/bg/manuscript"
                            target="_blank"
                            referrerPolicy="no-referrer"
                        >
                            <span>
                                <b>Scripta Bulgarica</b> (Отекстованные книги болгарской коллекции
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="https://lib-fond.ru/" target="_blank" referrerPolicy="no-referrer">
                            <span>
                                <b>lib-fond</b> (Сканы документов русских архивов)
                            </span>
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default memo(Resources);

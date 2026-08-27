'use client';
import Link from "next/link";
import {
    Cog6ToothIcon,
    EnvelopeIcon,
    InformationCircleIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    ArrowLeftOnRectangleIcon,
    ArrowRightOnRectangleIcon,
    UserCircleIcon,
} from "@heroicons/react/20/solid";
import {usePathname, useRouter} from "next/navigation";
import {useCallback, useEffect, useState} from "react";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";
import {WithRights} from "@/lib/admin/client";
import NewsLink from "@/app/NewsLink";
import {BIBLE_LANGUAGE_OPTIONS, DEFAULT_BIBLE_LANGUAGE, getClientBibleLanguage, setClientBibleLanguage} from "@/utils/bibleLanguage";

const NavMenu = ({ showButton, showAdmin, isDevelopment }: {
    showAdmin?: string;
    showButton?: string;
    isDevelopment?: boolean;
}) => {
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const router = useRouter();

    const isAuth = useAppSelector(state => state.auth.isAuthorized);
    const isSessionResolved = useAppSelector(state => state.auth.isResolved);
    const userStore =  useAppSelector(state => state.auth.user);

    const [bibleLang, setBibleLang] = useState(DEFAULT_BIBLE_LANGUAGE);

    useEffect(() => {
        setBibleLang(getClientBibleLanguage());
    }, []);

    const onChangeBibleLang = useCallback((lang: string) => {
        setBibleLang(lang);
        setClientBibleLanguage(lang);
        router.refresh();
    }, [router]);

    const onLogout = useCallback(() => {
        fetch("/api/logout", {
            method: "POST"
        });
        dispatch(AuthSlice.actions.Logout());
        router.push("/");
    }, []);

    return (
        <div className="container mx-auto px-4 flex flex-row items-baseline">
            <Link href="/" className={`text-lg mr-3 font-bold min-w-fit font-serif ${pathname === `/` && `text-red-900`}`}>
                Уставные чтения
            </Link>
            {/* Шапка делится надвое: слева разделы, ради которых сюда приходят,
                справа служебное — значками и прижатое к краю (ml-auto ниже).
                Так длина шапки перестаёт расти от каждого нового инструмента:
                разделов немного и они называются словами, инструменты же
                узнаются по значку и места почти не занимают. */}
            {/* gap-4, а не space-x-4: последний задаёт детям margin-left более
                частным селектором и перебивает ml-auto у служебной половины —
                та переставала прижиматься вправо, причём молча. */}
            <div className="flex flex-row gap-4 grow">
                <Link
                    href="/penticostarion"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/penticostarion`) && `text-red-600`}`}
                >
                    Цветная триодь
                </Link>
                <Link
                    href="/triodion"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/triodion`) && `text-red-600`}`}
                >
                    Постная триодь
                </Link>
                <Link
                    href="/rest-readings"
                    className={`cursor-pointer min-w-fit font-serif ${pathname === `/rest-readings` && `text-red-600`}`}
                >
                    Вне триодного цикла
                </Link>
                <Link
                    href="/calendar"
                    className={`cursor-pointer min-w-fit font-serif ${(pathname?.includes(`/calendar`) || pathname?.includes(`/months`)) && `text-red-600`}`}
                >
                    Календарные чтения
                </Link>
                <Link
                    href="/calculator"
                    className={`cursor-pointer min-w-fit font-serif ${pathname === `/calculator` && `text-red-600`}`}
                >
                    Чтения на день
                </Link>
                <Link
                    href="/library"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/library`) && `text-red-600`}`}
                >
                    Библиотека
                </Link>
                <Link
                    href="/chants"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/chants`) && `text-red-600`}`}
                >
                    Песнопения
                </Link>
                <WithRights
                    session={isAuth}
                    user={userStore}
                    isDevelopment={isDevelopment}
                    showButton={showAdmin === Boolean(true).toString()}
                    Component={() => (
                        <Link
                            href="/admin"
                            className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/admin`) && `text-red-600`}`}
                        >
                            Админка
                        </Link>
                    )}
                />
                {/* Отсюда начинается служебная половина: она прижата вправо,
                    и всё в ней — значками. */}
                <Link
                    href="/texting"
                    title="Отекстовка"
                    className={`ml-auto cursor-pointer min-w-fit flex items-center ${pathname?.includes(`/texting`) && `text-red-600`}`}
                >
                    <PencilSquareIcon className="w-4 h-4" />
                </Link>
                <NewsLink icon />
                <Link
                    href="/search"
                    title="Поиск"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/search` && `text-red-600`}`}
                >
                    <MagnifyingGlassIcon
                        className="w-4 h-4"
                    />
                </Link>
                <Link
                    href="/contact"
                    title="Обратная связь"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/contact` && `text-red-600`}`}
                >
                    <EnvelopeIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/about"
                    title="О проекте"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/about` && `text-red-600`}`}
                >
                    <InformationCircleIcon className="w-4 h-4" />
                </Link>
                <div
                    title="Язык Библии (для зачал)"
                    className="cursor-pointer min-w-fit flex items-center font-serif text-sm"
                >
                    {BIBLE_LANGUAGE_OPTIONS.map((opt, i) => (
                        <span key={opt.code}>
                            {i > 0 && <span className="text-slate-400">/</span>}
                            <span
                                className={bibleLang === opt.code ? "text-red-600 font-bold" : "text-slate-400"}
                                onClick={() => onChangeBibleLang(opt.code)}
                            >
                                {opt.label}
                            </span>
                        </span>
                    ))}
                </div>
                <Link
                    title="Настройки"
                    href="/settings"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/settings` && `text-red-600`}`}
                >
                    <Cog6ToothIcon className="w-4 h-4" />
                </Link>
                {isAuth && (
                    <Link
                        title="Профиль"
                        href="/profile"
                        className={`cursor-pointer min-w-fit flex items-center ${pathname === `/profile` && `text-red-600`}`}
                    >
                        <UserCircleIcon className="w-4 h-4" />
                    </Link>
                )}
                {showButton === Boolean(true).toString() && isSessionResolved && (!isAuth ? (
                    <Link
                        href="/login"
                        title="Войти"
                        className={`cursor-pointer min-w-fit flex items-center ${pathname === `/login` && `text-red-600`}`}
                    >
                        <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                    </Link>
                ) : (
                    <Link
                        href={"#"}
                        title="Выход"
                        onClick={onLogout}
                        className={`cursor-pointer min-w-fit flex items-center ${pathname === `/login` && `text-red-600`}`}
                    >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    </Link>
                ))}
            </div>
        </div>
    )
};

export default NavMenu;

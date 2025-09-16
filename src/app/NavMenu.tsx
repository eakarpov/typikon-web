'use client';
import Link from "next/link";
import {
    Cog6ToothIcon,
    EnvelopeIcon,
    InformationCircleIcon,
    MagnifyingGlassIcon,
    ArrowLeftOnRectangleIcon,
    ArrowRightOnRectangleIcon,
    UserCircleIcon,
} from "@heroicons/react/20/solid";
import {usePathname, useRouter} from "next/navigation";
import {useCallback, useEffect} from "react";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {AuthSlice} from "@/lib/store/auth";
import {WithRights} from "@/lib/admin/client";

const NavMenu = ({ showButton, showAdmin, session, user }: {
    showAdmin?: string;
    session: any|null;
    showButton?: string;
    user?: any;
}) => {
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const router = useRouter();

    const isAuth = useAppSelector(state => state.auth.isAuthorized);
    const userStore =  useAppSelector(state => state.auth.user);

    useEffect(() => {
        if (session) {
            dispatch(AuthSlice.actions.SetAuthorized({ ...session, user }));
        }
    }, [session]);

    const onLogout = useCallback(() => {
        fetch("/api/logout", {
            method: "POST"
        });
        dispatch(AuthSlice.actions.Logout());
    }, []);

    return (
        <div className="container mx-auto px-4 flex flex-row items-baseline">
            <Link href="/" className={`text-lg mr-3 font-bold min-w-fit font-serif ${pathname === `/` && `text-red-900`}`}>
                Уставные чтения
            </Link>
            <div className="flex flex-row space-x-4">
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
                    Чтения на конкретный день
                </Link>
                <Link
                    href="/library"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/library`) && `text-red-600`}`}
                >
                    Библиотека
                </Link>
                <WithRights
                    session={session}
                    user={userStore}
                    isDevelopment={process.env.NODE_ENV === "development"}
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
                <Link
                    href="/search"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/search` && `text-red-600`}`}
                >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/contact"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/contact` && `text-red-600`}`}
                >
                    <EnvelopeIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/about"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/about` && `text-red-600`}`}
                >
                    <InformationCircleIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/settings"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/settings` && `text-red-600`}`}
                >
                    <Cog6ToothIcon className="w-4 h-4" />
                </Link>
                {isAuth && (
                    <Link
                        href="/profile"
                        className={`cursor-pointer min-w-fit flex items-center ${pathname === `/profile` && `text-red-600`}`}
                    >
                        <UserCircleIcon className="w-4 h-4" />
                    </Link>
                )}
                {showButton === Boolean(true).toString() && (!isAuth ? (
                    <Link
                        href="/login"
                        className={`cursor-pointer min-w-fit flex items-center ${pathname === `/login` && `text-red-600`}`}
                    >
                        <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                    </Link>
                ) : (
                    <Link
                        href={"#"}
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

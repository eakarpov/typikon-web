import Link from "next/link";
import {hasAdminRights} from "@/lib/admin";

const Admin = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
    return (
        <div className="flex flex-col">
            <div className="flex flex-row">
                <div className="flex flex-col">
                    <p>
                        <strong>Редактирование по коллекциям</strong>
                    </p>
                    <Link href="/admin/books">
                        Редактирование книг
                    </Link>
                    <Link href="/admin/weeks">
                        Редактирование недель
                    </Link>
                    <Link href="/admin/months">
                        Редактирование месяцев
                    </Link>
                    <Link href="/admin/signs">
                        Редактирование знаков Типикона
                    </Link>
                </div>
                <div className="flex flex-col">
                    <p>
                        <strong>Редактирование по id</strong>
                    </p>
                    <Link href="/admin/texts">
                        Редактирование текстов
                    </Link>
                    <Link href="/admin/days">
                        Редактирование дней
                    </Link>
                    <Link href="/admin/places">
                        Редактирование мест
                    </Link>
                </div>
                <div className="flex flex-col">
                    <p>
                        <strong>SQLITE БД</strong>
                    </p>
                    <Link href="/admin/nobles">
                        База по князьям (sqlite)
                    </Link>
                    <Link href="/admin/nobles/families">
                        База по князьям - рода (sqlite)
                    </Link>
                    <Link href="/admin/nobles/states">
                        База по князьям - державности (sqlite)
                    </Link>
                    <Link href="/admin/nobles/nationalities">
                        База по князьям - национальности (sqlite)
                    </Link>
                </div>
            </div>
            <div className="flex flex-row">
                <div className="flex flex-col">
                    <Link href="/admin/corrections">
                        Исправление ошибок
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default hasAdminRights(Admin);

import Link from "next/link";

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
            </div>
            <div>
            </div>
        </div>
    );
};

export default Admin;

import Link from "next/link";

const Admin = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
    return (
        <div className="flex flex-col">
            <Link href="/admin/books">
                Редактирование книг
            </Link>
           <Link href="/admin/texts">
               Редактирование текстов
           </Link>
            <Link href="/admin/weeks">
                Редактирование недель
            </Link>
            <Link href="/admin/days">
                Редактирование дней
            </Link>
        </div>
    );
};

export default Admin;

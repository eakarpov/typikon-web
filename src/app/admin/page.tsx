import Link from "next/link";

const Admin = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
    return (
        <div className="flex flex-col">
           <Link href="/admin/texts">
               Редактирование текстов
           </Link>
            <Link href="/admin/days">
                Редактирование дней
            </Link>
            <Link href="/admin/weeks">
                Редактирование недель
            </Link>
        </div>
    );
};

export default Admin;

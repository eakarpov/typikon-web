import Content from "@/app/admin/bible/Content";
import { getEditions } from "@/app/admin/bible/api";
import { hasAdminRights } from "@/lib/admin";

// Издания Библии и их книги. Отдельно от /admin/books потому, что у Библии другая
// единица правки: не «книга собрания с текстом», а издание, чьи книги ложатся в
// канон и чьи стихи ищутся по каноническому месту, а не по номеру строки.
const AdminBible = async () => {
    const editions = await getEditions();

    return (
        <div className="flex flex-col">
            <p className="mb-2">
                Издания заводятся переносом (<code>src/scripts/migrate-bible.ts</code>), здесь
                правится описание и содержимое книг.
            </p>
            <Content editions={editions} />
        </div>
    );
};

export default hasAdminRights(AdminBible);

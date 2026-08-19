'use client';
import {useState} from "react";
import Link from "next/link";

interface IUserNoteListItem {
    id: string;
    textId: string;
    textName: string | null;
    note: string;
    selection: { phrase: string };
    updatedAt: string;
}

const UserNotesList = ({items}: {items: IUserNoteListItem[]}) => {
    const [notes, setNotes] = useState(items);

    const onDelete = (id: string) => {
        fetch(`/api/user-notes/${id}`, {method: "DELETE", credentials: "include"})
            .then((res) => {
                if (!res.ok) {
                    alert("Не удалось удалить заметку");
                    return;
                }
                setNotes((prev) => prev.filter((n) => n.id !== id));
            })
            .catch(() => alert("Не удалось удалить заметку"));
    };

    if (notes.length === 0) {
        return <p>Заметок пока нет.</p>;
    }

    return (
        <ul>
            {notes.map((n) => (
                <li key={n.id} className="border-b py-2">
                    <Link href={`/reading/${n.textId}`} className="text-blue-800 font-bold">
                        {n.textName || "Текст"}
                    </Link>
                    <blockquote className="text-gray-600">«{n.selection.phrase}»</blockquote>
                    <p>{n.note}</p>
                    <button onClick={() => onDelete(n.id)}>Удалить</button>
                </li>
            ))}
        </ul>
    );
};

export default UserNotesList;

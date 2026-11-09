'use client';
import {useState} from "react";
import Link from "next/link";
import {href as studyHref, type Target} from "@/lib/study/core";
import NoteSharing from "@/app/components/NoteSharing";

interface IUserNoteListItem {
    id: string;
    textId: string;
    target?: Target;
    textName: string | null;
    note: string;
    selection: { phrase: string };
    updatedAt: string;
    companion?: {title:string;nodeTitle:string;nodeId:string;selection:Record<string,string>};
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
                    <Link href={n.companion ? '/companion?'+new URLSearchParams({...n.companion.selection,node:n.companion.nodeId}) : n.target ? studyHref(n.target) : `/reading/${n.textId}`} className="text-blue-800 font-bold">
                        {n.companion ? n.companion.title+" · "+n.companion.nodeTitle : n.textName || "Текст"}
                    </Link>
                    <blockquote className="text-gray-600">«{n.selection.phrase}»</blockquote>
                    <p>{n.note}</p>
                    <NoteSharing id={n.id}/>
                    <button onClick={() => onDelete(n.id)}>Удалить</button>
                </li>
            ))}
        </ul>
    );
};

export default UserNotesList;

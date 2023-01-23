'use client';

import Link from "next/link";
import {useState} from "react";

const AdminTextsForm = () => {
    const [id, setId] = useState("");
    return (
        <div className="flex flex-col">
            <label>
                Идентификатор
            </label>
            <input
                className="border-2"
                value={id}
                onChange={e => setId(e.target.value)}
            />
            <Link href={`/admin/texts/${id}`}>
                Перейти
            </Link>
        </div>
    );
};

export default AdminTextsForm;

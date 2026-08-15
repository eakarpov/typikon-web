'use client';

import {useState} from "react";
import {useRouter} from "next/navigation";

const RejectItem = ({ id }: { id: string }) => {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    const onReject = async () => {
        const reason = window.prompt("Причина отклонения (необязательно):") || "";
        setPending(true);
        try {
            const res = await fetch(`/api/admin/texting/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert("Ошибка при отклонении предложения");
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            className="border-2 px-2 disabled:opacity-50"
            onClick={onReject}
            disabled={pending}
        >
            Отклонить
        </button>
    );
};

export default RejectItem;

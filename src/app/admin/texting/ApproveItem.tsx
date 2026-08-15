'use client';

import {useState} from "react";
import {useRouter} from "next/navigation";

const ApproveItem = ({ id }: { id: string }) => {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    const onApprove = async () => {
        if (!window.confirm("Принять это предложение и обновить текст документа?")) return;
        setPending(true);
        try {
            const res = await fetch(`/api/admin/texting/${id}/approve`, { method: "POST" });
            if (res.ok) {
                router.refresh();
            } else {
                alert("Ошибка при принятии предложения");
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            className="border-2 px-2 disabled:opacity-50"
            onClick={onApprove}
            disabled={pending}
        >
            Принять
        </button>
    );
};

export default ApproveItem;

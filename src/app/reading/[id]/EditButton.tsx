"use client";
import Link from "next/link";
import {WithRights} from "@/lib/admin/client";
import {useAppSelector} from "@/lib/hooks";

const EditButton = ({ id, showButton, isDevelopment }: { id: string; isDevelopment?: boolean; showButton?: boolean; }) => {
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);
    const user = useAppSelector(state => state.auth.user);

    return (
        <WithRights
            Component={() => (
                <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                    <Link href={`/admin/texts/${id}`}>
                        Редактировать
                    </Link>
                </span>
            )}
            showButton={showButton}
            session={isAuthorized}
            user={user}
            isDevelopment={isDevelopment}
        />
    );
}

export default EditButton;

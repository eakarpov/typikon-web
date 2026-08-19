import {getAcceptedTextingCount, getItem} from "@/app/profile/api";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import Link from "next/link";
import Content from "@/app/profile/Content";
import UserNotesList from "@/app/profile/UserNotesList";
import {getAllUserNotes} from "@/app/api/user-notes/service";

const ProfilePage = async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (!session) {
        return (
            <div>
                Ошибка
            </div>
        );
    }

    const [item] = await getItem(session!.userId as string);

    if (!item) {
        return (
            <div>
                Пользователь не найден
            </div>
        )
    }

    const [acceptedTextingCount] = await getAcceptedTextingCount(session!.userId as string);
    const userNotes = await getAllUserNotes(session!.userId as string);

    return (
        <div>
            <p>
                Пользователь {item.id}
            </p>
            <p>
                Принято ваших отекстовок: {acceptedTextingCount}
            </p>
            <p>
                <Link href="/texting">
                    Помочь с отекстовкой
                </Link>
            </p>
            <Content item={item} />
            <div>
                <h3 className="font-bold">Мои заметки</h3>
                <UserNotesList items={userNotes as any} />
            </div>
            {item.isAdmin && (
                <div>
                    <p>
                        Вы админ.
                    </p>
                    <Link href="/admin/corrections">
                        <span>
                            Отчеты об ошибках
                        </span>
                    </Link>
                </div>
            )}
        </div>
    );
};

export  default ProfilePage;

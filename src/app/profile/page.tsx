import {getItem} from "@/app/profile/api";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import Link from "next/link";

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

    return (
        <div>
            <p>
                Пользователь {item.id}
            </p>
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

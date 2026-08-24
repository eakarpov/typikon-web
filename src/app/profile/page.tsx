import {getAcceptedTextingCount, getItem} from "@/app/profile/api";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import Link from "next/link";
import Content from "@/app/profile/Content";
import {getAllUserNotes} from "@/app/api/user-notes/service";
import SidePanel from "@/app/profile/SidePanel";
import {listTokens} from "@/app/api/api-tokens/service";

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
    const apiTokens = await listTokens(session!.userId as string);

    // На широком экране — две колонки: слева свои данные, справа вкладки с длинными
    // перечнями. До lg колонки складываются в одну и порядок остаётся прежним.
    return (
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 py-4">
            <div className="flex flex-col gap-2 lg:w-1/2">
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
            <div className="lg:w-1/2">
                <SidePanel notes={userNotes as any} tokens={apiTokens} />
            </div>
        </div>
    );
};

export  default ProfilePage;

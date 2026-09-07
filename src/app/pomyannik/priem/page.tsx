import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont } from "@/utils/font";
import { claimOf, commemoratorOf } from "@/lib/pomyannik/commemorators";
import { countUnread } from "@/lib/pomyannik/zapiski";
import Priem from "@/app/pomyannik/priem/Priem";

export const metadata: Metadata = {
    title: "Приём записок — Помянник",
    robots: { index: false, follow: false },
};

const PriemPage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    const userId = session?.userId as string | undefined;

    if (!userId) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl`}>
                <p className="font-serif">
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>,
                    чтобы подать заявку на приём записок.
                </p>
            </div>
        );
    }

    const [person, claim] = await Promise.all([commemoratorOf(userId), claimOf(userId)]);
    const unread = person ? await countUnread(userId) : 0;

    // Адрес берётся из запроса, а не из настроек: на своей машине ссылка должна
    // вести на свою машину, иначе проверить её нельзя.
    const host = (await headers()).get("host") ?? "www.typikon.su";
    const origin = host.startsWith("localhost") ? `http://${host}` : `https://${host}`;

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Приём записок</h1>
                {person ? (
                    <p className="font-serif text-slate-800 mt-2">
                        Вы принимаете поминальные записки как <strong>{person.title}</strong>.
                        Ссылку-приглашение можно раздать прихожанам или повесить на стенде.
                    </p>
                ) : (
                    <>
                        <p className="font-serif text-slate-800 mt-2">
                            Священник может принимать записки прямо здесь: прихожанин собирает её
                            из своего помянника, имена приходят проверенными и в церковной форме,
                            а вы отмечаете прочитанное.
                        </p>
                        {/* Сказать про деньги надо ПЕРВЫМ делом: приходящий сюда
                            ждёт привычного ящика с ценником, и не найдя его,
                            станет искать, где мы берём своё */}
                        <p className="font-serif text-slate-600 text-sm mt-2">
                            Оплат на сайте нет. Записка приходит к вам
                            напрямую; ни мы, ни приход в этом не участвуем и ничего с этого не
                            имеем. Оттого и право здесь личное, ваше, а не приходское.
                        </p>
                        <p className="font-serif text-slate-600 text-sm mt-2">
                            Сан мы не удостоверяем — за него отвечает епархия. Мы
                            сверяем два: страницу епархии, где вы названы, и ответ на письмо,
                            посланное на адрес в её домене. Порознь они не значат ничего: первое
                            говорит, что такой священник есть, второе — что заявку подали вы.
                        </p>
                    </>
                )}
            </div>

            <Priem
                origin={origin}
                person={person ? JSON.parse(JSON.stringify(person)) : null}
                claim={claim ? {
                    title: claim.title, dioceseUrl: claim.dioceseUrl, email: claim.email,
                    status: claim.status, decisionNote: claim.decisionNote ?? null,
                    again: Boolean(claim.again),
                } : null}
            />

            <nav className="flex flex-wrap gap-4 font-serif text-sm border-t pt-3">
                {person && (
                    <Link href="/pomyannik/prinyatye" className="text-red-900 hover:underline">
                        поданные записки{unread > 0 ? ` (${unread})` : ""} →
                    </Link>
                )}
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </nav>
        </div>
    );
};

export default PriemPage;

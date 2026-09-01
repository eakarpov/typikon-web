import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemple } from "@/lib/temples";
import { adminsOf, currentUserId } from "@/lib/parish/access";
import { myClaim } from "@/lib/parish/claims";
import { ClaimForm } from "./Form";

export const metadata: Metadata = { title: "Заявка на ведение расписания", robots: { index: false } };

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const temple = await getTemple(slug);
    if (!temple) notFound();

    const userId = await currentUserId();
    const admins = await adminsOf(slug);
    const claim = userId ? await myClaim(slug, userId) : null;

    return (
        <div style={{ maxWidth: "44rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.35rem" }}>Вести расписание этого храма</h1>
            <p style={{ color: "#666" }}>{temple.name}</p>

            {!userId ? (
                <p style={{ marginTop: "1rem" }}>
                    <Link href="/login">Войдите</Link>, чтобы оставить заявку: право
                    именное, и оно должно быть за кем-то записано.
                </p>
            ) : admins.some(a => a.userId === userId) ? (
                <p style={{ marginTop: "1rem" }}>
                    Вы уже ведёте расписание этого храма.{" "}
                    <Link href={`/parish/${slug}`}>Открыть расписание</Link>
                </p>
            ) : admins.length ? (
                // ЗАЯВКА ИДЁТ К ТОМУ, КТО УЖЕ ВЕДЁТ, а не к нам: решать, кто
                // ведёт чужой приход, сайт не вправе
                <div style={{ marginTop: "1rem" }}>
                    <p>
                        Расписание этого храма уже кто-то ведёт. Позвать вас может
                        только он — попросите его об этом; сайт за приход этого
                        не решает.
                    </p>
                    <p style={{ color: "#666", fontSize: ".9rem" }}>
                        Если связаться не удаётся, напишите нам — разберёмся руками.
                    </p>
                </div>
            ) : (
                <div style={{ marginTop: "1rem" }}>
                    {/* СОСТОЯНИЕ ЗАЯВКИ НАЗЫВАЕТСЯ. Прежде страница показывала
                        экран со знаком при любом статусе, и получивший отказ
                        по-прежнему читал «положите знак на сайт» — то есть
                        решение о нём было принято, а он об этом не знал */}
                    {claim?.status === "rejected" && (
                        <div style={{ padding: ".6rem .75rem", background: "#fdecec",
                                      marginBottom: "1rem" }}>
                            <b>Заявку не приняли.</b>
                            {claim.decisionNote && <> {claim.decisionNote}</>}
                            <div style={{ color: "#666", fontSize: ".9rem", marginTop: ".3rem" }}>
                                Считаете это недоразумением — отправьте заявку снова,
                                добавив, чем подтвердите. Прежнее решение при этом
                                останется на виду у разбирающего.
                            </div>
                        </div>
                    )}
                    {claim?.status === "pending" && !claim.checkNote && (
                        <div style={{ padding: ".6rem .75rem", background: "#f7f7f7",
                                      marginBottom: "1rem" }}>
                            Заявка принята и ждёт разбора. Ответ придёт письмом.
                        </div>
                    )}
                    <p style={{ color: "#555" }}>
                        Расписание выводится из устава само; ответственный поправляет
                        часы и говорит «этот месяц готов». Право именное и на один храм.
                    </p>
                    <ClaimForm slug={slug} website={temple.website ?? null}
                               existing={claim && claim.status !== "rejected"
                                   ? { token: claim.token, status: claim.status,
                                       checkNote: claim.checkNote }
                                   : null} />
                </div>
            )}
        </div>
    );
};

export default Page;

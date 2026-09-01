import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import { SIGN_LABELS } from "@/utils/chantLabels";
import {
    addressOf, CYCLE_LABELS, getLinkedSaint, getMemory, METHOD_LABELS, type Memory,
} from "@/lib/memories";

// Карточка ПАМЯТИ — службы, назначенной книгой на своё место. Не карточка
// святого: святой при памяти бывает, а бывает и нет, и /saints остаётся своим
// разделом.
//
// ЧТО ЗДЕСЬ ПОКАЗЫВАЕТСЯ И ЧЕГО НЕТ НИГДЕ БОЛЬШЕ. Знак службы со ВСЕМИ его
// источниками разом. Типикон называет знак прямо, книга — тем, что напечатала,
// строение службы — тем, чего в ней не хватает; сходятся они не всегда.
// Показать один «правильный» знак значило бы спрятать разногласие, а оно и
// есть самое ценное сведение: по нему видно, на чём стоит вывод.

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const memory = await getMemory(params.id);
    if (!memory) return { title: "Память не найдена" };
    const title = `${memory.label} — ${addressOf(memory)}`;
    return {
        title,
        description: `Служба в книге: ${addressOf(memory)}. Знак службы и его источники.`,
        openGraph: { type: "website", title, url: `//www.typikon.su/memories/${memory.memoryId}` },
    };
}

const Row = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", gap: "1rem", padding: "0.35rem 0", borderBottom: "1px solid #eee" }}>
        <div style={{ minWidth: "11rem", color: "#666" }}>{name}</div>
        <div>{children}</div>
    </div>
);

/** Знак и то, откуда он взят: показываем все источники, а не только победивший. */
const Sign = ({ sign }: { sign: NonNullable<Memory["sign"]> }) => {
    const named: [string, string | null][] = [
        ["tipikon", sign.tipikon], ["book", sign.book],
        ["book-absence", sign.bookAbsence], ["heuristic", sign.heuristic],
    ];
    const said = named.filter(([, v]) => v);
    // Разногласие называем вслух: два источника, назвавшие РАЗНОЕ, — это не
    // сбой разбора, а свойство книг, и уставщику оно важнее самого знака.
    const distinct = new Set(said.map(([, v]) => v));
    return (
        <>
            <div style={{ fontSize: "1.1rem" }}>
                {SIGN_LABELS[sign.default ?? ""] ?? sign.default ?? "не определён"}
            </div>
            {sign.evidence && <div style={{ color: "#666", marginTop: ".2rem" }}>{sign.evidence}</div>}
            {said.length > 0 && (
                <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.1rem" }}>
                    {said.map(([method, value]) => (
                        <li key={method}>
                            {SIGN_LABELS[value!] ?? value} — {METHOD_LABELS[method] ?? method}
                        </li>
                    ))}
                </ul>
            )}
            {distinct.size > 1 && (
                <div style={{ marginTop: ".4rem", color: "#8a6d3b" }}>
                    Источники расходятся: {distinct.size} разных знака. Взят тот, что назван
                    сильнейшим из них.
                </div>
            )}
        </>
    );
};

const MemoryPage = async ({ params }: Props) => {
    setMeta();
    const memory = await getMemory(params.id);
    if (!memory) notFound();

    const saint = await getLinkedSaint(memory.memoryId);
    const cycle = memory.feastCycle;

    return (
        <div className={myFont.variable} style={{ maxWidth: "48rem", margin: "0 auto", padding: "1rem" }}>
            <div style={{ marginBottom: ".5rem" }}>
                <Link href="/memories">← Реестр памятей</Link>
            </div>
            <h1 style={{ fontSize: "1.5rem", lineHeight: 1.3 }}>{memory.label}</h1>

            <Row name="В книге">{addressOf(memory)}</Row>
            {memory.sign && <Row name="Знак службы"><Sign sign={memory.sign} /></Row>}

            {cycle?.kind && (
                <Row name="Круг праздника">
                    {CYCLE_LABELS[cycle.kind] ?? cycle.kind}
                    {cycle.dayNo ? `, день ${cycle.dayNo}` : ""}
                    {cycle.feastLabel ? ` — ${cycle.feastLabel}` : ""}
                </Row>
            )}

            {memory.serviceRefs.length > 0 && (
                <Row name="Книга отсылает">
                    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                        {memory.serviceRefs.map((r, i) => <li key={i}>{r.text}</li>)}
                    </ul>
                </Row>
            )}

            {memory.variantOf && (
                <Row name="Иная служба">
                    тому же дню: <Link href={`/memories/${memory.variantOf}`}>{memory.variantOf}</Link>
                </Row>
            )}

            {/* СВЯТОЙ — ДОПОЛНЕНИЕ, А НЕ ОСНОВА КАРТОЧКИ. Показываем лишь
                подтверждённую человеком связь: кандидат сопоставителя — догадка,
                и выдать её за сведение значило бы приписать памяти чужое лицо. */}
            {saint && (
                <Row name="Святой">
                    <Link href={`/saints/${saint.slug ?? saint._id}`}>{saint.name ?? saint.title}</Link>
                </Row>
            )}

            <div style={{ marginTop: "1.5rem", color: "#888", fontSize: ".9rem" }}>
                Сведения о службе взяты из разбора богослужебных книг и Типикона.
                {!saint && " Святой этой памяти пока не сопоставлен."}
            </div>
        </div>
    );
};

export default MemoryPage;

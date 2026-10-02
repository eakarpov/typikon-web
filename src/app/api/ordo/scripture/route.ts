import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { editionForLang, versesForCanonChapter } from "@/lib/bible/query";
import { parseScriptureRef } from "@/lib/bible/scriptureRef";
import { bibleBook } from "@/utils/bibleBooks";

// Резолвер адресов Писания для читателя пакета .ordo: пакет везёт зачала и
// псалмы адресами (external, bible:<книга>.<глава>.<стих>[-<стих>]), и читатель
// дорезолвляет их сам — так опубликовано в spec/package.md. Эта ручка —
// эталонная реализация резолвера нашего же сайта: загруженный пакет в
// /posledovanie ей заполняет Писание. Внутренняя (без ключа), как соседние
// /api/ordo/*: ходит в нашу Библию, а не наружу.
//
// Язык — язык издания Библии: служебное чтение звучит по церковнославянски,
// издание по умолчанию у этого языка (cs-eliz). Строка пакета несёт язык
// корпуса (cu_gr — песнопения), и резолвить по нему не выйдет: Библия лежит
// в изданиях со своими кодами языков.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const ref = parseScriptureRef(url.searchParams.get("ref") ?? "");
    if (!ref) {
        return NextResponse.json({ error: "Адрес не разобрался: нужен вид bible:<книга>.<глава>.<стих>[-<стих>]" }, { status: 400 });
    }
    const canon = bibleBook(ref.canonId);
    if (!canon) {
        return NextResponse.json({ error: "Такой книги нет в каноне" }, { status: 404 });
    }
    const lang = (url.searchParams.get("lang") || "cs").trim() || "cs";

    try {
        const db = (await clientPromise).db("typikon");
        const edition = await editionForLang(db, lang);
        if (!edition) {
            return NextResponse.json({ error: `Издания для языка «${lang}» нет` }, { status: 404 });
        }
        const verses = await versesForCanonChapter(db, edition._id, canon.id, ref.chapter);
        if (!verses.length) {
            return NextResponse.json({ error: "В издании такой главы нет" }, { status: 404 });
        }
        const slice = ref.from == null
            ? verses
            : verses.filter(v => v.verse >= ref.from! && (ref.to == null || v.verse <= ref.to));
        if (!slice.length) {
            return NextResponse.json({ error: "Стихов по адресу нет" }, { status: 404 });
        }
        return NextResponse.json({
            ref: url.searchParams.get("ref"),
            lang,
            edition: edition.code,
            text: slice.map(v => v.content).join("\n"),
        }, { headers: { "Cache-Control": "max-age=3600" } });
    } catch {
        return NextResponse.json({ error: "Не удалось получить Писание" }, { status: 503 });
    }
}

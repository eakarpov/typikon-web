import { NextRequest, NextResponse } from "next/server";
import { feastDate, getDedication, getTemple } from "@/lib/temples";
import { SIGN_LABELS } from "@/utils/chantLabels";

// Престольный ли сегодня праздник в названном храме.
//
// Отдельный запрос, а не поле страницы дня, по одной причине: храм читателя
// живёт в его браузере (см. MyTemple), и серверу он неизвестен, пока читатель
// сам его не назовёт. Страница дня при этом остаётся общей для всех и
// кэшируется как прежде.

export const dynamic = "force-dynamic";

export const GET = async (request: NextRequest) => {
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    const date = request.nextUrl.searchParams.get("date") ?? "";
    if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "нужны slug и date вида ГГГГ-ММ-ДД" }, { status: 400 });
    }

    const temple = await getTemple(slug);
    if (!temple) return NextResponse.json({ error: "храм не найден" }, { status: 404 });

    const asked = new Date(`${date}T00:00:00Z`);
    const year = asked.getUTCFullYear();

    for (const prestol of temple.prestoly ?? []) {
        const dedication = await getDedication(prestol.dedication);
        for (const feast of dedication?.feasts ?? []) {
            // Год берём у спрошенной даты, а не текущий: подвижный праздник
            // считается от Пасхи ТОГО года, и в декабре спросить про май
            // следующего — обычное дело.
            const when = feastDate(feast, year);
            if (!when || when.getTime() !== asked.getTime()) continue;
            return NextResponse.json({
                temple: { slug: temple.slug, name: temple.name },
                prestol: { label: prestol.label, isMain: prestol.isMain, status: prestol.status },
                feast: {
                    note: feast.note ?? null,
                    movable: feast.paschaOffset !== undefined,
                    memoryId: feast.memoryId ?? null,
                    memoryLabel: feast.memoryLabel ?? null,
                    sign: feast.sign ?? null,
                    signLabel: feast.sign ? SIGN_LABELS[feast.sign] ?? feast.sign : null,
                },
            });
        }
    }

    return NextResponse.json({ temple: { slug: temple.slug, name: temple.name }, prestol: null, feast: null });
};

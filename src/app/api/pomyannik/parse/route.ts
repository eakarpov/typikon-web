import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { parseList } from "@/lib/pomyannik/parse";
import { checkName } from "@/lib/pomyannik/names";
import { allNames } from "@/lib/imeniny/store";
import { listPersons } from "@/lib/pomyannik/service";

// РАЗБОР БЕЗ ЗАПИСИ. Человек переписывает помянник с бумаги и должен увидеть,
// что мы поняли, ПРЕЖДЕ чем это ляжет в базу: где помета принята за родство, где
// имя стоит гражданским, где такое имя уже есть. Записать и потом чинить — то же
// самое, но руками и по одному.

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : null;
    if (!text) return NextResponse.json({ error: "нечего разбирать" }, { status: 400 });

    const kind = body?.kind === "departed" ? "departed" : "living";
    const batch = parseList(text, kind);

    const [names, mine] = await Promise.all([allNames(), listPersons(session.id)]);
    const index = new Set(names.map(n => n.key));
    const have = new Set(mine.map(p => `${p.kind}:${p.nameKey}`));

    const lines = batch.lines.map(line => {
        if (!line.person) return { ...line, check: null, duplicate: false };
        const check = checkName(line.person.name, index);
        return {
            ...line,
            check,
            // Повтор — не отказ, а предупреждение: двух Николаев в роду не
            // редкость, и решать, лишний ли один из них, не нам.
            duplicate: have.has(`${line.person.kind}:${check.key}`),
        };
    });

    return NextResponse.json({ lines, count: batch.count, truncated: batch.truncated });
}

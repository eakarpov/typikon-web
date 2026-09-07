import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { allNames } from "@/lib/imeniny/store";
import { checkName } from "@/lib/pomyannik/names";
import { slavonicName } from "@/lib/pomyannik/slavonic";

// Сверка одного имени: подсказка наречения и церковнославянская форма.
// Под сессией — потому что спрашивают её из помянника, а открытая ручка со
// словарём имён у нас уже есть на /imeniny.

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (!query.trim()) return NextResponse.json({ error: "нечего сверять" }, { status: 400 });

    const names = await allNames();
    const check = checkName(query, names.map(n => n.key));
    const slavonic = await slavonicName(check.name);

    return NextResponse.json({ ...check, slavonic });
}

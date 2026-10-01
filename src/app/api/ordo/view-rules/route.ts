import { NextResponse } from "next/server";
import { ordoViewRules } from "@/lib/ordoPackage";

// Таблицы подач (виды, синонимы ролей, тетради) — для клиентского чтения
// загруженного пакета: браузер не достучится до службы на 127.0.0.1, а через
// сайт — может. Значение константно на жизнь выкладки движка, потому кэш
// часовой; пропал движок — клиент честно покажет только «полное».
export const dynamic = "force-dynamic";

export async function GET() {
    const rules = await ordoViewRules();
    if (!rules) {
        return NextResponse.json({ error: "Служба устава не отвечает" }, { status: 503 });
    }
    return NextResponse.json(rules, { headers: { "Cache-Control": "max-age=3600" } });
}

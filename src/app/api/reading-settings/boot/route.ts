import { GET as getSettings } from "../route";
import { defaultValues, READING_SETTINGS } from "@/lib/settings/reading";

export const dynamic = "force-dynamic";

// Parser-blocking: account values arrive before first paint. Public pages keep
// their ISR cache and never contain another user's data.
export async function GET() {
    let values = null;
    let unauthorized = false;
    try {
        const response = await getSettings();
        unauthorized = response.status === 401;
        if (response.ok) values = (await response.json()).values || defaultValues();
    } catch { /* Network/server failure: retain the last account snapshot. */ }
    const data = JSON.stringify(values).replace(/</g, "\\u003c");
    const pairs = JSON.stringify(READING_SETTINGS.map(s => [s.id, s.cssVar, s.key, s.fallback]));
    const script = unauthorized
        ? `(function(){try{localStorage.removeItem('typikon-account-reading');localStorage.setItem('typikon-reading-source','browser');}catch(e){}var p=${pairs};for(var i=0;i<p.length;i++){var v=p[i][3];try{v=localStorage.getItem(p[i][2])||v;}catch(e){}document.documentElement.style.setProperty(p[i][1],v);}})();`
        : `(function(){var v=${data};if(!v)return;try{localStorage.setItem('typikon-account-reading',JSON.stringify(v));}catch(e){}var p=${pairs};for(var i=0;i<p.length;i++)document.documentElement.style.setProperty(p[i][1],v[p[i][0]]);})();`;
    return new Response(script, {
        headers: {
            "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            ...(unauthorized ? { "Set-Cookie": "session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } : {}),
        },
    });
}

import { clientIpFromHeaders, consume } from '@/lib/rateLimit';
import { INDEX_CONTRACT } from './store';
export const publicPilotEnabled = () => process.env.CS_READER_PUBLIC_PILOT === '1';
export async function readerAccess(request: Request, action: string, contract = INDEX_CONTRACT) {
    if (!publicPilotEnabled()) { const { authorize } = await import('@/lib/api/v2/access'); return authorize(request, 'texts'); }
    // The existing deployment has one trusted nginx hop and a non-public Node port.
    // Neither Origin/Referer, an API key nor a cookie increases this public pilot allowance.
    const ip = clientIpFromHeaders(request.headers);
    const aggregate = consume('reader-public-pilot-r1:all:' + ip, 120, 60);
    const subset = ['search', 'occurrences'].includes(action) ? consume('reader-public-pilot-r1:search:' + ip, 30, 60) : action === 'lookup' ? consume('reader-public-pilot-r1:lookup:' + ip, 30, 60) : null;
    const v = !aggregate.allowed ? aggregate : subset ?? aggregate;
    const headers: Record<string, string> = { 'X-RateLimit-Limit': String(v.limit), 'X-RateLimit-Remaining': String(v.remaining), 'X-RateLimit-Window': '60' };
    const denied = !aggregate.allowed || subset && !subset.allowed;
    if (denied) headers['Retry-After'] = String(v.retryAfter);
    return { kind: 'anonymous' as const, headers, denied: denied ? new Response(JSON.stringify({ contract, error: { code: 'rate_limited', message: 'Бюджет чтения пилота исчерпан.', retryable: true } }), { status: 429, headers }) : null };
}

import '@/scripts/lib/env';
import clientPromise from '@/lib/mongodb';
import { credentials, sendData } from '@/lib/push/fcm';
import { dispatchPriestQueue } from '@/lib/pomyannik/priestDispatch';
async function main() {
    const run = process.argv.includes('--run');
    let creds = null;
    try { creds = run ? credentials() : null; } catch { /* Allocation must not depend on FCM availability. */ }
    const result = await dispatchPriestQueue((await clientPromise).db('typikon-users'), new Date(),
        (token, data) => creds ? sendData(token, data, creds, { ttlSeconds: 300, signal: AbortSignal.timeout(15000) }) : Promise.resolve('failed'), !run);
    console.log(JSON.stringify({ mode: run ? 'run' : 'dry-run', sendingConfigured: !!creds, ...result }));
}
main().then(() => process.exit(0)).catch(() => {
    console.error('Не удалось обработать очередь иереев. Проверьте MongoDB и настройки FCM.');
    process.exit(1);
});

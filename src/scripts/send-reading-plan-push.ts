import '@/scripts/lib/env';
import clientPromise from '@/lib/mongodb';
import { credentials, sendData } from '@/lib/push/fcm';
import { dispatchPlanReminders } from '@/lib/readingPlan/dispatch';

async function main() {
    const send = process.argv.includes('--send');
    const creds = send ? credentials() : null;
    if (send && !creds) throw Error('Не настроены учётные данные FCM.');
    const db = (await clientPromise).db('typikon-users');
    const result = await dispatchPlanReminders(
        db, new Date(),
        async (token, data) => sendData(token, data, creds!, {
            ttlSeconds: 600,
            signal: AbortSignal.timeout(15000),
        }),
        !send,
    );
    console.log(JSON.stringify({ mode: send ? 'send' : 'dry-run', ...result }));
}

main().then(() => process.exit(0)).catch(() => {
    console.error('Не удалось выполнить отправку напоминаний плана. Проверьте MongoDB и настройки FCM.');
    process.exit(1);
});

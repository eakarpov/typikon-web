import '@/scripts/lib/env';
import { writeFileSync } from 'node:fs';
import { readerDb, publishPilot } from '@/lib/reader/registry';
import { PILOT } from '@/lib/reader/core';
async function main() {
    const args = process.argv.slice(2); const apply = args.includes('--apply'), activate = args.includes('--activate');
    if (activate && !apply) throw Error('--activate requires --apply');
    const uri = process.env.MONGODB_URI ?? ''; if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname)) throw Error('This command only changes local MongoDB; deployment is a separate operation.');
    const db = await readerDb(); const rollback = args.indexOf('--rollback'); let result: any;
    if (rollback >= 0) { const id = args[rollback + 1]; if (!apply) throw Error('Rollback requires --apply'); const state = await db.collection<any>('readerPilots').findOne({ _id: PILOT }); if (!state?.history?.includes(id)) throw Error('Only an activated historical release may be restored'); await db.collection<any>('readerPilots').updateOne({ _id: PILOT }, { $set: { activeRelease: id, activatedAt: new Date() } }); result = { rolledBackTo: id }; }
    else result = await publishPilot(db, { apply, activate, progress: message => process.stdout.write(message + '\n') });
    const text = JSON.stringify(result, null, 2); console.log(text); const index = args.indexOf('--report'); if (index >= 0) writeFileSync(args[index + 1], text + '\n');
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(async () => { const { default: client } = await import('@/lib/mongodb'); await (await client).close(); });

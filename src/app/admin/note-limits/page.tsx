import { requires } from '@/lib/admin';
import clientPromise from '@/lib/mongodb';
import { weeklyPolicy } from '@/lib/pomyannik/weeklyQuota';
import Form from './Form';
export const dynamic = 'force-dynamic';
export default requires('commemoration.claims', async function NoteLimits() {
    return <Form initial={await weeklyPolicy((await clientPromise).db('typikon-users'))} />;
});

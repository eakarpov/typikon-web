import 'server-only'
import {cache} from 'react';
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/authorize/sessions';

export const verifySession = cache(async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (session) {
        return { isAuth: true, userId: session.userId };
    }

    return { isAuth: false };
});

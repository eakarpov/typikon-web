import 'server-only'
import {cache} from 'react';
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/authorize/sessions';

export const verifySession = cache(async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (session) {
        return { isAuth: true, userId: session.userId, expiresAt: session.expiresAt  };
    }

    // maybe here go to db, get vk refresh token and try to update the access one

    return { isAuth: false };
});

import {NextApiRequest, NextApiResponse} from "next";
import { publishedVersion } from "@/lib/appVersion";

// Проверка версий первой версии API. Закрывать её вместе с остальным v1 нельзя:
// установленные до перехода копии узнают о новой версии только отсюда, и пока
// они живы, ручка живёт с ними.
//
// Число больше не зашито. Прежде здесь стояло `{major: 2, minor: 0}` — и верным
// оно было ровно до тех пор, пока о нём помнили; теперь обе ручки, первая и
// вторая, спрашивают у одного и того же выложенного файла и разойтись не могут.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const { major, minor } = publishedVersion();
        res.status(200).json({ major, minor });
    }
}

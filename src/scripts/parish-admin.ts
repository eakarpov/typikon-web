// окружение — первым, раньше mongodb: он читает MONGODB_URI при загрузке
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// КТО ВЕДЁТ ХРАМ — первым его назначают отсюда.
//
// Приход растит себя сам: кто уже ведёт, тот и зовёт следующего. Но первого
// позвать некому, и оставлять это на «кто раньше нажал» нельзя — расписание
// висит на стенде. Оттого первый заводится руками, с сервера.
//
//   npm run parish:admin -- --temple <slug> --user <userId>
//   npm run parish:admin -- --temple <slug> --email иван@example.com
//   npm run parish:admin -- --temple <slug> --list
//   npm run parish:admin -- --temple <slug> --user <userId> --remove

const args = process.argv.slice(2);
const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);

const main = async () => {
    const templeSlug = arg("temple");
    if (!templeSlug) {
        console.error("нужен --temple <slug>");
        process.exit(1);
    }
    const client = await clientPromise;
    const db = client.db("typikon");
    const users = client.db("typikon-users");

    const temple = await db.collection("temples").findOne({ slug: templeSlug });
    if (!temple) {
        console.error(`храма ${templeSlug} нет — проверьте slug на /temples`);
        process.exit(1);
    }
    // Права — в typikon-users, а не в typikon: см. src/lib/parish/db.ts.
    const admins = users.collection("templeAdmins");

    if (flag("list") || (!arg("user") && !arg("email"))) {
        const rows = await admins.find({ templeSlug }).sort({ addedAt: 1 }).toArray();
        console.log(`${temple.name}`);
        if (!rows.length) {
            console.log("  ведущих нет — расписание правит только администратор сайта");
        }
        for (const r of rows) {
            const u = await users.collection("users")
                .findOne({ _id: new ObjectId(r.userId as string) }).catch(() => null);
            console.log(`  ${r.userId}  ${u?.email ?? u?.name ?? "(нет в базе)"}`
                + `  ${r.addedBy ? "позван " + r.addedBy : "заведён руками"}`);
        }
        return;
    }

    let userId = arg("user");
    const email = arg("email");
    if (!userId && email) {
        const u = await users.collection("users").findOne({ email });
        if (!u) {
            console.error(`пользователя с почтой ${email} нет — пусть сперва войдёт на сайт`);
            process.exit(1);
        }
        userId = String(u._id);
    }
    if (!userId) {
        console.error("нужен --user <userId> или --email");
        process.exit(1);
    }

    const _id = `${templeSlug}:${userId}`;
    if (flag("remove")) {
        // ПОСЛЕДНЕГО НЕ СНИМАЕМ и отсюда: храм без ведущего никто уже не
        // поправит, а вернуть право сможет лишь тот, кто про этот храм ничего
        // не знает
        if (await admins.countDocuments({ templeSlug }) <= 1) {
            console.error("это последний ведущий храма — сперва назначьте преемника");
            process.exit(1);
        }
        await admins.deleteOne({ _id } as never);
        console.log(`снят: ${userId}`);
        return;
    }

    await admins.replaceOne({ _id } as never,
        { _id, templeSlug, userId, addedBy: null, addedAt: new Date() } as never,
        { upsert: true });
    console.log(`${temple.name}: ведёт ${userId}`);
};

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

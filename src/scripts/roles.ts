// окружение — первым, раньше mongodb
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { CAPABILITIES, ROLES, capsOf } from "@/lib/rights";

// КОМУ ЧТО МОЖНО.
//
// Раздаётся с сервера, а не из админки, и пока нарочно: право раздавать права
// — само право, и заводить его экраном прежде, чем оно кому-то понадобилось,
// значит открыть дверь раньше, чем есть кому в неё войти.
//
//   npm run roles                                  — кто что может
//   npm run roles -- --email кто@то --add admin
//   npm run roles -- --email кто@то --remove parish-moderator
//   npm run roles -- --migrate                     — перевести прежних админов

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n: string) => args.includes(`--${n}`);

const main = async () => {
    const users = (await clientPromise).db("typikon-users").collection("users");

    if (flag("migrate")) {
        // ПРЕЖНИЙ МАРКЕР ЧИТАЕТСЯ И БЕЗ ЭТОГО (rights.capsOf), так что спешки
        // нет; но пока он жив, о правах человека сказано в двух местах, и
        // однажды они разойдутся
        const legacy = await users.find({ isAdmin: true }).toArray();
        for (const u of legacy) {
            const roles = Array.from(new Set([...(u.roles ?? []), "admin"]));
            await users.updateOne({ _id: u._id }, { $set: { roles }, $unset: { isAdmin: "" } });
            console.log(`  ${u.email ?? u._id}: ${roles.join(", ")}`);
        }
        console.log(`переведено: ${legacy.length}`);
        return;
    }

    const email = arg("email");
    const add = arg("add");
    const remove = arg("remove");

    if (!email) {
        console.log("Возможности:");
        for (const [k, v] of Object.entries(CAPABILITIES)) console.log(`  ${k.padEnd(16)} ${v}`);
        console.log("\nРоли:");
        for (const r of Object.values(ROLES)) {
            console.log(`  ${r.key.padEnd(18)} ${r.label} — ${r.caps === "*" ? "всё" : r.caps.join(", ")}`);
        }
        console.log("\nКому что дано:");
        const granted = await users.find({
            $or: [{ roles: { $exists: true, $ne: [] } }, { isAdmin: true }],
        }).toArray();
        if (!granted.length) console.log("  никому");
        for (const u of granted) {
            const caps = [...capsOf(u as never)].join(", ") || "—";
            console.log(`  ${String(u.email ?? u._id).padEnd(30)} `
                + `${(u.roles ?? []).join(", ") || (u.isAdmin ? "isAdmin (прежний маркер)" : "")}`
                + `  →  ${caps}`);
        }
        return;
    }

    const user = await users.findOne({ email });
    if (!user) {
        console.error(`пользователя с почтой ${email} нет — пусть сперва войдёт на сайт`);
        process.exit(1);
    }
    const role = add ?? remove;
    if (!role) { console.error("нужен --add <роль> или --remove <роль>"); process.exit(1); }
    if (!ROLES[role]) {
        console.error(`роли ${role} нет; есть: ${Object.keys(ROLES).join(", ")}`);
        process.exit(1);
    }

    const roles = new Set<string>(user.roles ?? []);
    if (user.isAdmin) roles.add("admin");
    if (add) roles.add(role); else roles.delete(role);

    // ПОСЛЕДНЕГО АДМИНИСТРАТОРА НЕ СНИМАЕМ: сайт без него некому будет открыть
    if (remove === "admin") {
        const others = await users.countDocuments({
            _id: { $ne: new ObjectId(String(user._id)) },
            $or: [{ roles: "admin" }, { isAdmin: true }],
        });
        if (!others) { console.error("это последний администратор — сперва назначьте другого"); process.exit(1); }
    }

    await users.updateOne({ _id: user._id },
        { $set: { roles: [...roles] }, $unset: { isAdmin: "" } });
    console.log(`${email}: ${[...roles].join(", ") || "прав нет"}`);
};

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

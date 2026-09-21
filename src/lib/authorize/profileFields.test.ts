import {test} from "node:test";
import assert from "node:assert/strict";
import {sanitizeProfilePatch} from "./profileFields";

test("разрешённые поля проходят, обрезанные по краям", () => {
    assert.deepEqual(
        sanitizeProfilePatch({ name: " Иоанн ", surname: "Дамаскин", email: "a@b.ru", phone: "+7 900" }),
        { name: "Иоанн", surname: "Дамаскин", email: "a@b.ru", phone: "+7 900" },
    );
});

test("роли, признак администратора и привязки входа отбрасываются", () => {
    assert.deepEqual(
        sanitizeProfilePatch({
            name: "x", roles: ["admin"], isAdmin: true,
            "auth.google.userId": "1", auth: { vk: { userId: "1" } }, $set: {},
        }),
        { name: "x" },
    );
});

test("не строка, сверх длины, кривая почта — отказ целиком", () => {
    assert.equal(sanitizeProfilePatch({ name: { $ne: "" } }), null);
    assert.equal(sanitizeProfilePatch({ name: "я".repeat(101) }), null);
    assert.equal(sanitizeProfilePatch({ email: "не почта" }), null);
    assert.equal(sanitizeProfilePatch(null), null);
    assert.equal(sanitizeProfilePatch([]), null);
});

test("пустая почта допустима: её можно стереть", () => {
    assert.deepEqual(sanitizeProfilePatch({ email: "" }), { email: "" });
});

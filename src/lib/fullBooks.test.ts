import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fullBookQuery, FULL_BOOK_ALIASES } from "./fullBooks";
test("book request preserves source navigation and excludes routing controls", () => {
 assert.equal(fullBookQuery({section:"tone-1",anchor:"b-example",script:["Geok","Geor"],q:"Глас & песнь",view:"records",asset:"secret",_rsc:"client"}), "section=tone-1&anchor=b-example&q=%D0%93%D0%BB%D0%B0%D1%81+%26+%D0%BF%D0%B5%D1%81%D0%BD%D1%8C&script=Geok");
 assert.equal(FULL_BOOK_ALIASES.has("chasoslov-azbyka"),false);
 assert.equal(FULL_BOOK_ALIASES.size,18);
 assert.equal(FULL_BOOK_ALIASES.has("octoechos-fr"),true);
 assert.equal(FULL_BOOK_ALIASES.has("chasoslov-fr"),true);
 for(const alias of ["pentecostarion-cs","pentecostarion-ro","lenten-triodion-cs","lenten-triodion-ro"])assert.equal(FULL_BOOK_ALIASES.has(alias),true);
 assert.equal(FULL_BOOK_ALIASES.has("chasoslov-grc"),true);
 assert.equal(FULL_BOOK_ALIASES.has("octoechos-cs-oldrite"),true);
 assert.equal(FULL_BOOK_ALIASES.has("octoechos-grc"),true);
});

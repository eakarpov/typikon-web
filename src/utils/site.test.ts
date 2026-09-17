import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLegacyHost, LEGACY_HOST, SITE_HOST, SITE_HOST_FULL, SITE_URL_NAKED } from "@/utils/site";

describe("адрес сайта", () => {
    it("выводит формы из одного адреса", () => {
        assert.equal(SITE_HOST_FULL, "www.typikon.info");
        assert.equal(SITE_HOST, "typikon.info");
        assert.equal(SITE_URL_NAKED, "https://typikon.info");
    });

    it("переехали не на тот же домен, с которого уезжаем", () => {
        // Проверка от описки при переезде: если SITE_URL останется прежним,
        // «старым» окажется живой адрес и полоса о переезде повиснет на всех.
        assert.notEqual(SITE_HOST, LEGACY_HOST);
    });
});

describe("старый адрес", () => {
    it("узнаётся в том виде, в каком приходит заголовок", () => {
        for (const host of [
            "typikon.su",
            "www.typikon.su",
            "WWW.TYPIKON.SU",
            "typikon.su:443",
            "www.typikon.su:8080",
        ]) {
            assert.equal(isLegacyHost(host), true, `должен считаться старым: ${host}`);
        }
    });

    it("не путается с новым адресом и с чужими, похожими на наш", () => {
        for (const host of [
            "www.typikon.info",
            "typikon.info",
            // Чужой домен, оканчивающийся на наше имя без точки: typikon.su
            // здесь не поддомен, а хвост чужого имени.
            "nottypikon.su",
            // И чужой, где наше имя стоит в начале.
            "typikon.su.example.com",
            "example.com",
        ]) {
            assert.equal(isLegacyHost(host), false, `не должен считаться старым: ${host}`);
        }
    });

    it("на пустом заголовке молчит, а не падает", () => {
        assert.equal(isLegacyHost(null), false);
        assert.equal(isLegacyHost(undefined), false);
        assert.equal(isLegacyHost(""), false);
    });
});

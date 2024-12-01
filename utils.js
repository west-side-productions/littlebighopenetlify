"use strict";

const $lbh = {
    memberStackAvailable: !(typeof $memberstackDom === "undefined"),
    language: () => {
        const defaultLang = "de";
        const langs = ["de", "en", "fr", "it"];
        const lange = /^(\w+)/.exec(navigator.language);
        if (!lange) return defaultLang;
        const i = langs.indexOf(lange[1].toLowerCase());
        return i >= 0 ? langs[i] : defaultLang;
    },
    loadJson: async function loadJson() {
        if (!$lbh.memberStackAvailable) {
            return JSON.parse(localStorage.getItem("json") ?? "{}");
        }
        let json = await $memberstackDom.getMemberJSON();
        console.log("json", json);
        return json?.data ?? {};
    },
    updateJson: async function updateJson(json) {
        if (!$lbh.memberStackAvailable) {
            localStorage.setItem("json", JSON.stringify(json));
            return;
        }
        const up = { json: json };
        console.log("json", up);
        await $memberstackDom.updateMemberJSON(up);
    },
    tryfind: function tryfind(selector, parent) {
        return (parent ?? document).querySelector(selector);
    },
    find: function find(selector, parent) {
        const res = $lbh.tryfind(selector, parent);
        if (!res) {
            throw new Error(`Can't find element by selector '${selector}' in ${parent ?? document}`);
        }
        return res;
    },
    formatQuantity: function formatQuantity(q) {
        if (!q) return "";
        let nr = Math.floor(q);
        let fract = q - nr;
        switch (fract) {
            case 0: fract = ""; break;
            case 0.25: fract = "¼"; break;
            case 0.5: fract = "½"; break;
        }
        return nr > 0 ? `${nr}${fract}` : fract;
    }
};

if (!$lbh.memberStackAvailable) {
    console.warn("NO MEMBERSTACK AVAILABLE, using localStorage");
}

// Language redirect
if (location.pathname == "/") {
    const lang = $lbh.language();
    if (lang != "de") {
        const target = `${location.origin}/${lang}/`;
        console.log("lang-switch", target);
        location.href = target;
    }
}

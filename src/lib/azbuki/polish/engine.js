/* eslint-disable */
/* СГЕНЕРИРОВАНО polish/db/export_typikon.py из проекта azbuki (polish 0.1.0).
   Не править здесь: правка живёт в azbuki, иначе сайт покажет не то, что там
   проверено. Пересобрать: python3 polish/db/export_typikon.py

   Файл polish/web/js/translit.js перенесён дословно. Он написан как
   классический скрипт и сам решает, куда себя вешать, поэтому заворачивается
   в замыкание с локальными window и globalThis — так он работает без правок
   и без глобалей. */

/**
 * Собрать переводчик. Словник (yes, no, prefix, loans, gram) забирается
 * страницей по требованию и передаётся сюда.
 * @param {Record<string, unknown>} data
 */
export function createTranslit(data) {
  const shim = {};
  const window = shim, globalThis = shim;
  void window; void globalThis;

  // ─── polish/web/js/translit.js ────────────────────────────────────
// Перевод польской латиницы в азбуку. Механично всё, кроме ятя: где стоит ѣ,
// говорит словник (data/yat.js), собранный analysis/yat.py.
(function (global) {
  // Движок собирается фабрикой, а не читает глобаль: так этот файл уходит в
  // typikon-web дословно, а данные ему передаёт страница сайта.
  function createTranslit(D) {
  D = D || {yes: [], no: [], prefix: [], loans: [], gram: []};
  const VOW = "aeiouóąęy";
  const SOFT_V = {a: "я", e: "є", o: "ьо", "ó": "ьѡ", "ą": "ѭ", "ę": "ѩ", u: "ю", i: "и", y: "ы"};
  const HARD_V = {a: "а", e: "е", o: "о", "ó": "ѡ", "ą": "ѫ", "ę": "ѧ", u: "у", y: "ы", i: "и"};
  const JOT_V  = {a: "я", e: "є", o: "йо", "ó": "йѡ", "ą": "ѭ", "ę": "ѩ", u: "ю", i: "и", y: "ы"};
  const CONS = [["szcz","щ"],["sz","ш"],["cz","ч"],["rz","р̌"],["ch","х"],["dż","џ"],["dź","ѕь"],
    ["dz","ѕ"],["ś","сь"],["ć","ць"],["ź","зь"],["ń","нь"],["ż","ж"],["ł","л"],["l","ль"],
    ["b","б"],["c","ц"],["d","д"],["f","ф"],["g","г"],["h","г̌"],["k","к"],["m","м"],["n","н"],
    ["p","п"],["r","р"],["s","с"],["t","т"],["w","в"],["z","з"],["j","й"]];
  const SOFT_C = ["ś","ć","ź","ń","dź","l"];
  const GRAM = new Set(D.gram || []);   // местный и дательный: окончание из *-ě

  // --- ять ------------------------------------------------------------------
  const NO_I = ["dż","rz","ż","sz","cz","dz","l","ł","c","j"];
  function candidates(w) {
    const out = [];
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if (ch === "i" && i + 1 < w.length && "ae".includes(w[i + 1])) {
        const p = i ? w[i - 1] : "";
        if (p && !VOW.includes(p)) out.push([i, 2]);
      } else if ("ae".includes(ch) && i &&
                 (NO_I.includes(w.slice(Math.max(0, i - 2), i)) || ["l","ł","c","j"].includes(w[i - 1]))) {
        out.push([i, 1]);
      }
    }
    return out;
  }
  function stripPrefixes(s) {
    let out = [s], frontier = [s];
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const cur of frontier)
        for (const p of D.prefix)
          if (cur.startsWith(p) && cur.length - p.length >= 3 && cur.slice(p.length).includes("@"))
            next.push(cur.slice(p.length));
      out = out.concat(next); frontier = next;
    }
    return out;
  }
  function match(word, variant, pat) {
    if (pat[0] === "=") return word === pat.slice(1);
    if (pat[0] === "~") return variant === pat.slice(1);
    if (pat[0] === "-") return variant.endsWith(pat.slice(1));
    return variant.startsWith(pat);
  }
  function yatDecide(w) {
    const res = {};
    for (const [i, ln] of candidates(w)) {
      const n = w.slice(0, i) + "@" + w.slice(i + ln);
      let best = 0, verdict;
      for (const variant of stripPrefixes(n))
        for (const [pats, v] of [[D.yes, true], [D.no, false]])
          for (const p of pats)
            if (p.length > best && match(w, variant, p)) { best = p.length; verdict = v; }
      if (verdict !== undefined) res[i] = verdict;
    }
    return res;
  }

  // --- запись ---------------------------------------------------------------
  const isLoan = w => D.loans.some(p => w.startsWith(p));
  const softNext = rest => /^(ś|ć|ź|ń|dź|l)/.test(rest) || /^(dz|[cszntdpbwmfkgr])i/.test(rest);

  function word(orig) {
    const w = orig.toLowerCase();
    const yat = yatDecide(w), loan = isLoan(w), cand = {};
    const cs = candidates(w);
    for (const [i] of cs) cand[i] = true;
    if (GRAM.has(w) && cs.length) {                     // местный и дательный
      const last = cs[cs.length - 1][0];
      if (yat[last] === undefined) yat[last] = true;    // явное решение словника сильнее
    }
    let out = "", i = 0, soft = false, open = false;
    while (i < w.length) {
      const ch = w[i];
      if (VOW.includes(ch)) {
        const wasSoft = soft; soft = false;
        if (ch === "i" && !wasSoft && i + 1 < w.length && "aeoóąęu".includes(w[i + 1])) {
          if (loan) { out += "и"; i++; continue; }         // радио, клиент
          const v = w[i + 1];
          if (yat[i] === true) out += "ѣ";
          else { out += SOFT_V[v]; if (cand[i] && yat[i] === undefined) open = true; }
          i += 2; continue;
        }
        if (yat[i] === true) out += "ѣ";
        else {
          out += (wasSoft ? SOFT_V : HARD_V)[ch];
          if (cand[i] && yat[i] === undefined) open = true;
        }
        i++; continue;
      }
      let hit = null;
      for (const [lat, cyr] of CONS) if (w.startsWith(lat, i)) { hit = [lat, cyr]; break; }
      if (!hit) { out += ch; i++; soft = false; continue; }
      const [lat, cyr] = hit, rest = w.slice(i + lat.length);
      if (lat === "l") {
        out += "л";
        if (rest && VOW.includes(rest[0])) soft = true; else out += "ь";
      } else if (SOFT_C.includes(lat)) {
        out += cyr.slice(0, -1);
        if (!softNext(rest)) out += "ь";
      } else if (lat === "j") {
        const prev = i ? w[i - 1] : "";
        const atVowel = rest && "aeoóąęuy".includes(rest[0]);
        if (!atVowel) out += "й";
        else if (!prev || VOW.includes(prev)) {          // ja, moje, jod
          if (yat[i + 1] === true) out += "ѣ"; else {
            out += JOT_V[rest[0]];
            if (cand[i + 1] && yat[i + 1] === undefined) open = true;
          }
          i += 2; continue;
        } else out += "й";                                // zjeść → зйѣсць
      } else out += cyr;
      i += lat.length;
    }
    const up = orig[0] && orig[0] !== orig[0].toLowerCase();
    return {text: up ? out[0].toUpperCase() + out.slice(1) : out, open: open};
  }

  function translit(text) {
    const parts = [];
    for (const piece of text.split(/([^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]+)/)) {
      if (!piece) continue;
      if (/[a-ząćęłńóśźż]/i.test(piece)) parts.push(Object.assign(word(piece), {src: piece}));
      else parts.push({text: piece, open: false, src: piece});
    }
    return parts;
  }

  return {translit, word, yatDecide, candidates};
  }

  global.PL_FACTORY = createTranslit;
  if (global.YAT) global.PL = createTranslit(global.YAT);
})(typeof window !== "undefined" ? window : globalThis);

  return shim.PL_FACTORY(data);
}

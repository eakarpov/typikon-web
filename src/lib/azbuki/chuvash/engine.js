/* eslint-disable */
/* СГЕНЕРИРОВАНО chuvash/db/export_typikon.py из проекта azbuki (chuvash 0.1.0).
   Не править здесь: правка живёт в azbuki, иначе сайт покажет не то, что там
   проверено. Пересобрать: python3 chuvash/db/export_typikon.py

   Файл chuvash/web/js/translit.js перенесён дословно. Он написан как
   классический скрипт и сам решает, куда себя вешать, поэтому заворачивается
   в замыкание с локальными window и globalThis. */

/**
 * Собрать переводчик. Словники (spellings, names, greek, titla) забираются
 * страницей по требованию и передаются сюда.
 * @param {Record<string, unknown>} data
 */
export function createTranslit(data) {
  const shim = {};
  const window = shim, globalThis = shim;
  void window; void globalThis;

  // ─── chuvash/web/js/translit.js ────────────────────────────────────
// Перевод чувашского письма в церковную азбуку. Правила те же, что в
// analysis/translit.py, и порядок тот же: карта написаний, потом правило І,
// потом оглушение, потом запись букв, потом надстрочные.
(function (global) {
  function createTranslit(D) {
    D = D || {spellings: {}, names: [], greek: {}};
    const NAMES = new Set(D.names || []);
    const SPELL = D.spellings || {};
    const TITLA = D.titla || {};

    const VOWELS = "аеёиоуыэюяӑӗӳ";
    const REDUCED = "ӑӗ";
    const PSILI = "҆", OXIA = "́", VARIA = "̀";
    const SOFT = "̑";        // камора: мягкость согласной
    const NOVOICE = "̣";     // точка снизу: здесь не озвончать
    const PAEROK = "꙽";      // паерок: здесь стоял ер, согласная звонкая
    const VOICED = {"б": "п", "г": "к", "д": "т", "з": "с", "ж": "ш"};
    const IOTATED = {"а": "ꙗ", "е": "ѥ", "у": "ю", "о": "ѡ"};
    const PLAIN = {
      "а": "а", "и": "и", "ы": "ы", "о": "о", "у": "ꙋ", "ӑ": "ъ", "ӗ": "ь", "ӳ": "ѵ",
      "і": "і", "э": "е", "е": "е", "ё": "ꙇѡ", "ю": "ю", "я": "ꙗ",
      "в": "в", "й": "й", "к": "к", "л": "л", "м": "м", "н": "н", "п": "п", "р": "р",
      "с": "с", "ҫ": "щ", "т": "т", "х": "х", "ч": "ч", "ш": "ш",
    };
    const FOREIGN = new Set("бгджзфцщъь");
    // Старая веб-раскладка: чувашские буквы набраны латинскими двойниками.
    // Такие тексты ходят по сети десятками лет, и принимать их надо молча.
    const LEGACY = {"ă": "ӑ", "Ă": "Ӑ", "ĕ": "ӗ", "Ĕ": "Ӗ", "ç": "ҫ", "Ç": "Ҫ",
                    "ÿ": "ӳ", "Ÿ": "Ӳ", "ý": "ӳ", "š": "ҫ", "Š": "Ҫ"};
    const normalize = (t) => [...t].map((c) => LEGACY[c] || c).join("");

    // Переключатели: их же показывает страница.
    //   devoice: off | loans | all   — кого оглушать
    //   final:   paerok | jer | off  — чем держать конечную звонкую
    const opt = {devoice: "loans", final: "paerok", titla: true};

    const isVowel = (c) => VOWELS.includes(c);
    /** Слово написано с заглавной? */
    const capital = (s) => s[0] && s[0] !== s[0].toLowerCase();

    function stressPos(w) {
      const vs = [];
      for (let i = 0; i < w.length; i++) if (isVowel(w[i])) vs.push(i);
      if (!vs.length) return null;
      const full = vs.filter((i) => !REDUCED.includes(w[i]));
      return full.length ? full[full.length - 1] : vs[0];
    }

    const SUF = ["сенчен", "семпе", "сене", "сен", "ран", "рен", "тан", "тен", "на", "не",
                 "ра", "ре", "пе", "па", "ӑн", "ӗн", "сем", "ӑ", "ӗ", "а", "е", "и"];

    function stem(w) {
      for (const s of SUF) if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length);
      return w;
    }

    /** Имя узнаётся по словарю основ или по заглавной — но не в начале
        предложения: там с прописной пишется любое слово. */
    const isName = (src, sentenceStart) =>
      NAMES.has(stem(src.toLowerCase())) || (!sentenceStart && capital(src));

    /** Иисус → Іисус: правило, а не словарь. */
    const greekI = (w) =>
      (w.length > 1 && w[0] === "и" && isVowel(w[1])) ? "і" + w.slice(1) : w;

    function devoice(w, name) {
      if (opt.devoice === "off" || (opt.devoice === "loans" && name)) return w;
      let out = "";
      for (const c of w) out += VOICED[c] || c;
      if ("бгдзж".includes(w[w.length - 1])) {
        if (opt.final === "jer") out += "ӑ";              // буквой: лишний слог
        else if (opt.final === "paerok") out += PAEROK;   // знаком: слога нет
      }
      return out;
    }

    function word(src, sentenceStart) {
      const low = src.toLowerCase();
      // Титло ставится только там, где заглавная: Аттемӗр — обращение к Богу,
      // аттемӗр — земной отец. Различие несёт сам перевод, движку остаётся его
      // прочесть.
      if (opt.titla && TITLA[low] && capital(src)) {
        const t = TITLA[low];                 // строка ровная: заглавная только в начале
        return {text: sentenceStart ? t : t[0].toLowerCase() + t.slice(1),
                foreign: [], name: true, titlo: true};
      }
      const name = isName(src, sentenceStart);
      const w = SPELL[low] || devoice(greekI(low), name);
      const vs = [];
      for (let k = 0; k < w.length; k++) if (isVowel(w[k])) vs.push(k);
      const acc = stressPos(w), last = vs.length ? vs[vs.length - 1] : null;
      let out = "", i = 0;
      const foreign = [];
      while (i < w.length) {
        const ch = w[i];
        if (ch === "ь" && i && !isVowel(w[i - 1])) { out += SOFT; i++; continue; }
        if (FOREIGN.has(ch)) { foreign.push(ch); out += ch; i++; continue; }
        if (!(ch in PLAIN)) { out += ch; i++; continue; }   // паерок, точка, знаки
        let piece = PLAIN[ch], iot = false;
        if (isVowel(ch)) {
          const prev = i ? w[i - 1] : "";
          if (prev === "й" && (i === 1 || (i >= 2 && isVowel(w[i - 2])))) {
            out = out.slice(0, -1);                        // снять записанное й
            piece = IOTATED[ch] || ("ꙇ" + piece);
            iot = true;
          } else if (ch === "я" || ch === "ю" ||
                     (ch === "е" && !name && (i === 0 || isVowel(prev)))) {
            piece = ch === "я" ? "ꙗ" : ch === "ю" ? "ю" : "ѥ";
            iot = true;
          }
          if (ch === "у" && i === 0) piece = "оу";         // начальное у по-славянски
          if (i === 0) piece += PSILI;                    // звательце, и над ꙗ ѥ ю тоже
          if (i === acc) piece += (i === last ? VARIA : OXIA);
        }
        out += piece;
        i++;
      }
      // При титлах строка ровная, как в славянской книге: заглавная стоит
      // только в начале предложения. Имена прописной не выделяются, священное
      // выделено титлом.
      let up = capital(src);
      if (up && opt.titla && !sentenceStart) up = false;
      return {text: up ? out[0].toUpperCase() + out.slice(1) : out, foreign, name};
    }

    function translit(text) {
      const pieces = normalize(text).split(/([^а-яёӑӗҫӳА-ЯЁӐӖҪӲ]+)/).filter(Boolean);
      const parts = [];
      let sentenceStart = true;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (!/[а-яёӑӗҫӳ]/i.test(piece)) {
          parts.push({text: piece, foreign: [], name: false, src: piece});
          if (/[.!?…]/.test(piece)) sentenceStart = true;
          continue;
        }
        // составное имя: слово, пробел, слово — иначе титло досталось бы первому
        if (opt.titla && i + 2 < pieces.length && pieces[i + 1].trim() === "" && capital(piece)) {
          const key = (piece + " " + pieces[i + 2]).toLowerCase();
          if (TITLA[key]) {
            const t = TITLA[key];
            parts.push({text: sentenceStart ? t : t[0].toLowerCase() + t.slice(1),
                        foreign: [], name: true, titlo: true, src: piece + " " + pieces[i + 2]});
            i += 2;
            sentenceStart = false;
            continue;
          }
        }
        parts.push(Object.assign(word(piece, sentenceStart), {src: piece}));
        sentenceStart = false;
      }
      return parts;
    }

    return {translit, word, opt, isName, stem};
  }

  global.CV_FACTORY = createTranslit;
  if (global.CV) global.CVT = createTranslit(global.CV);
})(typeof window !== "undefined" ? window : globalThis);

  return shim.CV_FACTORY(data);
}

/* eslint-disable */
/* СГЕНЕРИРОВАНО db/export_typikon.py из проекта chinese-latin (chinese 1.0.0).
   Не править здесь: правка живёт в chinese-latin, иначе сайт покажет не то,
   что там проверено. Пересобрать: python3 db/export_typikon.py

   Файлы ядра перенесены дословно. Они написаны как классические скрипты,
   вешающие всё на глобальный CL, поэтому заворачиваются в замыкание с локальным
   CL и локальным window — так они работают без правок и без глобалей.

   eslint отключён на весь файл: React здесь нет, а правило react/display-name
   принимает за компонент любой метод с заглавной буквы (Position.prototype.判斷).
   Чинить это правкой было бы нельзя — файл обязан совпадать с источником. */

/**
 * Собрать движок. Данные (syllables, chars, …) забираются по требованию
 * и передаются сюда; без них работает только разбор написания.
 * @param {Record<string, unknown>} data
 */
export function createEngine(data) {
  const CL = { core: {} };
  const window = CL.window = { CL };
  void window;

  // ─── web/js/core/mc-position.js ────────────────────────────────────────
/* Класс 音韻地位 — фонологическая позиция среднекитайского слога.

   Это порт того минимума из tshet-uinh-js, который нужен, чтобы запускать
   оригинальные скрипты вывода (putonghua.js, gwongzau.js) без единой правки.
   Таблицы производных свойств и семантика языка запросов взяты из исходников
   библиотеки, а не восстановлены по памяти. */
window.CL = window.CL || {};
CL.core = CL.core || {};

(function (core) {
  'use strict';

  var 母到清濁 = {
    幫: '全清', 端: '全清', 知: '全清', 精: '全清', 心: '全清', 莊: '全清',
    生: '全清', 章: '全清', 書: '全清', 見: '全清', 影: '全清', 曉: '全清',
    滂: '次清', 透: '次清', 徹: '次清', 清: '次清', 初: '次清', 昌: '次清', 溪: '次清',
    並: '全濁', 定: '全濁', 澄: '全濁', 從: '全濁', 邪: '全濁', 崇: '全濁',
    俟: '全濁', 常: '全濁', 船: '全濁', 羣: '全濁', 匣: '全濁',
    明: '次濁', 泥: '次濁', 孃: '次濁', 來: '次濁', 日: '次濁',
    疑: '次濁', 云: '次濁', 以: '次濁'
  };

  var 母到組 = {
    幫: '幫', 滂: '幫', 並: '幫', 明: '幫',
    端: '端', 透: '端', 定: '端', 泥: '端',
    知: '知', 徹: '知', 澄: '知', 孃: '知',
    精: '精', 清: '精', 從: '精', 心: '精', 邪: '精',
    莊: '莊', 初: '莊', 崇: '莊', 生: '莊', 俟: '莊',
    章: '章', 昌: '章', 船: '章', 書: '章', 常: '章',
    見: '見', 溪: '見', 羣: '見', 疑: '見',
    影: '影', 曉: '影', 匣: '影', 云: '影',
    來: null, 日: null, 以: null
  };

  var 母到音 = {
    幫: '脣', 滂: '脣', 並: '脣', 明: '脣',
    端: '舌', 透: '舌', 定: '舌', 泥: '舌',
    知: '舌', 徹: '舌', 澄: '舌', 孃: '舌', 來: '舌',
    精: '齒', 清: '齒', 從: '齒', 心: '齒', 邪: '齒',
    莊: '齒', 初: '齒', 崇: '齒', 生: '齒', 俟: '齒',
    章: '齒', 昌: '齒', 常: '齒', 書: '齒', 船: '齒', 日: '齒',
    見: '牙', 溪: '牙', 羣: '牙', 疑: '牙',
    影: '喉', 曉: '喉', 匣: '喉', 云: '喉', 以: '喉'
  };

  var 韻到攝 = {
    東: '通', 冬: '通', 鍾: '通',
    江: '江',
    支: '止', 脂: '止', 之: '止', 微: '止',
    魚: '遇', 虞: '遇', 模: '遇',
    齊: '蟹', 佳: '蟹', 皆: '蟹', 灰: '蟹', 咍: '蟹', 祭: '蟹', 泰: '蟹', 夬: '蟹', 廢: '蟹',
    真: '臻', 諄: '臻', 臻: '臻', 文: '臻', 殷: '臻', 魂: '臻', 痕: '臻',
    元: '山', 寒: '山', 桓: '山', 刪: '山', 山: '山', 先: '山', 仙: '山',
    蕭: '效', 宵: '效', 肴: '效', 豪: '效',
    歌: '果', 戈: '果',
    麻: '假',
    唐: '宕', 陽: '宕',
    庚: '梗', 耕: '梗', 清: '梗', 青: '梗',
    登: '曾', 蒸: '曾',
    侯: '流', 尤: '流', 幽: '流',
    侵: '深',
    覃: '咸', 談: '咸', 鹽: '咸', 添: '咸', 咸: '咸', 銜: '咸', 嚴: '咸', 凡: '咸'
  };

  var 鈍音母 = '幫滂並明見溪羣疑影曉匣云';
  var 陰聲韻 = '支脂之微魚虞模齊祭泰佳皆夬灰咍廢蕭宵肴豪歌麻侯尤幽';

  function Position(母, 呼, 等, 類, 韻, 聲) {
    this.母 = 母;
    this.呼 = 呼 || null;
    this.等 = 等;
    this.類 = 類 || null;
    this.韻 = 韻;
    this.聲 = 聲;
    this.清濁 = 母到清濁[母];
    this.組 = 母到組[母];
    this.音 = 母到音[母];
    this.攝 = 韻到攝[韻];
    this.韻別 = 陰聲韻.indexOf(韻) >= 0 ? '陰' : (聲 === '入' ? '入' : '陽');
  }

  /** Один терминальный признак выражения. */
  Position.prototype._evalToken = function (token) {
    var m;
    if ((m = /^(陰|陽|入)聲韻$/.exec(token))) return this.韻別 === m[1];
    if (token === '仄聲') return this.聲 !== '平';
    if (token === '舒聲') return this.聲 !== '入';
    if ((m = /^(開|合)口$/.exec(token))) return this.呼 === m[1];
    if (token === '開合中立') return this.呼 === null;
    if (token === '不分類') return this.類 === null;
    if ((m = /^(清|濁)音$/.exec(token))) return this.清濁[1] === m[1];
    if (/^[全次][清濁]$/.test(token)) return this.清濁 === token;
    if (token === '鈍音') return 鈍音母.indexOf(this.母) >= 0;
    if (token === '銳音') return 鈍音母.indexOf(this.母) < 0;
    if ((m = /^(.+?)([母等類韻音攝組聲])$/.exec(token))) {
      // «幫滂並母» значит 母 ∈ {幫, 滂, 並}: перечисление без разделителей
      var values = Array.from(m[1]), key = m[2];
      var mine = this[key];
      if (mine == null) return false;
      return values.indexOf(mine) >= 0;
    }
    throw new Error('неизвестное условие: ' + token);
  };

  /** Выражение языка запросов: 或 / 且 / 非, скобки, соседство = И. */
  Position.prototype.屬於 = function (expr) {
    if (expr && expr.raw) {          // вызов тегированным шаблоном
      var parts = Array.prototype.slice.call(arguments, 1);
      expr = expr.raw.reduce(function (acc, s, i) {
        return acc + s + (i < parts.length ? String(parts[i]) : '');
      }, '');
    }
    var self = this;
    var raw = String(expr).split(/(&+|\|+|[!~()])|\b(and|or|not)\b|\s+/i).filter(Boolean);
    var toks = raw.map(function (t) {
      if (t === '(' || t === ')') return { k: t };
      if (/^([!~非]|not)$/i.test(t)) return { k: 'not' };
      if (/^(&+|且|and)$/i.test(t)) return { k: 'and' };
      if (/^(\|+|或|or)$/i.test(t)) return { k: 'or' };
      return { k: 'val', v: self._evalToken(t) };
    });
    var i = 0;
    function peek() { return i < toks.length ? toks[i] : { k: 'end' }; }
    function parseNot() {
      if (peek().k === 'not') { i++; return !parseNot(); }
      if (peek().k === '(') {
        i++;
        var v = parseOr();
        if (peek().k !== ')') throw new Error('ожидалась )');
        i++;
        return v;
      }
      var t = toks[i++];
      if (!t || t.k !== 'val') throw new Error('ожидался признак');
      return t.v;
    }
    function parseAnd() {
      var v = parseNot();
      for (;;) {
        var k = peek().k;
        if (k === 'and') { i++; v = parseNot() && v; continue; }
        if (k === 'val' || k === 'not' || k === '(') { v = parseNot() && v; continue; }
        return v;
      }
    }
    function parseOr() {
      var v = parseAnd();
      while (peek().k === 'or') { i++; v = parseAnd() || v; }
      return v;
    }
    var res = parseOr();
    if (peek().k !== 'end') throw new Error('лишние элементы в выражении: ' + expr);
    return res;
  };

  /** Таблица решений: [[условие, значение], ...]; значение может быть вложенной таблицей. */
  Position.prototype.判斷 = function (rules, throws, fallThrough) {
    var self = this;
    var EXH = {};
    function loop(list) {
      for (var j = 0; j < list.length; j++) {
        var rule = list[j], cond = rule[0], val = rule[1];
        if (typeof cond === 'function') cond = cond();
        var ok = (typeof cond === 'string' && cond) ? self.屬於(cond) : cond !== false;
        if (!ok) continue;
        if (!Array.isArray(val)) return val;
        var r = loop(val);
        if (r === EXH && fallThrough) continue;
        return r;
      }
      return EXH;
    }
    var res = loop(rules);
    if (res === EXH) {
      if (throws === undefined || throws === false) return null;
      throw new Error(typeof throws === 'string' ? throws : 'не покрыты все условия');
    }
    return res;
  };

  /** Изменить отдельные признаки позиции: '匣母', '侯韻 一等 不分類'. */
  Position.prototype.調整 = function (spec) {
    var n = { 母: this.母, 呼: this.呼, 等: this.等, 類: this.類, 韻: this.韻, 聲: this.聲 };
    if (typeof spec === 'string') {
      String(spec).trim().split(/\s+/).forEach(function (token) {
        if (token === '開合中立') { n.呼 = null; return; }
        if (token === '不分類') { n.類 = null; return; }
        var m = /^(.)([母口等類韻聲])$/u.exec(token);
        if (!m) throw new Error('нераспознанное изменение: ' + token);
        n[m[2] === '口' ? '呼' : m[2]] = m[1];
      });
    } else if (spec) {
      Object.keys(spec).forEach(function (k) { n[k] = spec[k]; });
    }
    return new Position(n.母, n.呼, n.等, n.類, n.韻, n.聲);
  };

  Position.prototype.describe = function () {
    return this.母 + (this.呼 || '') + this.等 + (this.類 || '') + this.韻 + this.聲;
  };

  /** Построить позицию из записи слога в бандле. */
  core.position = function (syl) {
    return new Position(syl.I, syl.h, syl.d, syl.c, syl.R, syl.t);
  };
  core.Position = Position;
})(CL.core);

  // ─── web/js/core/syllable.js ────────────────────────────────────────
/* Разбор и сборка слога, правило границы слова.
   Чистые функции, DOM не трогают — при переносе в Next.js достаточно дописать export.

   Строение слога: инициаль + r + медиаль + ядро + полугласный + кода + тон.
   j и v — симметричная пара: каждая работает и медиалью (перед ядром),
   и полугласным (после ядра); роль различается позицией. */
window.CL = window.CL || {};
CL.core = CL.core || {};

(function (core) {
  'use strict';

  // Инициали, от длинных к коротким: придыхательные диграфы проверяются раньше.
  var INITIALS = [
    'ťh', 'čh', 'ćh', 'ph', 'th', 'kh', 'ch',
    'ť', 'ď', 'ň', 'č', 'ǯ', 'š', 'ž', 'ć', 'đ', 'ś', 'ź', 'ń',
    'p', 'b', 'm', 't', 'd', 'n', 'l', 'c', 'ʒ', 's', 'z',
    'k', 'kh', 'g', 'ŋ', 'x', 'h', 'y'
  ];

  var VOWELS = 'aeiouə';
  // буквы, на которые слог может кончиться так, что они «перепрыгнут» границу
  var TAIL = 'jkmnpstvŋ';
  // буквы, с которых слог может начаться так, что притянет к себе хвост предыдущего
  var HEAD = VOWELS + 'hjrv';

  /** Разобрать написание на составные части. Возвращает null, если не разбирается. */
  core.parse = function (s) {
    if (!s) return null;
    var rest = s, initial = '';
    for (var i = 0; i < INITIALS.length; i++) {
      if (rest.indexOf(INITIALS[i]) === 0) { initial = INITIALS[i]; rest = rest.slice(initial.length); break; }
    }
    var r = false;
    if (rest.charAt(0) === 'r') { r = true; rest = rest.slice(1); }

    var tone = '', coda = '';
    var last = rest.charAt(rest.length - 1);
    if (last === 'q')                  { tone = '上'; rest = rest.slice(0, -1); }
    else if (last === 's')             { tone = '去'; rest = rest.slice(0, -1); }
    else if ('ptk'.indexOf(last) >= 0) { tone = '入'; coda = last; rest = rest.slice(0, -1); }
    else                               { tone = '平'; }

    if (!coda) {
      var l2 = rest.charAt(rest.length - 1);
      if (l2 === 'm' || l2 === 'n' || l2 === 'ŋ') { coda = l2; rest = rest.slice(0, -1); }
    }

    // медиаль — начальный пробег из j/v, полугласный — то, что осталось после ядра
    var medial = '';
    while (rest.length > 1 && (rest.charAt(0) === 'j' || rest.charAt(0) === 'v')) {
      medial += rest.charAt(0); rest = rest.slice(1);
    }
    var nucleus = rest.charAt(0);
    if (VOWELS.indexOf(nucleus) < 0) return null;
    var offglide = rest.slice(1);
    if (offglide !== '' && offglide !== 'j' && offglide !== 'v') return null;

    return { initial: initial, r: r, medial: medial, nucleus: nucleus,
             offglide: offglide, coda: coda, tone: tone };
  };

  /** Нужен ли апостроф между двумя слогами. */
  core.needsApostrophe = function (prev, next) {
    if (!prev || !next) return false;
    var a = prev.charAt(prev.length - 1), b = next.charAt(0);
    return TAIL.indexOf(a) >= 0 && HEAD.indexOf(b) >= 0;
  };

  /** Собрать слоги в слово, расставив апострофы по правилу. */
  core.joinWord = function (sylls) {
    var out = '';
    for (var i = 0; i < sylls.length; i++) {
      if (i && core.needsApostrophe(out, sylls[i])) out += "'";
      out += sylls[i];
    }
    return out;
  };

  core.TONE_CODA = { '平': '', '上': '-q', '去': '-s', '入': '-p/-t/-k' };

  core.describe = function (p) {
    if (!p) return '';
    var bits = [];
    if (p.initial) bits.push('инициаль ' + p.initial);
    if (p.r) bits.push('метка *-r-');
    if (p.medial) bits.push('медиаль ' + p.medial);
    bits.push('ядро ' + p.nucleus);
    if (p.offglide) bits.push('полугласный ' + p.offglide);
    if (p.coda) bits.push('кода ' + p.coda);
    bits.push('тон ' + p.tone);
    return bits.join(' · ');
  };

  core.isHan = function (ch) {
    var c = ch.codePointAt(0);
    return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF) ||
           (c >= 0xF900 && c <= 0xFAFF) || (c >= 0x20000 && c <= 0x2FA1F);
  };
})(CL.core);

  // ─── web/js/core/derive.js ────────────────────────────────────────
/* Вывод современного произношения из среднекитайской позиции по правилам.

   Здесь только склейка: сами правила — это оригинальные скрипты
   nk2028/tshet-uinh-examples, подключённые из data/derivers.js без изменений.
   Значения опций по умолчанию скрипты объявляют сами: при вызове с пустой
   позицией они возвращают список опций, где первый элемент — номер умолчания. */
window.CL = window.CL || {};
CL.core = CL.core || {};

(function (core) {
  'use strict';

  var OPT_OVERRIDE = {
    putonghua: {
      // Распределение тонов у глухих 入聲 — та самая непредсказуемая часть.
      // «皆派入陰平» — умолчание, обоснованное у 平山久雄.
      更多選項: true,
      清聲母入聲調分派層次: '皆派入陰平',
      常母平聲陰聲韻聲母和船母平聲聲母: 'sh'
    }
  };

  var optsCache = null, cache = {};

  function options() {
    if (optsCache) return optsCache;
    optsCache = {};
    Object.keys(CL.derivers || {}).forEach(function (name) {
      var o = {};
      var spec;
      try { spec = CL.derivers[name](null, {}); } catch (e) { spec = null; }
      (spec || []).forEach(function (item) {
        if (!Array.isArray(item)) return;
        var k = item[0], v = item[1];
        o[k] = Array.isArray(v) ? v[v[0]] : v;   // v[0] — номер значения по умолчанию
      });
      Object.keys(OPT_OVERRIDE[name] || {}).forEach(function (k) {
        o[k] = OPT_OVERRIDE[name][k];
      });
      optsCache[name] = o;
    });
    return optsCache;
  }

  core.DERIVERS = { putonghua: 'путунхуа', gwongzau: 'кантонский' };

  /** Вывести чтения для слога. -> {putonghua: 'gōng', gwongzau: 'gung1'} */
  core.derive = function (syl) {
    if (!CL.derivers || !syl) return {};
    if (cache[syl.l]) return cache[syl.l];
    var pos = core.position(syl), opt = options(), out = {};
    Object.keys(core.DERIVERS).forEach(function (name) {
      if (!CL.derivers[name]) return;
      try { out[name] = CL.derivers[name](pos, opt[name] || {}); }
      catch (e) { out[name] = null; }
    });
    cache[syl.l] = out;
    return out;
  };

  /** Совпадает ли выведенное с засвидетельствованным (точно / только сегменты). */
  core.compareReading = function (derived, attested) {
    if (!derived || !attested) return null;
    if (derived.normalize('NFC') === attested.normalize('NFC')) return 'exact';
    var strip = function (x) {
      return x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[1-6]$/, '');
    };
    return strip(derived) === strip(attested) ? 'segments' : 'differs';
  };
})(CL.core);

  // ─── web/js/core/lookup.js ────────────────────────────────────────
/* Поиск по данным: иероглиф → чтения, написание → иероглифы, омонимы.
   Чистые функции над CL.chars / CL.syllables / CL.variants. */
window.CL = window.CL || {};
CL.core = CL.core || {};

(function (core) {
  'use strict';

  var byLatin = null;      // написание -> [иероглифы]
  var latinOfSyl = null;

  function index() {
    if (byLatin) return;
    byLatin = {};
    latinOfSyl = CL.syllables.map(function (s) { return s.l; });
    Object.keys(CL.chars).forEach(function (ch) {
      var e = CL.chars[ch];
      if (!e.r) return;
      e.r.forEach(function (r) {
        var lat = latinOfSyl[r[0]];
        (byLatin[lat] = byLatin[lat] || []).push(ch);
      });
    });
  }

  core.VARIETY_NAMES = {
    cmn: 'путунхуа', yue: 'кантонский',
    jpn_on: 'японское онъёми', kor: 'корейское', vie: 'вьетнамское'
  };

  /** Запись об иероглифе с разрешением упрощённой формы.
      -> {char, entry, via} | null   (via — традиционная форма, если подставлена) */
  core.lookup = function (ch) {
    var e = CL.chars[ch];
    if (e && e.r && e.r.length) return { char: ch, entry: e, via: null };
    var alts = (CL.variants && CL.variants[ch]) || [];
    for (var i = 0; i < alts.length; i++) {
      var t = CL.chars[alts[i]];
      if (t && t.r && t.r.length) return { char: ch, entry: t, via: alts[i] };
    }
    if (e) return { char: ch, entry: e, via: null };   // есть современные чтения, нет среднекитайских
    return null;
  };

  /** Чтения иероглифа, основное первым. */
  core.readings = function (entry) {
    if (!entry || !entry.r) return [];
    return entry.r.map(function (r) {
      /* хвост строки необязателен: [4] — знак, из которого взято чтение,
         [5] — признак назначенного написания (у морфемы нет предка) */
      return { syl: CL.syllables[r[0]], gloss: r[1], primary: !!r[2], fanqie: r[3],
               from: r[4] || null, artificial: !!r[5] };
    }).sort(function (a, b) { return (b.primary ? 1 : 0) - (a.primary ? 1 : 0); });
  };

  /** Основное написание иероглифа. */
  core.primaryLatin = function (entry) {
    var rs = core.readings(entry);
    return rs.length ? rs[0].syl.l : null;
  };

  /** Назначено ли основное написание, а не унаследовано. */
  core.isArtificial = function (entry) {
    var rs = core.readings(entry);
    return rs.length ? rs[0].artificial : false;
  };

  /** Иероглифы, делящие написание. */
  core.homophones = function (latin, exclude) {
    index();
    var list = (byLatin[latin] || []).filter(function (c) { return c !== exclude; });
    var seen = {}, out = [];
    list.forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } });
    out.sort(function (a, b) {
      var fa = (CL.chars[a] && CL.chars[a].f) || 1e9, fb = (CL.chars[b] && CL.chars[b].f) || 1e9;
      return fa - fb;
    });
    return out;
  };

  /** Поиск слога по написанию (точное совпадение). */
  core.syllableByLatin = function (latin) {
    index();
    for (var i = 0; i < CL.syllables.length; i++) {
      if (CL.syllables[i].l === latin) return CL.syllables[i];
    }
    return null;
  };

  /** Современные чтения иероглифа в порядке VARIETY_NAMES. */
  core.modern = function (entry) {
    var out = [];
    if (!entry || !entry.m) return out;
    Object.keys(core.VARIETY_NAMES).forEach(function (v) {
      if (entry.m[v]) out.push({ variety: v, name: core.VARIETY_NAMES[v], values: entry.m[v] });
    });
    return out;
  };

  /** Тон засвидетельствованного чтения кантонского (цифра в конце ютпхина). */
  core.attestedYueTone = function (entry) {
    if (!entry || !entry.m || !entry.m.yue) return null;
    var m = /([1-6])$/.exec(entry.m.yue[0]);
    return m ? parseInt(m[1], 10) : null;
  };

  /** Тон засвидетельствованного чтения путунхуа (по диакритике). */
  core.attestedCmnTone = function (entry) {
    if (!entry || !entry.m || !entry.m.cmn) return null;
    var marks = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
    var d = entry.m.cmn[0].normalize('NFD');
    for (var i = 0; i < d.length; i++) if (marks[d[i]]) return marks[d[i]];
    return 5;
  };

  /** Разбить текст на элементы: иероглифы и всё остальное. */
  core.tokenize = function (text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var cp = text.codePointAt(i);
      if (cp > 0xFFFF) { ch = text.substr(i, 2); i++; }
      out.push({ ch: ch, han: core.isHan(ch) });
    }
    return out;
  };
})(CL.core);

  // ─── web/js/core/segment.js ────────────────────────────────────────
/* Разбиение текста на слова и сборка слова в латиницу.

   Границы слов берутся из словаря CC-CEDICT методом наибольшего совпадения слева.
   Внутри слова слоги пишутся слитно, апостроф ставится по правилу; слова разделяются
   пробелом. Словарь заодно снимает многозначность: для 88% многочтений чтение
   внутри слова определено однозначно (行 в 銀行 — háng, в 行動 — xíng). */
window.CL = window.CL || {};
CL.core = CL.core || {};

(function (core) {
  'use strict';

  var FORMS = null;
  var MAXLEN = 8;

  function forms() {
    if (!FORMS) {
      FORMS = new Set();
      if (CL.words && CL.words.forms) {
        var list = CL.words.forms.split('\n');
        for (var i = 0; i < list.length; i++) if (list[i]) FORMS.add(list[i]);
      }
    }
    return FORMS;
  }

  /** Слоги слова: сначала словарные, где они отличаются от умолчания знака. */
  function wordSyllables(word) {
    var ov = CL.words && CL.words.ov && CL.words.ov[word];
    var idxs = ov ? ov[0].split(',') : null;
    var pin = ov ? (ov[1] || '').split(/\s+/) : null;
    var out = [];
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      var syl = null, fromDict = false, art = false;
      if (idxs && idxs[i] !== undefined && idxs[i] !== '') {
        var n = parseInt(idxs[i], 10);
        if (!isNaN(n) && n >= 0) { syl = CL.syllables[n]; fromDict = true; }
      }
      // Признак «написание назначено» живёт на чтении, а не на слоге: тот же слог
      // может быть у знака с настоящим среднекитайским чтением. Поэтому смотрим
      // запись иероглифа и сверяем, о том ли слоге речь.
      var res = core.lookup(ch);
      var rs = res ? core.readings(res.entry) : [];
      if (!syl && rs.length) syl = rs[0].syl;
      for (var k = 0; k < rs.length; k++) {
        if (rs[k].syl === syl) { art = rs[k].artificial; break; }
      }
      out.push({ ch: ch, syl: syl, fromDict: fromDict, artificial: art,
                 pinyin: pin && pin[i] ? pin[i] : null,
                 ambiguous: isAmbiguous(ch) });
    }
    return out;
  }

  function isAmbiguous(ch) {
    var res = core.lookup(ch);
    if (!res) return false;
    var rs = core.readings(res.entry);
    if (rs.length < 2) return false;
    var seen = {};
    for (var i = 0; i < rs.length; i++) seen[rs[i].syl.l] = 1;
    return Object.keys(seen).length > 1;
  }

  /** Разбить строку на элементы: слова-иероглифы и всё прочее. */
  core.segment = function (text) {
    var F = forms();
    var out = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (!core.isHan(ch)) {
        var j = i;
        while (j < text.length && !core.isHan(text[j])) j++;
        out.push({ type: 'other', text: text.slice(i, j) });
        i = j;
        continue;
      }
      var hit = null;
      for (var len = Math.min(MAXLEN, text.length - i); len >= 2; len--) {
        var cand = text.substr(i, len);
        if (!allHan(cand)) continue;
        if (F.has(cand)) { hit = cand; break; }
      }
      if (!hit) hit = ch;
      out.push({ type: 'word', text: hit, inDict: F.has(hit),
                 parts: wordSyllables(hit) });
      i += hit.length;
    }
    return out;
  };

  function allHan(s) {
    for (var i = 0; i < s.length; i++) if (!core.isHan(s[i])) return false;
    return true;
  }

  /** Слово в латинице: слоги слитно, апостроф по правилу.
      Знак без среднекитайского источника ставится в угловые скобки: это не сбой,
      а отсутствие решения — так морфема и выглядит в этимологической орфографии. */
  /** То же, что wordToLatin, но кусками: [{text, artificial}, …].
      Нужно, чтобы серым выделялся только назначенный слог, а не всё слово. */
  core.wordToLatinChunks = function (parts) {
    var chunks = [], out = '';
    function push(text, art) {
      if (!text) return;
      var last = chunks[chunks.length - 1];
      if (last && last.artificial === art) last.text += text;
      else chunks.push({ text: text, artificial: art });
      out += text;
    }
    for (var i = 0; i < parts.length; i++) {
      var lat = parts[i].syl ? parts[i].syl.l : null;
      if (lat === null) { push((out ? ' ' : '') + '\u27e8' + parts[i].ch + '\u27e9', false); continue; }
      if (out && !/[\u27e9 ]$/.test(out) && core.needsApostrophe(out, lat)) push("'", false);
      if (/\u27e9$/.test(out)) push(' ', false);
      push(lat, !!parts[i].artificial);
    }
    return chunks;
  };

  core.wordToLatin = function (parts) {
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var lat = parts[i].syl ? parts[i].syl.l : null;
      if (lat === null) { out += (out ? ' ' : '') + '⟨' + parts[i].ch + '⟩'; continue; }
      if (out && !/[⟩ ]$/.test(out) && core.needsApostrophe(out, lat)) out += "'";
      if (/⟩$/.test(out)) out += ' ';
      out += lat;
    }
    return out;
  };
})(CL.core);

  // ─── web/data/derivers.js (nk2028/tshet-uinh-examples) ────────────────────
window.CL = window.CL || {};
CL.derivers = {};
CL.derivers["gwongzau"] = function (音韻地位, 選項) {
/* 推導廣州話
 *
 * https://ayaka.shn.hk/teoi/
 *
 * @author Ayaka
 */

/** @type { 音韻地位['屬於'] } */
const is = (...x) => 音韻地位.屬於(...x);
/** @type { 音韻地位['判斷'] } */
const when = (...x) => 音韻地位.判斷(...x);

if (!音韻地位) return [];

if (is`云母 通攝 舒聲`) 音韻地位 = 音韻地位.調整('匣母', ['匣母三等']);

function 聲母規則() {
  return when([
    ['幫滂並母 C類', 'f'],
    ['幫母 或 並母 仄聲', 'b'],
    ['滂母 或 並母 平聲', 'p'],
    ['明母', 'm'],

    ['端母 或 定母 仄聲', 'd'],
    ['透母 或 定母 平聲', 't'],
    ['泥孃母', 'n'],
    ['來母', 'l'],

    ['精莊知章母 或 從崇俟邪澄母 仄聲', 'z'], // 精莊組濁音塞擦音多於擦音（下同）
    ['清初徹昌母 或 從崇俟邪澄母 平聲', 'c'],
    ['心生常書船母', 's'], // 章組濁音擦音多於塞擦音

    ['見母 或 羣母 仄聲', 'g'],
    ['羣母 平聲', 'k'],
    ['疑母', 'ng'], // 細音為 j，詳後

    ['溪曉母', 'h'], // 溪母多數擦化；三四等拼 a 元音部分韻母時為 j/w，詳後
    ['匣母', [
      ['合口 或 (遇攝 一等)', 'j'], // 拼展脣或後元音時為 w，詳後
      ['', 'h'],
    ]],
    ['影云以日母', [
      ['三四等', 'j'], // 拼展脣或後元音時為 w，詳後
      ['', ''],
    ]],
  ], '無聲母規則');
}

function 韻母規則() {
  return when([
    ['通攝', 'ung'],

    ['止攝', [
      ['脣音', 'ei'],
      ['開口 (端組 或 孃來母 或 見溪羣曉母)', 'ei'],
      ['開口', 'i'],
      ['合口 舌齒音', 'eoi'],
      ['合口 牙喉音', 'ai'],
    ]],

    ['遇攝', [
      ['三四等', [
        ['幫滂並母', 'u'],
        ['明母', 'ou'],
        ['莊組', 'o'],
        ['端精組 或 孃來母 或 見溪羣曉母', 'eoi'],
        ['', 'yu'],
      ]],
      ['一等', [
        ['脣音 或 舌齒音', 'ou'],
        ['疑母', ''],
        ['牙喉音', 'u'],
      ]],
    ]],

    ['蟹攝', [
      ['廢韻 平上聲 章組', 'oi'], // 參照「茝」coi2
      ['合口 銳音', 'eoi'], // 含以母
      ['三四等', 'ai'],
      ['二等 或 泰韻 開口 (端組 或 來母)', 'aai'],
      ['一等', [
        ['開口 或 疑母', 'oi'],
        ['', 'ui'],
      ]],
    ]],

    ['臻攝', [
      ['三四等', [
        ['合口 舌齒音', 'eon'],
        ['', 'an'],
      ]],
      ['一等', [
        ['脣音', 'un'],
        ['合口 (端組 或 來母)', 'eon'],
        ['合口 精組', 'yun'],
        ['', 'an'],
      ]],
    ]],

    ['山攝', [
      ['二等 或 脣音 C類', 'aan'],
      ['三四等', [
        ['開口 或 脣音', 'in'],
        ['合口', 'yun'],
      ]],
      ['一等', [
        ['開口 舌齒音', 'aan'],
        ['開口 牙喉音', 'on'],
        ['合口 舌齒音', 'yun'],
        ['合口 牙喉音 或 脣音', 'un'],
      ]],
    ]],

    ['效攝', [
      ['三四等', 'iu'],
      ['二等', 'aau'],
      ['一等', 'ou'],
    ]],

    ['果假攝', [
      ['三四等', [
        ['脣音 C類', 'o'],
        ['開口 或 脣音', 'e'],
        ['合口', 'oe'],
      ]],
      ['二等', 'aa'],
      ['一等', 'o'],
    ]],

    ['宕江攝', [
      ['三四等', [
        ['脣音 C類 或 開口 莊組 或 合口', 'ong'],
        ['', 'oeng'],
      ]],
      ['二等 舌齒音', 'oeng'],
      ['一二等', 'ong'],
    ]],

    ['梗曾攝', [
      ['一二等 或 梗攝 莊組', [ // 文 ang、白 aang，兩者勢均，推導音依文讀
        ['庚韻 二等 (來母 或 端組)', 'aang'], // 唯來母「冷」向無 lang 音例，故例外，端組亦從之
        ['', 'ang'],
      ]],
      ['三四等', 'ing'],
    ]],

    ['流攝', [
      ['四等 端組 或 幽韻 幫滂並母', 'iu'], // 「丟」「彪」「淲」
      ['', 'au'],
    ]],

    ['深攝', 'am'], // -m 拼脣音時為 -n，詳後，下同

    ['咸攝', [
      ['二等 或 脣音 C類', 'aam'],
      ['三四等', 'im'],
      ['一等 脣舌齒音', 'aam'], // 脣音僅僻字，如「姏」maan4
      ['一等 牙喉音', 'om'], // -om 併入 -am，但影響陰入分化，詳後
    ]],
  ], '無韻母規則');
}

function 聲調規則() {
  return when([
    ['清音', [
      ['平聲', '1'],
      ['上聲', '2'],
      ['去入聲', '3'], // 中入於短元音為 1（陰入），詳後
    ]],
    ['濁音', [
      ['平聲', '4'],
      ['上聲 次濁', '5'],
      ['上聲 全濁 或 去入聲', '6'],
    ]]
  ], '無聲調規則');
}

function is短元音(韻母) {
  if (['am', 'an', 'ang', 'eon', 'ing', 'ung'].includes(韻母)) return true;
  if (['aam', 'aan', 'im', 'in', 'om', 'on', 'ong', 'oeng', 'un', 'yun'].includes(韻母)) return false;
  throw new Error('無長短元音規則：' + 韻母);
}

let 聲母 = 聲母規則();
let 韻母 = 韻母規則();
let 聲調 = 聲調規則();

// ng 拼細音時為 j
const is細音 = ['eo', 'i', 'oe', 'u', 'yu'].some(x => 韻母.startsWith(x));
if (聲母 === 'ng' && is細音) 聲母 = 'j';

// 三四等清調 h 拼 a 元音部分韻母時為 j/w
if (聲母 === 'h' && ['au', 'an', 'am'].includes(韻母) && is`清音 三四等 非 (臻攝 開口 入聲) 非 (臻攝 合口 舒聲)`) {
  聲母 = 'j';
}

// 陰入分化
if (is`入聲` && 聲調 === '3' && is短元音(韻母)) 聲調 = '1';

// 合口
if (is`合口 或 模韻` && !['eo', 'oe', 'yu'].some(x => 韻母.startsWith(x))) {
  if ((聲母 === 'g' || 聲母 === 'k') && !韻母.startsWith('u')) 聲母 += 'w';
  else if (聲母 === 'h' && !韻母.startsWith('i')) 聲母 = 'f';
  else if (聲母 === 'j' || 聲母 === '') 聲母 = 'w';
}

// -om 併入 -am
if (韻母 === 'om') 韻母 = 'am';

// m 韻尾在聲母為脣音時為 n
if (is`脣音` && 韻母.endsWith('m')) 韻母 = 韻母.slice(0, -1) + 'n';

if (is`入聲`) {
  if (韻母.endsWith('m')) 韻母 = 韻母.slice(0, -1) + 'p';
  else if (韻母.endsWith('n')) 韻母 = 韻母.slice(0, -1) + 't';
  else if (韻母.endsWith('ng')) 韻母 = 韻母.slice(0, -2) + 'k';
}

return 聲母 + 韻母 + 聲調;

};
CL.derivers["putonghua"] = function (音韻地位, 選項) {
/* 推導普通話
 *
 * @author graphemecluster
 * @author JwietPuj-Drin
 * @author SyiMyuZya
 *
 * 選項「清聲母入聲調分派層次」詳見平山久雄《中古汉语的清入声在北京话里的对应规律》
 * http://ccj.pku.edu.cn/Article/DownLoad?id=271015083&&type=ArticleFile
 * 默認選擇為「皆派入陰平」，参考刘海阳在對「北京话的入声为什么会派入三个不同的声调？」的回答中披露的材料——
 * 「古代清音入声字在北京話的声調，凡是沒有异讀的，就采用北京已經通行的讀法。凡是有异讀的，假若其中有一个是陰平調，原則上就采用陰平，例如：“息”ㄒㄧ（xī）“击”ㄐㄧ（jī）。否則逐字考慮，采用比較通行……」
 * https://www.zhihu.com/question/30370012/answer/533234460
 *
 * 選項「常母平聲陰聲韻聲母和船母平聲聲母」詳見 unt 對「为何中古的dʑ ʑ和普通话读音的对应似乎是反的（即dʑ > ʂ、ʑ > ʈʂ）？」的回答
 * https://www.zhihu.com/question/526195183/answer/2425807330
 */

/** @type { 音韻地位['屬於'] } */
const is = (...x) => 音韻地位.屬於(...x);
/** @type { 音韻地位['判斷'] } */
const when = (...x) => 音韻地位.判斷(...x);

const is更多選項 = 選項.更多選項 ?? false;

if (!音韻地位) return [
  ['標調方式', [2, '數字', '附標']],

  ['更多選項', is更多選項],
  ...(is更多選項 ? [
    '更多選項',
    ['清聲母入聲調分派層次',
      [2,
        '皆派入上聲',
        '皆派入陰平',
        '次清、擦音和零聲母字派入去聲，其餘派入陽平',
        '次清和零聲母字派入去聲，其餘派入陽平',
        '皆不標調',
        '連同濁聲母，所有入聲字皆派入去聲',
      ]
    ],
    ['常母平聲陰聲韻聲母和船母平聲聲母', [2, 'ch', 'sh']],
  ] : []),
];

// 預調整（中古中期通語已產生的不同）
if (is`明母 尤東韻`) 音韻地位 = 音韻地位.調整(`${音韻地位.韻 === '尤' ? '侯' : 音韻地位.韻}韻 一等 不分類`);
if (is`云母 通攝 舒聲`) 音韻地位 = 音韻地位.調整('匣母', ['匣母三等']);
// TODO 蟹攝入假攝、流攝入遇攝等

// j、q、x 不列於聲母規則，之後會由「拼細音」條件得出
const 聲母規則 = () => when([
  ['幫滂並母 C類', 'f'],
  ['幫母', 'b'],
  ['滂母', 'p'],
  ['並母', [['平聲', 'p'], ['', 'b']]],
  ['明母', [['C類', 'w'], ['', 'm']]],

  ['端母', 'd'],
  ['透母', 't'],
  ['定母', [['平聲', 't'], ['', 'd']]],
  ['泥孃母', 'n'],
  ['來母', 'l'],

  ['精母', 'z'],
  ['清母', 'c'],
  ['從母', [['平聲', 'c'], ['', 'z']]],
  ['心邪母', 's'],

  ['知莊章母', 'zh'],
  ['徹初昌母', 'ch'],
  ['澄崇母', [['平聲', 'ch'], ['', 'zh']]],
  ['常母', [['平聲 陽聲韻', 'ch'], ['', 'sh']]],
  ['生書母', 'sh'],
  ['俟船母', 'sh'],
  ['日母', 'r'],

  ['見母', 'g'],
  ['溪母', 'k'],
  ['羣母', [['平聲', 'k'], ['', 'g']]],
  ['曉匣母', 'h'],
  ['以母 蟹攝 三四等 合口', 'r'], // 「銳」
  ['疑影云以母', ''],
], '無聲母規則');

// 韻母均按零聲母寫法，唯 y、w、yu 作 i、u、ü（例如用 uen、ueng 不用 un、ong），這是為了方便後面的拼寫處理。
// 韻母規則不額外列出 zh、ch、sh、r、f、w 及部分 n、l 系統性地拼為洪音的情形，後面會處理。
const 舒聲韻母規則 = () => when([
  ['通攝', [['三四等 牙喉音', 'iong'], ['', 'ueng']]],

  ['止攝', [
    ['合口', [['莊組', 'uai'], ['', 'uei']]],
    ['', 'er'], // 'er' 指示其拼日母時為 er，以及拼 z、c、s 時聲母不作 j、q、x，其餘情形均同 i
  ]],

  ['遇攝', [['三四等', 'ü'], ['', 'u']]],

  ['蟹攝', [
    ['廢韻 平上聲 章組', [['合口', 'uai'], ['', 'ai']]], // 「茝」
    ['三四等', [['合口 莊組', 'uai'], ['合口', 'uei'], ['', 'i']]],
    // FIXME 蟹攝二等有古已轉入假攝者，依更早韻書推導時需判斷具體的字。目前暫僅列出個別可能存在系統性者
    ['二等 開口 溪影母', 'ai'], // 「矮隘楷揩」等
    ['佳韻 合口 牙喉音', 'ua'], // 「畫掛」等（FIXME 未覆蓋如「佳」「話」等，且過度覆蓋「拐」等，當依具體字而非音）
    ['佳韻 開口 疑母', 'ia'], // 「崖睚」等（FIXME 當依具體字而非音）
    ['二等', [
      ['開口 牙喉音', 'ie'],
      ['合口', 'uai'],
      ['', 'ai']],
    ],
    ['一等', [['開口', 'ai'], ['', 'uei']]],
  ]],

  ['臻深攝', [
    ['三四等', [['合口', 'ün'], ['', 'in']]],
    ['', [
      ['合口 或 舌齒音', 'uen'], // 覆蓋「吞」
      ['', 'en'],
    ]],
  ]],

  ['山咸攝', [
    ['三四等', [['合口', 'üan'], ['', 'ian']]],
    ['二等 牙喉音 開口', 'ian'],
    ['', [['合口', 'uan'], ['', 'an']]],
  ]],

  ['效攝', [
    ['三四等 或 二等 牙喉音', 'iao'],
    ['', 'ao'],
  ]],

  ['果假攝', [
    ['三四等', [['合口', 'üe'], ['', 'ie']]],
    ['二等', [['合口', 'ua'], ['牙喉音', 'ia'], ['', 'a']]],
    ['一等', [['開口 牙喉音', 'e'], ['', 'uo']]],
  ]],

  ['宕江攝', [
    ['合口 或 莊組 或 二等 知組', 'uang'],
    ['三四等 或 二等 牙喉音', 'iang'],
    ['', 'ang'],
  ]],

  ['梗曾攝', [
    ['三四等', [['合口', 'iong'], ['', 'ing']]],
    ['', [['合口', 'ueng'], ['', 'eng']]],
  ]],

  ['流攝', [
    // FIXME 流攝脣音有古已轉入遇攝者，依更早韻書推導時需判斷具體的字。目前暫僅列出個別可能存在系統性者
    ['幽韻 幫滂並母', 'iao'], // 「彪髟淲」等
    ['尤韻 脣音 非 (幫母 上聲)', 'u'], // 排除「否缶」（FIXME 當依具體字而非音）
    ['三四等', 'iou'],
    ['', 'ou'], // FIXME 未覆蓋如「牡」「部」「矛」「茂」等，當依具體字而非音
  ]],
], '無韻母規則');

const 入聲韻母規則 = () => when([
  ['通攝', [['三四等 牙喉音', 'ü'], ['', 'u']]],

  ['臻深攝', [
    ['莊組', [['合口', 'uai'], ['', 'e']]], // TODO 「櫛」？
    ['三四等', [['合口 或 脣音 C類', 'ü'], ['', 'i']]],
    ['', [['脣音', 'o'], ['合口', 'u'], ['', 'e']]],
  ]],

  ['山咸攝', [
    // TODO 「茁」
    ['二等 或 莊組 或 脣音 C類', [['合口', 'ua'], ['牙喉音', 'ia'], ['', 'a']]],
    ['三四等', [['合口', 'üe'], ['', 'ie']]],
    ['', [
      ['開口', [['牙喉音', 'e'], ['', 'a']]],
      ['', 'uo'],
    ]],
  ]],

  ['宕江攝', [
    // TODO 白讀
    ['三四等 或 二等 牙喉音', 'üe'],
    ['一等 開口 牙喉音', 'e'],
    ['', 'uo'],
  ]],

  ['梗曾攝', [
    // TODO 白讀
    ['三四等 非 莊組', [['合口', 'ü'], ['', 'i']]],
    ['', [['開口', 'e'], ['', 'uo']]],
  ]],
], '無韻母規則');

const 聲調規則 = () => when([
  ['清音', [
    ['平聲', '1'],
    ['上聲', '3'],
    ['去聲', '4'],
    ['入聲', ''],
  ]],
  ['濁音', [
    ['平聲', '2'],
    ['上聲', [['全濁', '4'], ['次濁', '3']]],
    ['去聲', '4'],
    ['入聲', [['全濁', '2'], ['次濁', '4']]],
  ]],
], '無聲調規則');

let 聲母 = 聲母規則();
let 韻母 = is`舒聲` ? 舒聲韻母規則() : 入聲韻母規則();
let 聲調 = 聲調規則();

if (選項.更多選項) {
  // 參考 https://www.zhihu.com/question/526195183/answer/2425807330
  if (is`(常母 陰聲韻 或 船母) 平聲`) 聲母 = 選項.常母平聲陰聲韻聲母和船母平聲聲母;

  /* 參考
   * http://ccj.pku.edu.cn/Article/DownLoad?id=271015083&&type=ArticleFile (https://web.archive.org/web/20240223084634/http://ccj.pku.edu.cn/Article/DownLoad?id=271015083&&type=ArticleFile)
   * https://www.zhihu.com/question/30370012/answer/533234460
   * https://www.zhihu.com/question/30370012/answer/535713330
   */
  if (is`入聲`) {
    switch (選項.清聲母入聲調分派層次) {
      case '皆派入上聲':
        if (is`清音`) 聲調 = '3';
        break;
      case '皆派入陰平':
        if (is`清音`) 聲調 = '1';
        break;
      case '次清、擦音和零聲母字派入去聲，其餘派入陽平':
        if (is`心生書影曉母 或 次清`) 聲調 = '4';
        else if (is`全清`) 聲調 = '2';
        break;
      case '次清和零聲母字派入去聲，其餘派入陽平':
        if (is`影母 或 次清`) 聲調 = '4';
        else if (is`全清`) 聲調 = '2';
        break;
      case '連同濁聲母，所有入聲字皆派入去聲':
        聲調 = '4';
        break;
    }
  }
}

// j、q、x 聲母
if (韻母 === 'er' || ['i', 'ü'].includes(韻母[0])) {
  聲母 = { g: 'j', k: 'q', h: 'x' }[聲母] ?? 聲母;
  if (韻母 !== 'er') 聲母 = { z: 'j', c: 'q', s: 'x' }[聲母] ?? 聲母;
}

// er
if (韻母 === 'er') {
  if (聲母 === 'r') 聲母 = '';
  else 韻母 = 'i';
}

// 以下音節系統性地作開口而非合口
if (['n', 'l'].includes(聲母) && ['ua', 'uai', 'uang', 'uei'].includes(韻母)) 韻母 = 韻母.slice(1);
// 以下音節系統性地作合口而非撮口
if (韻母[0] === 'ü' && ['n', 'l'].includes(聲母) && !['ü', 'üe'].includes(韻母)) {
  韻母 = 'u' + (韻母[1] === 'n' ? 'e' : '') + 韻母.slice(1);
}

// 以下音節系統性地作洪音而非細音
if (['zh', 'ch', 'sh', 'r', 'f', 'w'].includes(聲母)) {
  if (韻母 === 'i') {
    if (聲母 === 'f' || 聲母 === 'w') 韻母 = 'ei';
  } else if (韻母[0] === 'i' || 韻母[0] === 'ü') {
    韻母 = (韻母[0] === 'ü' ? 'u' : '') + (韻母[1] === 'n' ? 'e' : '') + 韻母.slice(1);
    if (韻母 === 'ue') 韻母 = 'uo';
    else if (韻母 === 'e' && ['f', 'w'].includes(聲母)) 韻母 = 'o';
  }
}

// 以下音節系統性地作開口而非合口
if (['b', 'p', 'm', 'f', 'w'].includes(聲母) && 韻母[0] === 'u' && 韻母[1]) 韻母 = 韻母.slice(1);

// 拼音拼寫規則
if (!聲母) {
  if (韻母[0] === 'i' || 韻母[0] === 'ü') 聲母 = 'y';
  if (韻母[0] === 'u') 聲母 = 'w';
  if (聲母 && 韻母[0] !== 'ü' && 韻母[1] && 韻母[1] !== 'n') 韻母 = 韻母.slice(1);
}
韻母 = { iou: 'iu', uei: 'ui', uen: 'un', ueng: 'ong' }[韻母] || 韻母;
if (韻母[0] === 'ü' && !['n', 'l'].includes(聲母)) 韻母 = 'u' + 韻母.slice(1);

if (選項.標調方式 === '數字') return 聲母 + 韻母 + 聲調;
return 聲母 + (聲調 ? 韻母.replace(/.*a|.*[eo]|.*[iuü]/, '$&' + ' ̄́̌̀'[聲調]) : 韻母);

};


  Object.assign(CL, data || {});
  return CL;
}

/** Дописать данные в уже собранный движок (вкладки грузят их по очереди). */
export function addData(CL, data) {
  Object.assign(CL, data || {});
  return CL;
}

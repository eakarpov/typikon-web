// Русское склонение при числе: «1 храм», «2 храма», «5 храмов».
//
// Заведено, когда счётчиков стало трое: указатель святых, указатель храмов и
// карта. Правило одно на всех, и три его копии разошлись бы на первой же
// правке — а разойдясь, дали бы «3 храмов» на одной странице и «3 храма» на
// соседней.

/** Форма слова при числе. */
export const plural = (n: number, one: string, few: string, many: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

/** Число со словом: «3 храма». */
export const counted = (n: number, one: string, few: string, many: string): string =>
    `${n} ${plural(n, one, few, many)}`;

export const temples = (n: number): string => counted(n, "храм", "храма", "храмов");

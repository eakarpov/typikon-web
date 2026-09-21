import { computeLectionaryYear } from "@/utils/lectionaryCycle";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

[2009, 2010, 2031, 2078].forEach(year => {
    const r = computeLectionaryYear(year);
    console.log(`\n=== ${year} ===`);
    console.log("Пасха (н.ст.):", fmt(r.paschaDate));
    console.log("Пятидесятница (н.ст.):", fmt(r.pentecostDate));
    console.log("Неделя по Воздвижении (н.ст.):", fmt(r.elevationSunday), "день недели:", r.elevationSunday.getDay());
    console.log("Сентябрьская коррекция:", JSON.stringify(r.septemberAdjustment));
    console.log("Неделя по Богоявлении (н.ст.):", fmt(r.theophanySunday), "день недели:", r.theophanySunday.getDay());
    console.log("Неделя о мытаре и фарисее (н.ст.):", fmt(r.publicanSunday), "по счёту:", r.publicanWeekNumber);
    console.log("Крещенский блок с седмицы", r.januaryBlockStart, "— читаются:", r.januaryRepeatWeeks);
    console.log("Апостол (с 28-й):", [...r.apostleWeekMap.entries()].filter(([k]) => k >= 28).map(([k, v]) => `${k}->${v}`).join(", "));
    console.log("Карта недель (первые 40):", [...r.gospelWeekMap.entries()].slice(0, 40).map(([k, v]) => `${k}->${v}`).join(", "));
});

// Генерация черновиков постов для Telegram/VK на основе проложных чтений (song6) дня.
// Запускается по крону ежедневно, готовит черновики вперёд (по умолчанию на 3 дня),
// чтобы оставалось время на ручную проверку перед публикацией.
//
// Запуск (см. также раздел об автопостинге в docs/archive/product.md):
//   npm run channel-posts:generate
//   npm run channel-posts:generate -- --days-ahead=5
//   npm run channel-posts:generate -- --from=2026-08-20
//
// Логика выбора:
//   - память дня = day.song6.items (проложные чтения), берутся только первые две, если их больше;
//   - 1 память -> один пост в 9:00 в день D;
//   - 2 памяти -> первая публикуется в 18:00 накануне (D-1), вторая в 9:00 в день D
//     (вечерняя служба уже относится к следующему по Уставу дню);
//   - если черновик для (dayAlias, slot, sourceTextId) уже существует — не трогаем его,
//     чтобы не затереть уже отредактированные/подтверждённые/опубликованные посты.
//
// Старый/новый стиль: alias дня в базе (july-09 и т.п.) — старый стиль (по Уставу), а дата
// отправки (scheduledAt) должна быть в новом стиле (реальное календарное время публикации).
// Поэтому для выбора alias дата публикации переводится в старый стиль (-13 дней), а сама
// scheduledAt остаётся в новом стиле как есть — см. toOldStyle/getTodayDate в @/utils/dates.ts,
// где используется тот же сдвиг для "сегодня" на сайте.
import "@/scripts/lib/env";
import { generationOptions, generateChannelPosts } from "@/lib/channelPosts/generate";

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--"))
    .map(a => a.slice(2).split("=")));
Promise.resolve().then(() => generateChannelPosts(generationOptions({ from: args.from, daysAhead: args["days-ahead"] })))
    .then(result => { console.log(`Готово. Создано: ${result.created}`); process.exit(0); })
    .catch(error => { console.error(error); process.exit(1); });

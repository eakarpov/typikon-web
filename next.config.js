/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }
    return config;
  },
  async headers() {
    // robots.txt только просит не обходить адрес — он не мешает попасть в выдачу
    // по чужой ссылке. Заголовок запрещает уже индексацию, и его читают все
    // поисковики. Разделы те же, что закрыты в src/app/robots.ts.
    const noIndex = [
      // :path+, а не :path*: страница описания /api сама по себе открыта и в карте сайта.
      "/api/:path+",
      "/admin",
      "/admin/:path+",
      "/profile",
      "/segodnya",
      "/settings",
      "/notes",
      "/texting",
      "/texting/:path+",
      "/search",
      "/calculator/:date",
      // Рамка виджета: её содержимое уже есть на своих страницах, и в выдаче
      // она была бы их двойником без шапки.
      "/embed/:path*",
    ].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));

    // Общие заголовки безопасности. Полной CSP здесь нет нарочно: вход тянет
    // сценарии Google и Telegram, и политика для них — отдельная работа с
    // проверкой в браузере. `frame-ancestors` от неё не зависит и ставится сразу:
    // админку и профиль нельзя поместить в чужую рамку. Рамка виджета (/embed)
    // исключена — она для чужих сайтов и сделана, свой заголовок ставит сама.
    const security = [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];

    return [
      ...security,
      ...noIndex,
      {
        source: "/login",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig

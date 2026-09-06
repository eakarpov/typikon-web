/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
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

    return [
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

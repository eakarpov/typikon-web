import '../styles/globals.css';
import React from "react";
import CountMeta from "@/app/meta/CountMeta";
import {settingsBootScript} from "@/lib/settings/reading";
import {Metadata, Viewport} from "next";
import CommonMeta from "@/app/components/CommonMeta";
import {myFont} from "@/utils/font";
import NavMenu from "@/app/NavMenu";
import StoreProvider from "@/app/StoreProvider";
import AuthorizeChecker from "@/app/AuthorizeChecker";
import Script from "next/script";
import TelegramLoginRemover from "@/app/TelegramLoginRemover";
import SessionLoader from "@/app/SessionLoader";
import ServiceWorkerRegistrar from "@/app/ServiceWorkerRegistrar";

export const viewport: Viewport = {
    initialScale: 1,
    width: 'device-width',
    // Цвет строки состояния в установленном приложении — фон иконки приложения.
    themeColor: '#880015',
}

export const metadata: Metadata = {
    // Канонический адрес сайта — с www: голый домен отдаёт 301 туда же. Без этой
    // пары строк тега canonical на страницах не было вовсе, и обходчик сам решал,
    // какой из двух адресов считать настоящим.
    //
    // "./" разрешается относительно текущего маршрута, то есть каждая страница
    // получает свой canonical, а не общий на весь сайт. Страницы, задающие свою
    // metadata, это наследуют: поля метаданных сливаются, и alternates ни одна из
    // них не переопределяет.
    metadataBase: new URL("https://www.typikon.su"),
    alternates: { canonical: "./" },
    title: "Уставные чтения",
    description: 'Последование уставных чтений по Типикону для корпуса церковнославянских текстов.',
    keywords: "уставные чтения, устав, типикон, богослужебные указания, триодь, минея, пролог, златоуст, торжественник, учительное евангелие, толковый апостол",
    // iOS манифест не читает — иконку домашнего экрана берёт отсюда.
    appleWebApp: {
        capable: true,
        title: "Чтения",
        statusBarStyle: "default",
    },
    icons: {
        apple: "/icons/icon-180.png",
    },
    openGraph: {
        title: 'Уставные чтения',
        description: 'Последование уставных чтений по Типикону для корпуса церковнославянских текстов.',
        images: "https://www.typikon.ru/logo.png",
        siteName: "Уставные чтения Типикона РПЦ"
    },
}

// Layout сознательно не читает cookies и не ходит в базу: любое обращение к
// сессии здесь делает динамическим рендер всех страниц сайта. Сессию забирает
// SessionLoader отдельным запросом уже на клиенте.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
    return (
    <html lang="ru">
      <head>
          {/*
            * Настройки чтения раскладываются по CSS-переменным до первой отрисовки.
            * Раньше это делал useEffect уже после гидратации, и выбравший тёмный фон
            * на каждой полной загрузке видел светлую вспышку. beforeInteractive здесь
            * не годится: Next выносит такой Script в конец <head> уже после стилей,
            * но выполняет его сам — обычный тег надёжнее и короче.
            */}
          <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
      </head>
      <body>
          <CommonMeta />
          <noscript>
              <div>
                  <img src="https://mc.yandex.ru/watch/92252601" style={{ position: "absolute", left: "-9999px" }} alt="" />
              </div>
          </noscript>
          <CountMeta />
          <ServiceWorkerRegistrar />
          <TelegramLoginRemover />
          <StoreProvider>
              <>
                  <SessionLoader />
                  <AuthorizeChecker
                      vkApp={parseInt(process.env.VK_APP!)}
                      codeVerifier={process.env.CODE_VERIFIER!}
                  />
                  <nav className="border-b-2 w-full overflow-scroll">
                      <div className={myFont.variable}>
                          <NavMenu
                              showButton={process.env.SHOW_LOGIN_BUTTON}
                              showAdmin={process.env.SHOW_ADMIN}
                              isDevelopment={process.env.NODE_ENV === "development"}
                          />
                      </div>
                  </nav>
                  <div className="container mx-auto px-4">
                      {children}
                  </div>
              </>
          </StoreProvider>
      </body>
    </html>
  )
}

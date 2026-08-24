import '../styles/globals.css';
import React from "react";
import CountMeta from "@/app/meta/CountMeta";
import InitiateUserSettings from './components/settings/InitiateUserSettings';
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
    // Цвет строки состояния в установленном приложении — тот же, что в манифесте.
    themeColor: '#7c2d12',
}

export const metadata: Metadata = {
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
      <body>
          <CommonMeta />
          <noscript>
              <div>
                  <img src="https://mc.yandex.ru/watch/92252601" style={{ position: "absolute", left: "-9999px" }} alt="" />
              </div>
          </noscript>
          <CountMeta />
          <ServiceWorkerRegistrar />
          <InitiateUserSettings />
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

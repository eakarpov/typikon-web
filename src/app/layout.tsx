import '../styles/globals.css';
import React from "react";
import CountMeta from "@/app/meta/CountMeta";
import InitiateUserSettings from './components/settings/InitiateUserSettings';
import {Metadata, Viewport} from "next";
import CommonMeta from "@/app/components/CommonMeta";
import {myFont} from "@/utils/font";
import NavMenu from "@/app/NavMenu";
import StoreProvider from "@/app/StoreProvider";
import {verifySession} from "@/lib/authorize/authorization";
import AuthorizeChecker from "@/app/AuthorizeChecker";
import {getItem} from "@/app/profile/api";

export const viewport: Viewport = {
    initialScale: 1,
    width: 'device-width'
}

export const metadata: Metadata = {
    title: "Уставные чтения",
    description: 'Последование уставных чтений по Типикону для корпуса церковнославянских текстов.',
    keywords: "уставные чтения, устав, типикон, богослужебные указания, триодь, минея, пролог, златоуст, торжественник, учительное евангелие, толковый апостол",
    openGraph: {
        title: 'Уставные чтения',
        description: 'Последование уставных чтений по Типикону для корпуса церковнославянских текстов.',
        images: "https://www.typikon.ru/logo.png",
        siteName: "Уставные чтения Типикона РПЦ"
    },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const session = await verifySession();
    let item;
    if (session.isAuth) {
       item = await getItem(session.userId as string);
    }
    // в корне приложения проверять авторизованы ли мы где-то, если да, подтягивать инфу в меню и разрешения давать на фичи
    return (
    <html lang="en">
      <body>
          <CommonMeta />
          <noscript>
              <div>
                  <img src="https://mc.yandex.ru/watch/92252601" style={{ position: "absolute", left: "-9999px" }} alt="" />
              </div>
          </noscript>
          <CountMeta />
          <InitiateUserSettings />
          <StoreProvider>
              <>
                  <AuthorizeChecker
                      vkApp={parseInt(process.env.VK_APP!)}
                      codeVerifier={process.env.CODE_VERIFIER!}
                  />
                  <nav className="border-b-2 w-full overflow-scroll">
                      <div className={myFont.variable}>
                          <NavMenu
                              showButton={process.env.SHOW_LOGIN_BUTTON}
                              showAdmin={process.env.SHOW_ADMIN}
                              session={session}
                              user={item}
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

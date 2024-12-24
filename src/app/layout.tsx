import '../styles/globals.css';
import CountMeta from "@/app/meta/CountMeta";
import InitiateUserSettings from './components/settings/InitiateUserSettings';
import {Metadata, Viewport} from "next";
import CommonMeta from "@/app/components/CommonMeta";
import {myFont} from "@/utils/font";
import NavMenu from "@/app/NavMenu";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
          <nav className="border-b-2 w-full overflow-scroll">
              <div className={myFont.variable}>
                <NavMenu />
              </div>
          </nav>
          <div className="container mx-auto px-4">
              {children}
          </div>
      </body>
    </html>
  )
}

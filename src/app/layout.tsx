import '../styles/globals.css';
import Link from "next/link";
import {InformationCircleIcon, EnvelopeIcon, MagnifyingGlassIcon, Cog6ToothIcon} from "@heroicons/react/20/solid";
import CountMeta from "@/app/meta/CountMeta";
import InitiateUserSettings from './components/settings/InitiateUserSettings';
import {Metadata, Viewport} from "next";
import CommonMeta from "@/app/components/CommonMeta";

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
        image: "https://www.typikon.ru/logo.png",
        site_name: "Уставные чтения Типикона РПЦ"
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
              <div className="container mx-auto px-4 flex flex-row items-baseline">
                  <Link href="/" className="text-lg mr-3 font-bold min-w-fit">
                      Уставные чтения
                  </Link>
                  <div className="flex flex-row space-x-4">
                      <Link href="/penticostarion" className="cursor-pointer min-w-fit">
                          Цветная триодь
                      </Link>
                      <Link href="/triodion" className="cursor-pointer min-w-fit">
                          Постная триодь
                      </Link>
                      <Link href="/rest-readings" className="cursor-pointer min-w-fit text-stone-400">
                          Вне триодного цикла
                      </Link>
                      <Link href="/calendar" className="cursor-pointer min-w-fit">
                          Календарные чтения
                      </Link>
                      <Link href="/calculator" className="cursor-pointer min-w-fit">
                          Чтения на конкретный день
                      </Link>
                      <Link href="/library" className="cursor-pointer min-w-fit">
                          Библиотека
                      </Link>
                      {process.env.SHOW_ADMIN && (
                          <Link href="/admin" className="cursor-pointer min-w-fit">
                              Админка
                          </Link>
                      )}
                      <Link
                          href="/search"
                          className="cursor-pointer min-w-fit flex items-center"
                      >
                          <MagnifyingGlassIcon className="w-4 h-4" />
                      </Link>
                      <Link
                          href="/contact"
                          className="cursor-pointer min-w-fit flex items-center"
                      >
                          <EnvelopeIcon className="w-4 h-4" />
                      </Link>
                      <Link
                          href="/about"
                          className="cursor-pointer min-w-fit flex items-center"
                      >
                          <InformationCircleIcon className="w-4 h-4" />
                      </Link>
                      <Link
                          href="/settings"
                          className="cursor-pointer min-w-fit flex items-center"
                      >
                          <Cog6ToothIcon className="w-4 h-4" />
                      </Link>
                  </div>
              </div>
          </nav>
          <div className="container mx-auto px-4">
              {children}
          </div>
      </body>
    </html>
  )
}

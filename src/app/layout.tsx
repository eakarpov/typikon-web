import '../styles/globals.css';
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
    return (
    <html lang="en">
      <head />
      <body>
          <nav className="border-b-2">
              <div className="container mx-auto px-4 flex flex-row items-baseline">
                  <Link href="/" className="text-lg mr-3 font-bold">
                      Уставные чтения
                  </Link>
                  <div className="flex flex-row space-x-4">
                      <Link href="/penticostarion" className="cursor-pointer">
                          Цветная триодь
                      </Link>
                      <Link href="/triodion" className="cursor-pointer">
                          Постная триодь
                      </Link>
                      <Link href="/rest-readings" className="cursor-pointer">
                          Вне триодного цикла
                      </Link>
                      <Link href="/reading-calculator" className="cursor-pointer">
                          Чтения на конкретный день
                      </Link>
                      <Link href="/library" className="cursor-pointer">
                          Библиотека
                      </Link>
                      {process.env.SHOW_ADMIN && (
                          <Link href="/admin" className="cursor-pointer">
                              Админка
                          </Link>
                      )}
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

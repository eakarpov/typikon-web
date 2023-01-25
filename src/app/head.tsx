import { analyticsConnector } from "@/utils/google";

export default function Head() {
  return (
    <>
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0"></script>
      <script>{analyticsConnector}</script>
      <title>Уставные чтения</title>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="description" content="Последование уставных чтений по Типикону для корпуса церковнославянских текстов." />
      <link rel="icon" href="/favicon.ico" />
    </>
  )
}

import { Suspense } from "react";
import Client from "./Client";
export const metadata = { title: "Библиотека для вдумчивого чтения" };
export default function Page() {
  return (
    <Suspense fallback={<p>Открываю библиотеку…</p>}>
      <Client />
    </Suspense>
  );
}

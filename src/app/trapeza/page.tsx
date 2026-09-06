import { redirect } from "next/navigation";
import { todayCivil } from "@/lib/trapeza/core";

// Вход в раздел: сегодняшний день своим адресом.
//
// Редирект, а не отрисовка на месте: у дня должен быть один адрес — им
// делятся, его кладут в закладки, на него ссылается страница чтений. Показав
// «сегодня» ещё и здесь, мы завели бы вторую страницу того же дня, и через
// сутки ссылка на неё означала бы уже другой день.
export const dynamic = "force-dynamic";

const Trapeza = () => redirect(`/trapeza/${todayCivil()}`);

export default Trapeza;

import { redirect } from "next/navigation";

// Постоянный адрес политики ведёт на тот же документ, что скачивает приложение.
export default function PrivacyPage() {
    redirect("/privacy-policy.pdf");
}

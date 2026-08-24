'use client';
import React from "react";
import UserNotesList from "@/app/profile/UserNotesList";
import ApiTokens from "@/app/profile/ApiTokens";
import type { TokenView } from "@/app/api/api-tokens/service";

// Правая колонка профиля: заметки и ключи API.
//
// Вкладками, а не списком друг под другом: обе части — длинные перечни, и на широком
// экране страница из-за них уезжала вниз, хотя место справа от полей пустовало.
// Ниже lg колонки складываются в одну, и вкладки остаются полезны сами по себе.

type Tab = "notes" | "tokens";

const SidePanel = ({ notes, tokens }: { notes: any[]; tokens: TokenView[] }) => {
    const [tab, setTab] = React.useState<Tab>("notes");

    const tabClass = (value: Tab) =>
        `px-3 py-2 border-b-2 -mb-0.5 ${
            tab === value
                ? "border-amber-800 font-bold text-amber-900"
                : "border-transparent text-slate-600 hover:text-slate-900"
        }`;

    return (
        <div className="flex flex-col">
            <div className="flex flex-row border-b-2 border-slate-200" role="tablist">
                <button
                    role="tab"
                    aria-selected={tab === "notes"}
                    className={tabClass("notes")}
                    onClick={() => setTab("notes")}
                >
                    Мои заметки{notes.length > 0 && ` (${notes.length})`}
                </button>
                <button
                    role="tab"
                    aria-selected={tab === "tokens"}
                    className={tabClass("tokens")}
                    onClick={() => setTab("tokens")}
                >
                    API токены{tokens.length > 0 && ` (${tokens.length})`}
                </button>
            </div>

            <div className="pt-3" role="tabpanel">
                {tab === "notes" ? <UserNotesList items={notes} /> : <ApiTokens items={tokens} />}
            </div>
        </div>
    );
};

export default SidePanel;

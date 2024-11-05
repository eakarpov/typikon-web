export interface IPartItem {
    cite: string;
    textId: string;
    paschal: boolean;
    description: string;
}

export interface WithItems {
    items: IPartItem[];
}

export interface WithParts {
    vigil: WithItems|null;
    kathisma1: WithItems|null;
    kathisma2: WithItems|null;
    kathisma3: WithItems|null;
    ipakoi: WithItems|null;
    polyeleos: WithItems|null;
    song3: WithItems|null;
    song6: WithItems|null;
    before1: WithItems|null;
    panagia: WithItems|null;
    h1: WithItems|null;
    h3: WithItems|null;
    h6: WithItems|null;
    h9: WithItems|null;
    vespersProkimenon: WithItems|null;
    apolutikaTroparia: WithItems|null;
}
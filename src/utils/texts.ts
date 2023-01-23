import {Nullable} from "mongodb/src/mongo_types";

export enum TextType {
    VIGIL= "vigil",
    KATHISMA_1= "kathisma1",
    KATHISMA_2= "kathisma2",
    KATHISMA_3= "kathisma3",
    IPAKOI= "ipakoi",
    POLYELEOS= "polyeleos",
    SONG_3= "song3",
    SONG_6= "song6",
    BEFORE_1h= "before1h",
    PANAGIA= "panagia",
}

export const footNotesToArray = (footNotesText: string): Nullable<string>[] =>
  footNotesText.split("\n").map(footNotesRow => footNotesRow.split(" ")[1]);

export const valueTitle = (valueName: TextType) => {
  switch (valueName) {
      case TextType.VIGIL:
          return "На всенощном бдении перед шестопсалмием";
      case TextType.KATHISMA_1:
          return "По первой кафизме";
      case TextType.KATHISMA_2:
          return "По второй кафизме";
      case TextType.KATHISMA_3:
          return "По третьей кафизме";
      case TextType.IPAKOI:
          return "По ипакои";
      case TextType.POLYELEOS:
          return "По полиелее";
      case TextType.SONG_3:
          return "По третьей песне";
      case TextType.SONG_6:
          return "По шестой песне";
      case TextType.BEFORE_1h:
          return "Перед первым часом";
      case TextType.PANAGIA:
          return "На панагии";
  }
};

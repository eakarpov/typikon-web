import { parse } from 'csv-parse';
import * as fs from "fs";
import * as path from "path";
import clientPromise from "./mongodb.js";
import {fileURLToPath} from "url";

const mapper = (letter) => {
  switch (letter) {
      case "ѣ":
          return "е";
      case "ѕ":
          return "з";
      case "ᲂу":
          return "у";
      case "ꙋ":
          return "у";
      case "ѡ":
          return "о";
      case "і":
          return "и";
      // case "ѵ": // надо как-то решить проблему с ижицей
      //     return "в";
      case "ѱ":
          return "пс";
      case "ѯ":
          return "кс";
      case "́":
          return "";
      case "ѳ":
          return "ф";
      default:
          return letter;
  }
};

const transform = (el) => {
  const word = el?.split("").map(mapper).join("") || "";
  const wordWithoutEr = word.replace(/ъ$/, "");
  if (wordWithoutEr.includes("ѵ")) { // есть ижица, надо понять - это и, или в.
      // ав, ев - иначе и - первый подход. Ограничения: Только 1 ижица в слове
      if (wordWithoutEr.includes("аѵ") || wordWithoutEr.includes("еѵ")) {
          return wordWithoutEr.replace(/ѵ/, "в");
      }
     return wordWithoutEr.replace(/ѵ/, "и");;
  }
  return wordWithoutEr;
};

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const csvPromise = new Promise((resolve) => {
    fs.readFile(path.resolve(__dirname, '../../script-data/data.csv'), (err, fileData) => {
        parse(fileData, {
            relaxColumnCount: true,
        }, function(err, rows) {
            resolve(rows) ;
        });
    });
});

const getPairs = (initialArray) => initialArray.reduce((result, value, index, array) => {
    if (index % 2 === 0)
        result.push(array.slice(index, index + 2));
    return result;
}, []);

const parseDictionary = async () => {
    const rows = await csvPromise;
    const client = await clientPromise;
    const db = client.db("typikon-csl");

    await db
        .collection("lexems")
        .deleteMany({});
    await db.collection("lexems").insertMany(rows.slice(1).map((el) => ({
        name: el[1],
        search: transform(el[1]),
        scheme: el[0],
        properties: el[2],
        forms: getPairs(el.slice(3)).map(el => ({
            value: el[0],
            properties: el[1],
        })),
    })))
};

export default parseDictionary;

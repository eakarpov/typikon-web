import parseDictionary from "./dictionary-load.js";

parseDictionary().then(() => {
  process.exit();
});

import { importBaseline } from "@/features/vocabulary";

const language = process.argv[2];
if (language === undefined) {
  console.error("言語コードを指定してください。例：npm run import-baseline -- en");
  process.exit(1);
}

const result = importBaseline(language);
if (result.activeWordsImported) {
  console.log(`${language} のベースラインを取り込みました。手札語彙 ${result.activeWordCount} 語、ノーカン語彙 ${result.uncountedWordCount} 語。`);
} else {
  console.log(`${language} の手札語彙は取り込み済みなので、ノーカン語彙 ${result.uncountedWordCount} 語だけを取り込み直しました。`);
}

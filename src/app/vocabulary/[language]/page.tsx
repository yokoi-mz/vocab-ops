import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getVocabulary, listImportedLanguages, type VocabWord } from "@/features/vocabulary";

export default async function VocabularyPage({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  await connection();
  if (!listImportedLanguages().includes(language)) {
    notFound();
  }

  const { activeVocab, uncountedVocab } = getVocabulary(language);

  return (
    <main>
      <h1>語彙一覧（{language}）</h1>

      <h2>手札語彙（{activeVocab.length} 語）</h2>
      {groupByPartOfSpeech(activeVocab).map(([partOfSpeech, words]) => (
        <section key={partOfSpeech}>
          <h3>{partOfSpeech}（{words.length}）</h3>
          <table>
            <tbody>
              {words.map((word) => (
                <tr key={word.id}>
                  <td>{word.lemma}</td>
                  <td>{word.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <h2>ノーカン語彙（{uncountedVocab.length} 語）</h2>
      <table>
        <tbody>
          {groupByPartOfSpeech(uncountedVocab).map(([kind, words]) => (
            <tr key={kind}>
              <td>{kind}</td>
              <td>{words.map((word) => word.lemma).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function groupByPartOfSpeech(words: VocabWord[]): [string, VocabWord[]][] {
  const groups = new Map<string, VocabWord[]>();
  for (const word of words) {
    const key = word.partOfSpeech ?? "その他";
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }
  return [...groups.entries()];
}

export type BaselineWord = {
  lemma: string;
  meaning: string | null;
  partOfSpeech: string;
};

export type Baseline = {
  activeWords: BaselineWord[];
  uncountedWords: BaselineWord[];
};

export function parseBaseline(markdown: string): Baseline {
  const baseline: Baseline = { activeWords: [], uncountedWords: [] };
  let section: "active" | "uncounted" | null = null;
  let partOfSpeech = "";

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      section = line.startsWith("## 手札語彙") ? "active"
        : line.startsWith("## ノーカン語彙") ? "uncounted"
        : null;
      continue;
    }
    if (line.startsWith("### ")) {
      partOfSpeech = line.slice(4).replace(/（\d+）$/, "");
      continue;
    }
    if (section === null || !isTableRow(line)) {
      continue;
    }

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (section === "active") {
      const [lemma, meaning] = cells;
      baseline.activeWords.push({ lemma, meaning, partOfSpeech });
    } else {
      const [kind, words] = cells;
      for (const lemma of words.split(",")) {
        baseline.uncountedWords.push({ lemma: lemma.trim(), meaning: null, partOfSpeech: kind });
      }
    }
  }

  return baseline;
}

function isTableRow(line: string): boolean {
  if (!line.startsWith("|")) {
    return false;
  }
  const firstCell = line.split("|")[1].trim();
  return firstCell !== "語" && firstCell !== "種類" && !/^:?-+:?$/.test(firstCell);
}

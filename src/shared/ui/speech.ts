// ブラウザの読み上げ（Web Speech API）。ブラウザ側の部品からだけ使う。業務の知識は持たない。

// macOS の遊び用の声（Bells、Zarvox など）は使わない
const jokeVoicePattern = /(bad news|good news|bells|boing|bubbles|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bahh|albert|cellos)/i;
// macOS の Eloquence の声（Eddy、Flo、Grandma など）は、ほかに声がないときだけ使う。
// 言語によっては、これしか入っていないことがある（フランス語など）ため、除外はしない
const eloquenceVoicePattern = /(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)/i;

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace("_", "-");
}

// その言語（"it-IT" なら "it" で始まるもの）で使える声を、おすすめの順に並べる。
// 地域が合う声 → 高品質（Premium / Enhanced / Natural）→ Google → 端末内蔵 の順。Eloquence の声は最後。
export function listVoices(lang: string): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  const target = normalizeLang(lang);
  const language = target.split("-")[0];
  const score = (voice: SpeechSynthesisVoice) =>
    (normalizeLang(voice.lang) === target ? 8 : 0) +
    (/premium|enhanced|natural/i.test(voice.name) ? 4 : 0) +
    (/google/i.test(voice.name) ? 2 : 0) +
    (voice.localService ? 1 : 0) -
    (eloquenceVoicePattern.test(voice.name) ? 20 : 0);
  const sorted = window.speechSynthesis
    .getVoices()
    .filter((voice) => normalizeLang(voice.lang).startsWith(language) && !jokeVoicePattern.test(voice.name))
    .sort((a, b) => score(b) - score(a));
  // ブラウザによっては、同じ名前の声が2回入っていることがある（例：Moira）。声は名前で選ぶので、名前ごとに1つにする
  return sorted.filter((voice, index) => sorted.findIndex((other) => other.name === voice.name) === index);
}

// 読み上げる。voiceName があればその声を、なければ（または見つからなければ）おすすめの順の最初の声を使う。
export function speak(text: string, lang: string, voiceName: string | null): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  const voices = listVoices(lang);
  const voice = voices.find((candidate) => candidate.name === voiceName) ?? voices[0];
  if (voice !== undefined) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}

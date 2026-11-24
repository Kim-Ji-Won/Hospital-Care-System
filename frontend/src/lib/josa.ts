/**
 * 받침에 맞춰 조사를 붙입니다: josa("진료과", "이/가") → "진료과가", josa("'김서'", "으로/로") → "'김서'로".
 * 마지막 글자가 한글이 아니면(영문·숫자) 받침을 알 수 없어 "이(가)", "(으)로"처럼 둘 다 적습니다.
 */
type Pair = "이/가" | "을/를" | "은/는" | "으로/로";

export function josa(word: string, pair: Pair): string {
  const [withFinal, withoutFinal] = pair.split("/");
  const last = word.replace(/['"‘’“”)\]\s]+$/, "").slice(-1);
  const code = last ? last.charCodeAt(0) - 0xac00 : -1;
  if (code < 0 || code > 11171) return pair === "으로/로" ? `${word}(으)로` : `${word}${withFinal}(${withoutFinal})`;
  const final = code % 28;
  // "으로"는 받침 ㄹ 뒤에서도 "로"(서울로)
  const hasFinal = pair === "으로/로" ? final !== 0 && final !== 8 : final !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

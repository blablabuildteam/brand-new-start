/** Fake-bold LinkedIn-letters (𝗠𝗲𝗱𝗶𝗼𝗿) en sterretjes → gewone tekst, voor in de lijst. */
export function plainLinkedIn(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[★☆✦✧•▪■□]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\| ?/g, " · ")
    .trim();
}

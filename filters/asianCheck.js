// filters/asianCheck.js

// ❌ 欧米・白人メインっぽいワード（弾く候補）
const westernBanList = [
  "blonde",
  "latina",
  "ebony",
  "british",
  "german",
  "russian",
  "euro",
  "finnish",
  "swedish",
  "french",
  "italian",
  "spanish",
  "milf",
  "stepmom",
  "step mom",
  "step sister",
  "stepsis",
  "bbw",
  "redhead",
  "ginger",
  "irish",
  "caucasian",
];

// ✔ アジア確定ワード（優先）
const asianAllowList = [
  "asian",
  "japanese",
  "japan",
  "jav",
  "korean",
  "korea",
  "chinese",
  "china",
  "thai",
  "vietnam",
  "filipina",
  "pinay",
  "uncensored",
];

// 日本語が混じっているかどうか（日本語タイトルはほぼアジア人とみなす）
const japaneseCharRegex = /[一-龥ぁ-ゔァ-ヴー々〆〤]/;

/**
 * タイトルから「アジアっぽいかどうか」を判定
 * true → アジア系として採用
 * false → 採用しない（欧米っぽい or 判定不能）
 */
export function isAsianTitle(title = "") {
  const lower = title.toLowerCase();

  // 1️⃣ 日本語が入ってたらアジア扱い
  if (japaneseCharRegex.test(title)) {
    return true;
  }

  // 2️⃣ アジア確定ワードが入ってたら優先して true
  if (asianAllowList.some((k) => lower.includes(k))) {
    return true;
  }

  // 3️⃣ 欧米ワードが入ってたら弾く
  if (westernBanList.some((k) => lower.includes(k))) {
    return false;
  }

  // 4️⃣ どちらとも言えないタイトル → 今は「厳しめ」に false
  return false;
}

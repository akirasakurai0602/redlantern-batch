import "dotenv/config";
import { supabase } from "./supabase.js";
import { scrapeXVideosPage } from "./scrapers/xvideos.js";
import { scrapeSpankbangPage } from "./scrapers/spankbang.js";

/* -------------------------------------------------------
   スパム除外ロジック（広告・釣り動画フィルタ）
-------------------------------------------------------- */

// タイトルに含まれていたら除外するNGワード
const NG_TITLE_KEYWORDS = [
  "free",
  "join",
  "signup",
  "earn",
  "fuckbook",
  "snapchat",
  "onlyfans",
  "bet",
  "casino",
  "telegram",
  "make money",
];

// スパム判定関数（trueなら除外）
function isSpam(item) {
  const title = item.title?.toLowerCase() ?? "";

  // ① タイトルNGワード
  if (NG_TITLE_KEYWORDS.some((k) => title.includes(k))) {
    return true;
  }

  // ② サムネイルURLが短すぎる/不正
  if (!item.thumbnail_url || item.thumbnail_url.length < 20) {
    return true;
  }

  // ③ 動画が短すぎる（5秒未満 → ほぼ広告）
  if (item.duration) {
    const parts = item.duration.split(":").map(Number);
    const sec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    if (sec > 0 && sec < 5) return true;
  }

  return false;
}

/* -------------------------------------------------------
   メイン処理（スクレイプ → スパム除外 → upsert）
-------------------------------------------------------- */

async function main() {
  console.log("▶ Fetching xvideos...");
  const xv = await scrapeXVideosPage();

  console.log("▶ Fetching spankbang...");
  const sb = await scrapeSpankbangPage();

  // 結合
  let list = [...xv, ...sb];

  // 🧹 スパム除外
  const beforeCount = list.length;
  list = list.filter((item) => !isSpam(item));
  const afterCount = list.length;

  console.log(`🧹 Spam filter: ${beforeCount} → ${afterCount} items`);

  // upsert
  for (const item of list) {
    const { error } = await supabase
      .from("articles")
      .upsert(item, { onConflict: "url" });

    if (error) {
      if (error.code === "23505") continue;
      console.error(error);
    }
  }

  console.log("✅ DONE. inserted:", list.length);
}

main();

import "dotenv/config";
import { supabase } from "./supabase.js";
import { scrapeXVideosPage } from "./scrapers/xvideos.js";
import { scrapeSpankbangPage } from "./scrapers/spankbang.js";
import { isAsianTitle } from "./filters/asianCheck.js";

/* -------------------------------------------------------
   スパム除外ロジック（広告・釣り動画フィルタ）
-------------------------------------------------------- */

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

function isSpam(item) {
  const title = item.title?.toLowerCase() ?? "";

  // ① タイトルにNGワード
  if (NG_TITLE_KEYWORDS.some((k) => title.includes(k))) return true;

  // ② サムネイルURLが短い＝広告の可能性
  if (!item.thumbnail_url || item.thumbnail_url.length < 20) return true;

  // ③ 短すぎる動画（5秒未満）
  if (item.duration) {
    const parts = item.duration.split(":").map(Number);
    const sec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    if (sec > 0 && sec < 5) return true;
  }

  return false;
}

/* -------------------------------------------------------
   メイン処理（スクレイプ → フィルタ → upsert）
-------------------------------------------------------- */

async function main() {
  console.log("▶ Fetching xvideos...");
  const xv = await scrapeXVideosPage();

  console.log("▶ Fetching spankbang...");
  const sb = await scrapeSpankbangPage();

  // 結合
  let list = [...xv, ...sb];
  console.log(`▶ Raw scraped: ${list.length} items`);

  /* -------------------------------
      🧹 Step1: スパム除外
  --------------------------------*/
  const beforeSpam = list.length;
  list = list.filter((item) => !isSpam(item));
  console.log(`🧹 Spam filter: ${beforeSpam} → ${list.length}`);

  /* -------------------------------
      🈲 Step2: アジア判定フィルタ
  --------------------------------*/
  const beforeAsian = list.length;
  list = list.filter((item) => isAsianTitle(item.title));
  console.log(`🈯 Asian filter: ${beforeAsian} → ${list.length}`);

  /* -------------------------------
      💾 Step3: Supabase upsert
  --------------------------------*/
  for (const item of list) {
    const { error } = await supabase
      .from("articles")
      .upsert(item, { onConflict: "url" });

    if (error) {
      if (error.code === "23505") continue;
      console.error("Supabase upsert error:", error);
    }
  }

  console.log("✅ DONE. Inserted/Updated:", list.length);
}

main();

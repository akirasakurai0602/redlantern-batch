import "dotenv/config";
import { supabase } from "./supabase.js";
import { scrapeXVideosPage } from "./scrapers/xvideos.js";
import { scrapeSpankbangPage } from "./scrapers/spankbang.js";
import { isAsianTitle } from "./filters/asianCheck.js";

/* -------------------------------------------------------
   スパム除外ロジック
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

  if (NG_TITLE_KEYWORDS.some((k) => title.includes(k))) return true;

  if (!item.thumbnail_url || item.thumbnail_url.length < 20) return true;

  if (item.duration) {
    const parts = item.duration.split(":").map(Number);
    const sec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
    if (sec > 0 && sec < 5) return true;
  }

  return false;
}

/* -------------------------------------------------------
   メイン処理
-------------------------------------------------------- */

async function main() {
  console.log("=====================================");
  console.log("🚀 Scraping Batch Start");
  console.log("=====================================");

  /* -------------------------------
      Step0: DBの既存URLロード
  --------------------------------*/
  console.log("📌 Loading existing URLs…");
  const { data: existingRows, error: exErr } = await supabase
    .from("articles")
    .select("url");

  if (exErr) {
    console.error("❌ DB load error:", exErr);
    return;
  }

  const existing = new Set(existingRows.map((r) => r.url));
  console.log(`✔ Existing URLs loaded: ${existing.size}`);

  /* -------------------------------
      Step1: スクレイピング
  --------------------------------*/
  console.log("▶ Fetching xvideos...");
  const xv = await scrapeXVideosPage();

  console.log("▶ Fetching spankbang...");
  const sb = await scrapeSpankbangPage();

  let list = [...xv, ...sb];
  console.log(`📌 Raw scraped: ${list.length} items`);

  /* -------------------------------
      Step2: スパム除外
  --------------------------------*/
  const beforeSpam = list.length;
  list = list.filter((item) => !isSpam(item));
  console.log(`🧹 Spam filter: ${beforeSpam} → ${list.length}`);

  /* -------------------------------
      Step3: アジア判定フィルタ
  --------------------------------*/
  const beforeAsian = list.length;
  list = list.filter((item) => isAsianTitle(item.title));
  console.log(`🈯 Asian filter: ${beforeAsian} → ${list.length}`);

  /* -------------------------------
      Step4: DBの既存URL除外（今回の新規）
  --------------------------------*/
  const beforeDup = list.length;
  list = list.filter((item) => !existing.has(item.url));
  console.log(`🚫 Duplicate filter: ${beforeDup} → ${list.length}`);

  /* -------------------------------
      Step5: upsert（新規だけ）
  --------------------------------*/
  let inserted = 0;
  for (const item of list) {
    const { error } = await supabase
      .from("articles")
      .upsert(item, { onConflict: "url" });

    if (!error) inserted++;
  }

  console.log("=====================================");
  console.log(`✔ DONE. Inserted new items: ${inserted}`);
  console.log("=====================================");
}

main();

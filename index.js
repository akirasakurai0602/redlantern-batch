import "dotenv/config";
import { supabase } from "./supabase.js";
import { scrapeXVideosPage } from "./scrapers/xvideos.js";
import { scrapeSpankbangPage } from "./scrapers/spankbang.js";
import { scrapeJavyNowPage } from "./scrapers/javynow.js";
import { isAsianTitle } from "./filters/asianCheck.js";
import { loadFaceModels } from "./models/loadModels.js";
import { isAsianFace } from "./filters/asianCheckAI.js";

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
   🔥 追加：10分未満動画は除外
-------------------------------------------------------- */
function parseDuration(str) {
  if (!str) return 0;
  str = str.toLowerCase().trim();

  // 形式 A: "12:33"
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }

  // 形式 B: "13m" / "13 min"
  if (str.includes("m")) {
    const m = parseInt(str);
    return m * 60;
  }

  // 形式 C: "125" (秒っぽい数字)
  if (/^\d+$/.test(str)) {
    return parseInt(str);
  }

  // 不明
  return 0;
}

function normalizeUrlKey(url) {
  if (!url) return "";
  return url
    .trim()
    .replace(/^https?:\/\//, "") // スキーム削除
    .replace(/\/+$/, "") // 末尾スラッシュ削除
    .toLowerCase();
}

function normalizeTitle(title) {
  return title?.trim().toLowerCase().replace(/\s+/g, " "); // 連続スペース除去
}

function extractVideoId(item) {
  const url = item.url;

  // SpankBang → /12345/video/
  const sb = url.match(/spankbang\.com\/(\w+)\//);
  if (sb) return `spankbang_${sb[1]}`;

  // XVideos → video123456/
  const xv = url.match(/xvideos\.com\/video(\d+)\//);
  if (xv) return `xvideos_${xv[1]}`;

  // JavyNow → video/123456/
  const jn = url.match(/javynow\.com\/video\/(\d+)\//);
  if (jn) return `javynow_${jn[1]}`;

  return null;
}

/* -------------------------------------------------------
   メイン処理
-------------------------------------------------------- */

async function main() {
  console.log("=====================================");
  console.log("🚀 Scraping Batch Start");
  console.log("=====================================");

  /* -------------------------------
      Step0: 顔AIモデルロード
  --------------------------------*/
  console.log("📌 Loading face detection models…");
  await loadFaceModels();

  /* -------------------------------
    Step1: DBの既存URLロード
  --------------------------------*/
  console.log("📌 Loading existing URLs…");
  const { data: existingRows, error: exErr } = await supabase
    .from("articles")
    .select("url, title");

  if (exErr) {
    console.error("❌ DB load error:", exErr);
    return;
  }

  const existingKeySet = new Set(
    existingRows.map((r) => normalizeUrlKey(r.url))
  );

  const existingTitleSet = new Set(
    existingRows.map((r) => normalizeTitle(r.title))
  );

  /* -------------------------------
      Step2: スクレイピング
  --------------------------------*/
  console.log("▶ Fetching xvideos...");
  const xv = await scrapeXVideosPage();

  console.log("▶ Fetching spankbang...");
  const sb = await scrapeSpankbangPage();

  console.log("▶ Fetching JavyNow...");
  const jn = await scrapeJavyNowPage();

  let list = [...xv, ...sb, ...jn];
  console.log(`📌 Raw scraped: ${list.length} items`);

  /* -------------------------------
      Step3: スパム除外
  --------------------------------*/
  const beforeSpam = list.length;
  list = list.filter((item) => !isSpam(item));
  console.log(`🧹 Spam filter: ${beforeSpam} → ${list.length}`);

  /* -------------------------------
      Step4: 10分未満動画除外（今回追加）
  --------------------------------*/
  const beforeDuration = list.length;

  list = list.filter((item) => {
    const sec = parseDuration(item.duration);
    return sec >= 600; // 10分(600秒)以上だけ残す
  });

  console.log(`⏱ Duration filter (<10min): ${beforeDuration} → ${list.length}`);

  /* -------------------------------
    Step5: DB既存URL除外
  --------------------------------*/
  const beforeDup = list.length;

  list = list.filter((item) => {
    const key = normalizeUrlKey(item.url);
    return !existingKeySet.has(key); // 既存でないものだけ残す
  });

  const removedDup = beforeDup - list.length;
  console.log(
    `🚫 Duplicate filter: removed ${removedDup}, remain ${list.length}`
  );

  /* -------------------------------
      Step6: AIアジア顔判定（高精度）
  --------------------------------*/
  console.log("🧠 Running AI Asian-face detection…");
  const finalList = [];

  for (const item of list) {
    try {
      const ok = await isAsianFace(item.thumbnail_url);
      if (!ok) {
        console.log("❌ AI rejected:", item.title);
        continue;
      }

      item.is_asian_ai = true;
      finalList.push(item);
    } catch (err) {
      console.log("AI Asian check error:", err);
    }
  }

  console.log(`✔ AI Asian filter: ${list.length} → ${finalList.length}`);

  /* -------------------------------
    Step7: DB upsert
--------------------------------*/
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const raw of finalList) {
    const item = { ...raw };
    delete item.vid;
    item.video_id = extractVideoId(item);
    if (!item.video_id) continue;

    const keyUrl = normalizeUrlKey(item.url);
    const keyTitle = normalizeTitle(item.title);

    const existsByUrl = existingKeySet.has(keyUrl);
    const existsByTitle = existingTitleSet.has(keyTitle);

    const shouldBeUpdate = existsByUrl || existsByTitle;

    console.log(
      shouldBeUpdate
        ? "UPDATE? → " + item.url + " | " + item.title
        : "INSERT? → " + item.url + " | " + item.title
    );

    const { error } = await supabase
      .from("articles")
      .upsert(item, { onConflict: "video_id" });

    if (error) {
      failed++;
      console.error("Upsert error:", error);
      continue;
    }

    if (shouldBeUpdate) updated++;
    else inserted++;

    // セットを更新（次の比較に使う）
    existingKeySet.add(keyUrl);
    existingTitleSet.add(keyTitle);
  }

  console.log("=====================================");
  console.log(`✔ New Inserts : ${inserted}`);
  console.log(`✔ Updated     : ${updated}`);
  console.log(`✔ Failed      : ${failed}`);
  console.log("=====================================");
}

main();

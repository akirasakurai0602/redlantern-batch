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
    const [m, s] = item.duration.split(":").map(Number);
    const sec = (m || 0) * 60 + (s || 0);
    if (sec > 0 && sec < 5) return true;
  }

  return false;
}

/* -------------------------------------------------------
   🔥 10分未満動画を除外
-------------------------------------------------------- */
function parseDuration(str) {
  if (!str) return 0;
  str = str.toLowerCase().trim();

  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  if (str.includes("m")) {
    return parseInt(str) * 60;
  }
  if (/^\d+$/.test(str)) {
    return parseInt(str);
  }
  return 0;
}

/* -------------------------------------------------------
   正規化
-------------------------------------------------------- */
const normalizeUrlKey = (url) =>
  url
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();

const normalizeTitle = (title) =>
  title?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

/* -------------------------------------------------------
   🔥 video_id 抽出（最重要！）
-------------------------------------------------------- */
function extractVideoId(item) {
  const url = item.url;

  // SpankBang: spankbang.com/VIDEOID/...
  const sb = url.match(/spankbang\.com\/([^\/]+)/);
  if (sb) return `spankbang_${sb[1]}`;

  // XVideos: xvideos.com/video123456/
  const xv = url.match(/xvideos\.com\/video(\d+)\//);
  if (xv) return `xvideos_${xv[1]}`;

  // JavyNow: javynow.com/video/123456/
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
      Step1: 既存 video_id をロード
  --------------------------------*/
  console.log("📌 Loading existing video IDs…");

  const { data: existingRows, error: exErr } = await supabase
    .from("articles")
    .select("video_id, url, title");

  if (exErr) {
    console.error("❌ DB load error:", exErr);
    return;
  }

  const existingVideoIdSet = new Set(
    existingRows.map((r) => r.video_id).filter((x) => x)
  );

  const existingUrlSet = new Set(
    existingRows.map((r) => normalizeUrlKey(r.url))
  );

  const existingTitleSet = new Set(
    existingRows.map((r) => normalizeTitle(r.title))
  );

  console.log(`✔ Existing video_ids: ${existingVideoIdSet.size}`);

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
      Step4: 10分未満除外
  --------------------------------*/
  const beforeDuration = list.length;
  list = list.filter((item) => parseDuration(item.duration) >= 600);
  console.log(`⏱ Duration filter (<10min): ${beforeDuration} → ${list.length}`);

  /* -------------------------------
      Step5: video_id を付与し、null は除外
  --------------------------------*/
  let beforeVid = list.length;
  list = list
    .map((item) => ({ ...item, video_id: extractVideoId(item) }))
    .filter((item) => item.video_id);

  console.log(`🔑 Video ID filter: ${beforeVid} → ${list.length}`);

  /* -------------------------------
      Step6: DBに video_id があるものを完全除外
  --------------------------------*/
  const beforeDup = list.length;
  list = list.filter((item) => !existingVideoIdSet.has(item.video_id));
  const removedDup = beforeDup - list.length;

  console.log(
    `🚫 Duplicate filter by video_id: removed ${removedDup}, remain ${list.length}`
  );

  /* -------------------------------
      Step7: AIアジア顔判定
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
    Step8: DB upsert（video_id基準）
--------------------------------*/
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const item of finalList) {
    delete item.vid;

    // upsert しつつ、結果レコードを取得
    const { data, error } = await supabase
      .from("articles")
      .upsert(item, { onConflict: "video_id" })
      .select(); // ← これが重要！

    if (error || !data || data.length === 0) {
      failed++;
      console.error("Upsert error:", error);
      continue;
    }

    const row = data[0];

    // created_at を基準に insert/update を判定
    const createdAt = new Date(row.created_at).getTime();
    const now = Date.now();

    // 3秒以内なら「今回新規insert」と判定する
    if (Math.abs(now - createdAt) < 3000) {
      inserted++;
      console.log(`🆕 INSERT : ${item.video_id} | ${item.title}`);
    } else {
      updated++;
      console.log(`♻ UPDATE : ${item.video_id} | ${item.title}`);
    }
  }

  console.log("=====================================");
  console.log(`✔ New Inserts (video_id-based) : ${inserted}`);
  console.log(`✔ Updates                      : ${updated}`);
  console.log(`✔ Failed                       : ${failed}`);
  console.log("=====================================");
}

main();

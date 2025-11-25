import "dotenv/config";
import { supabase } from "./supabase.js";

// ---------------------------
// URLのステータス確認（Cloudflare対応 SAFE MODE）
// ---------------------------
async function getStatus(url) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    clearTimeout(id);

    // 本当に死んでるのは 404 / 410 だけ
    if (res.status === 404 || res.status === 410) return "dead";

    // Cloudflare の bot ブロック（生きてる）
    if (res.status === 403 || res.status === 429) return "alive";

    // HEAD が非サポート（405）も alive
    if (res.status === 405) return "alive";

    // 一時的エラー（500〜599）は alive 扱い
    if (res.status >= 500) return "alive";

    // 200〜399 → alive
    return "alive";
  } catch (e) {
    console.warn("⚠ fetch error for:", url, e.message);
    return "unknown"; // 削除しない
  }
}

// ---------------------------
// 本当に死んでるURLだけ削除
// ---------------------------
async function main() {
  console.log("📌 Checking dead URLs (safe mode)...");

  const { data: rows, error } = await supabase
    .from("articles")
    .select("id, url");

  if (error) {
    console.error("DB error:", error);
    return;
  }

  let deleted = 0;

  for (const row of rows) {
    const status = await getStatus(row.url);

    // ステータス不明 → 何もしない（削除しない）
    if (status === null) {
      console.log("❓ UNKNOWN (keep):", row.url);
      continue;
    }

    // 本当に死んでるとみなすのは 404 / 410 だけ
    if (status === 404 || status === 410) {
      console.log(`❌ DEAD (${status}) → deleting:`, row.url);
      await supabase.from("articles").delete().eq("id", row.id);
      deleted++;
    } else {
      console.log(`✅ ALIVE (${status}) keep:`, row.url);
    }

    // ※連打しすぎ防止に少しだけウェイト入れても良い
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`✔ DONE. Deleted ${deleted} dead links.`);
}

main();

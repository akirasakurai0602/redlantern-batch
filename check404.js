import "dotenv/config";
import { supabase } from "./supabase.js";

// ---------------------------
// URLが生きているか確認
// ---------------------------
async function isAlive(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      timeout: 8000,
    });

    // 成功ステータス
    if (res.status >= 200 && res.status < 400) return true;

    return false;
  } catch (e) {
    return false;
  }
}

// ---------------------------
// 死亡URLを削除
// ---------------------------
async function main() {
  console.log("📌 Checking dead URLs...");

  const { data: rows, error } = await supabase
    .from("articles")
    .select("id, url");

  if (error) {
    console.error("DB error:", error);
    return;
  }

  let deleted = 0;

  for (const row of rows) {
    const ok = await isAlive(row.url);

    if (!ok) {
      console.log("❌ DEAD → deleting:", row.url);

      await supabase.from("articles").delete().eq("id", row.id);

      deleted++;
    }
  }

  console.log(`✔ DONE. Deleted ${deleted} dead links.`);
}

main();

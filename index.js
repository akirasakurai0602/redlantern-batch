import "dotenv/config";
import { supabase } from "./supabase.js";
import { scrapeXVideosPage } from "./scrapers/xvideos.js";
import { scrapeSpankbangPage } from "./scrapers/spankbang.js";

async function main() {
  const xv = await scrapeXVideosPage();
  const sb = await scrapeSpankbangPage();

  const list = [...xv, ...sb]; // ←両方結合

  for (const item of list) {
    const { error } = await supabase.from("articles").insert(item);

    // 重複 (url unique) はスキップ
    if (error) {
      if (error.code === "23505") continue;
      console.error(error);
    }
  }

  console.log("DONE. inserted:", list.length);
}

main();

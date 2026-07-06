// Publie le prochain post de la file (posts/queue/) sur Instagram.
// API : "Instagram API with Instagram Login" (graph.instagram.com) — pas de Page Facebook requise.
//
// Env requis :
//   IG_ACCESS_TOKEN  — token long-lived avec instagram_business_basic + instagram_business_content_publish
//   MEDIA_BASE_URL   — préfixe URL public des médias, ex: https://raw.githubusercontent.com/Nonosimonet/aflow-social/main
//
// Un post = un fichier JSON dans posts/queue/ :
//   { "media": "media/reels/xxx.mp4", "caption_file": "captions/xxx.txt",
//     "type": "REELS", "publish_at": "2026-07-10" (optionnel, ISO date) }
// Les fichiers sont traités par ordre alphabétique (préfixe la date dans le nom pour ordonner).
// Après publication, le fichier est déplacé vers posts/published/ (le workflow committe).

import { readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

const GRAPH = "https://graph.instagram.com/v23.0";
const TOKEN = process.env.IG_ACCESS_TOKEN;
const BASE = (process.env.MEDIA_BASE_URL || "").replace(/\/$/, "");
const QUEUE = "posts/queue";
const DONE = "posts/published";

if (!TOKEN) { console.error("IG_ACCESS_TOKEN manquant"); process.exit(1); }
if (!BASE) { console.error("MEDIA_BASE_URL manquant"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, params = {}, method = "GET") {
  const url = new URL(`${GRAPH}/${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url, { method });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`API ${pathname}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function nextDuePost() {
  const files = (await readdir(QUEUE)).filter((f) => f.endsWith(".json")).sort();
  const today = new Date().toISOString().slice(0, 10);
  for (const f of files) {
    const post = JSON.parse(await readFile(path.join(QUEUE, f), "utf8"));
    if (!post.publish_at || post.publish_at <= today) return { file: f, post };
  }
  return null;
}

async function main() {
  const due = await nextDuePost();
  if (!due) { console.log("File vide ou rien d'échu — rien à publier."); return; }

  const { file, post } = due;
  const caption = await readFile(post.caption_file, "utf8");
  const mediaUrl = `${BASE}/${post.media}`;
  const me = await api("me", { fields: "user_id,username" });
  console.log(`Compte: @${me.username} — publication de ${file}`);

  // 1. Créer le conteneur média
  const isVideo = /\.(mp4|mov)$/i.test(post.media);
  const containerParams = isVideo
    ? { media_type: post.type || "REELS", video_url: mediaUrl, caption }
    : { image_url: mediaUrl, caption };
  const container = await api(`${me.user_id}/media`, containerParams, "POST");
  console.log(`Conteneur créé: ${container.id}`);

  // 2. Attendre que Meta ait téléchargé/transcodé la vidéo
  for (let i = 0; i < 30; i++) {
    const st = await api(container.id, { fields: "status_code" });
    console.log(`  statut: ${st.status_code}`);
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR") throw new Error("Transcodage du média en erreur.");
    await sleep(10_000);
  }

  // 3. Publier
  const pub = await api(`${me.user_id}/media_publish`, { creation_id: container.id }, "POST");
  console.log(`✅ Publié ! media_id=${pub.id}`);

  await rename(path.join(QUEUE, file), path.join(DONE, file));
  console.log(`${file} → posts/published/`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

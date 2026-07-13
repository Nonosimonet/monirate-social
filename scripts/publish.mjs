// Publie le prochain post de la file (posts/queue/) sur Instagram.
// API : "Instagram API with Instagram Login" (graph.instagram.com) — pas de Page Facebook requise.
//
// Env requis :
//   IG_ACCESS_TOKEN  — token long-lived avec instagram_business_basic + instagram_business_content_publish
//   MEDIA_BASE_URL   — préfixe URL public des médias, ex: https://raw.githubusercontent.com/Nonosimonet/monirate-social/main
//
// Un post = un fichier JSON dans posts/queue/ :
//   REEL / image simple :
//     { "media": "media/reels/xxx.mp4", "caption_file": "captions/xxx.txt",
//       "type": "REELS", "publish_at": "2026-07-10" (optionnel, ISO date) }
//   CARROUSEL (2 à 10 images) :
//     { "type": "CAROUSEL", "images": ["media/carousel/x/1.png", ...],
//       "caption_file": "captions/xxx.txt", "publish_at": "2026-07-13" }
// Les fichiers sont traités par ordre alphabétique (préfixe la date dans le nom pour ordonner).
// Après publication, le fichier est déplacé vers posts/published/ (le workflow committe).

import { readdir, readFile, rename, mkdir } from "node:fs/promises";
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

// Attend qu'un conteneur média soit prêt (FINISHED) — vidéo/carrousel.
async function waitReady(id, tries = 30, delay = 10_000) {
  for (let i = 0; i < tries; i++) {
    const st = await api(id, { fields: "status_code,status" });
    console.log(`  statut ${id}: ${st.status_code}`);
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR") {
      throw new Error(`Conteneur ${id} en erreur — détail: ${st.status || "(aucun)"}`);
    }
    await sleep(delay);
  }
  throw new Error(`Timeout: conteneur ${id} jamais FINISHED`);
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

// Construit le conteneur à publier et renvoie sa creation_id.
async function buildContainer(igId, post, caption) {
  const type = (post.type || "").toUpperCase();

  if (type === "CAROUSEL") {
    const images = post.images || [];
    if (images.length < 2 || images.length > 10) {
      throw new Error(`CAROUSEL: 2 à 10 images requises (reçu ${images.length})`);
    }
    // 1. Un conteneur enfant par image
    const childIds = [];
    for (const img of images) {
      const child = await api(`${igId}/media`,
        { image_url: `${BASE}/${img}`, is_carousel_item: "true" }, "POST");
      console.log(`  enfant: ${child.id} (${img})`);
      childIds.push(child.id);
    }
    // 2. Conteneur carrousel parent
    const carousel = await api(`${igId}/media`,
      { media_type: "CAROUSEL", children: childIds.join(","), caption }, "POST");
    console.log(`Conteneur carrousel: ${carousel.id}`);
    await waitReady(carousel.id, 20, 6_000);
    return carousel.id;
  }

  // REEL / vidéo / image simple
  const mediaUrl = `${BASE}/${post.media}`;
  const isVideo = /\.(mp4|mov)$/i.test(post.media);
  const params = isVideo
    ? { media_type: type || "REELS", video_url: mediaUrl, caption }
    : { image_url: mediaUrl, caption };
  const container = await api(`${igId}/media`, params, "POST");
  console.log(`Conteneur créé: ${container.id}`);
  if (isVideo) await waitReady(container.id);
  return container.id;
}

async function main() {
  const due = await nextDuePost();
  if (!due) { console.log("File vide ou rien d'échu — rien à publier."); return; }

  const { file, post } = due;
  const caption = await readFile(post.caption_file, "utf8");
  const me = await api("me", { fields: "user_id,username" });
  console.log(`Compte: @${me.username} — publication de ${file}`);

  const creationId = await buildContainer(me.user_id, post, caption);

  // Publier (petit retry si le conteneur n'est pas encore consommable)
  let pub;
  for (let i = 0; i < 6; i++) {
    try {
      pub = await api(`${me.user_id}/media_publish`, { creation_id: creationId }, "POST");
      break;
    } catch (e) {
      if (i < 5 && /not ready|not available|9007|media_publish/i.test(e.message)) {
        console.log("  conteneur pas encore prêt, retry dans 8s…");
        await sleep(8_000);
      } else throw e;
    }
  }
  console.log(`✅ Publié ! media_id=${pub.id}`);

  await mkdir(DONE, { recursive: true });
  await rename(path.join(QUEUE, file), path.join(DONE, file));
  console.log(`${file} → posts/published/`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

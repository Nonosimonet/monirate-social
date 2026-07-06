// Rafraîchit le token long-lived Instagram (validité 60 jours).
// À lancer au moins une fois par mois (workflow refresh.yml).
// Env : IG_ACCESS_TOKEN. Sortie : nouveau token sur stdout (ligne NEW_TOKEN=...).

const TOKEN = process.env.IG_ACCESS_TOKEN;
if (!TOKEN) { console.error("IG_ACCESS_TOKEN manquant"); process.exit(1); }

const url = new URL("https://graph.instagram.com/refresh_access_token");
url.searchParams.set("grant_type", "ig_refresh_token");
url.searchParams.set("access_token", TOKEN);

const res = await fetch(url);
const json = await res.json();
if (!res.ok || json.error) {
  console.error(`Échec du refresh: ${JSON.stringify(json.error || json)}`);
  process.exit(1);
}
console.log(`Token rafraîchi, expire dans ${Math.round(json.expires_in / 86400)} jours.`);
console.log(`NEW_TOKEN=${json.access_token}`);

# Aflow Social 📱

Pipeline de publication automatique pour le compte Instagram **@aflowstudioapp** (Aflow Studio).

⚠️ Ce repo est **public** : il sert d'hébergement média pour l'API Instagram (Meta télécharge
les vidéos via les URLs `raw.githubusercontent.com`). N'y mettre **aucun secret** — uniquement
du contenu destiné à être publié.

## Fonctionnement

```
posts/queue/*.json  ──(cron 17h05 UTC)──►  Instagram Reel/Post  ──►  posts/published/
```

1. Déposer la vidéo dans `media/reels/`, la légende dans `captions/`
2. Créer un fichier dans `posts/queue/` :
   ```json
   {
     "media": "media/reels/ma-video.mp4",
     "caption_file": "captions/ma-legende.txt",
     "type": "REELS",
     "publish_at": "2026-07-10"
   }
   ```
3. Commit + push → le workflow tourne chaque jour à 17h05 UTC et publie le prochain
   post « échu » (ordre alphabétique des fichiers → préfixer par la date).
4. Lancement manuel possible : onglet **Actions → Publish to Instagram → Run workflow**.

### Cadence : 1 post tous les 3 jours

Le cron tourne **tous les jours**, mais `publish.mjs` refuse de publier si le
dernier post date de moins de `MIN_DAYS_BETWEEN_POSTS` **jours de calendrier**
(**3** par défaut, réglé dans `publish.yml`). La date du dernier envoi réussi
est stockée dans `posts/last_published.json`, committée par le workflow.

Le comptage se fait sur les dates, pas sur les horodatages : le but est de
publier à l'heure qui touche le plus de monde, pas d'attendre 72 h à la seconde
près. Comparer des timestamps créait un cliquet — chaque publication fixait
l'heure plancher de la suivante, et comme les workflows planifiés arrivent
toujours en retard, l'heure ne pouvait que dériver vers le tard. Avancer le cron
faisait alors sauter une journée entière.

Ce garde-fou tient même si plusieurs posts de la file sont échus en même temps :
ils partiront un par un, espacés de 3 jours. Un `cron: "5 17 */3 * *"` ne suffirait
pas — le champ jour-du-mois repart à 1 à chaque mois, donc deux posts se
retrouveraient collés après le 31.

Pour forcer une publication hors cadence : lancer le workflow à la main après
avoir supprimé `posts/last_published.json`.

## Secrets à configurer (Settings → Secrets → Actions)

| Secret | Contenu |
|---|---|
| `IG_ACCESS_TOKEN` | Token long-lived de l'app Meta « MoniRate-Bot » (permissions `instagram_business_basic`, `instagram_business_content_publish`) |

⏰ **Le token expire après ~60 jours** (rafraîchissement manuel) : dashboard Meta →
app **MoniRate-Bot** → Instagram → Configuration de l'API → « Générer un token »,
puis recoller la nouvelle valeur dans le secret `IG_ACCESS_TOKEN`.
Prochain renouvellement à prévoir : **début septembre 2026**.

## Limites connues de l'API

- 🎵 **Pas de musique Instagram** ajoutable via l'API → les posts « événement » gagnent à être
  publiés à la main depuis l'app (musique tendance = portée).
- 🕐 Quota : max 25 publications API / 24 h (largement suffisant).
- 📐 Reels : MP4 H.264, 9:16, ≤ 90 s recommandé.

## Test local

```bash
IG_ACCESS_TOKEN=xxx MEDIA_BASE_URL=https://raw.githubusercontent.com/Nonosimonet/monirate-social/main \
  node scripts/publish.mjs
```

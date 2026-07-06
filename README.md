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
3. Commit + push → le workflow publie le prochain post « échu » chaque jour à 17h05 UTC
   (un seul post par jour, ordre alphabétique des fichiers → préfixer par la date).
4. Lancement manuel possible : onglet **Actions → Publish to Instagram → Run workflow**.

## Secrets à configurer (Settings → Secrets → Actions)

| Secret | Contenu |
|---|---|
| `IG_ACCESS_TOKEN` | Token long-lived de l'app Meta « Aflow Publisher » (permissions `instagram_business_basic`, `instagram_business_content_publish`) |
| `GH_PAT` | Personal Access Token GitHub (scope `repo`) — sert au workflow de refresh à mettre à jour `IG_ACCESS_TOKEN` |

Le token Instagram expire après 60 jours : le workflow `refresh-token.yml` le rafraîchit
les 1er et 15 de chaque mois.

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

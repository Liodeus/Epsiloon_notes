# Le carnet Epsiloon

Carnet personnel de lectures scientifiques, conçu pour GitHub Pages et protégé par StatiCrypt. La recherche, les filtres, les favoris et les fiches fonctionnent dans le navigateur. Aucun serveur ni compte supplémentaire n'est nécessaire.

Le carnet s’ouvre sur les numéros. L’édition de lecture regroupe les notes en **une fiche courte par article**, avec un résumé, deux ou trois points à retenir et cinq mots clés au maximum. Les encadrés ne créent plus de fiches séparées. Les brèves et images font l’objet d’une petite sélection de huit repères au maximum par numéro, accessible en bas de sa liste d’articles.

## Ouvrir et reconstruire le carnet

Node.js 22 ou plus récent est nécessaire pour reconstruire le site.

```sh
npm ci
npm test
npm run build
npm run check
npm run preview
```

La construction demande une phrase de passe d'au moins 12 caractères, deux fois, avec saisie masquée. Elle n'est pas enregistrée. La commande utilise StatiCrypt 3.5.4, dont la version est fixée dans le verrou des dépendances. Pour une exécution automatisée locale, `STATICRYPT_PASSWORD` peut être fourni dans l'environnement du processus.

Ouvrir ensuite [http://localhost:4173](http://localhost:4173). Le déchiffrement fonctionne en HTTPS ou sur localhost. L'ouverture directe du fichier avec `file://` n'est pas le mode prévu.

Le bouton **Verrouiller** recharge la version chiffrée. La phrase de passe n'est pas mémorisée : chaque rechargement demande de déverrouiller à nouveau. Les favoris et la liste « À revoir » restent enregistrés sur cet appareil, dans ce navigateur.

## Publier sur GitHub Pages

Le dossier `dist/` contient exactement trois fichiers : `index.html` chiffré, `.nojekyll` et `robots.txt`. Seul ce dossier est publié.

1. Construire le carnet avec sa phrase de passe et exécuter les vérifications ci-dessus.
2. Enregistrer dans Git le code du projet et `dist/`, puis pousser sur la branche `main` du dépôt.
3. Dans GitHub, ouvrir **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Lancer le workflow **Publier le carnet chiffré**, ou pousser une modification de `dist/` sur `main`.

Le workflow ne reconstruit pas le site et ne reçoit jamais la phrase de passe : il publie l'export déjà chiffré localement. Il refuse un dossier inattendu ou un fichier HTML sans marqueur StatiCrypt.

Le site peut provenir d'un dépôt privé si ton offre GitHub autorise Pages sur les dépôts privés. Le chiffrement protège le contenu des fiches indépendamment de la visibilité du dépôt.

## Sources et données privées

```text
private/
  pdfs/                  PDF originaux, conservés en local
  sources/catalog.json   Numéros accessibles dans l'abonnement
  sources/epsiloon-*/     Sommaires et textes intégraux de travail
  data/epsiloon-*.json    Fiches originales avant chiffrement
  editorial/             Synthèses regroupées par article
  coverage/              Exclusions explicites et contrôle des sommaires
  preview/index.html     Aperçu de travail en clair
  build-report.json      Bilan du dernier export
src/                     Interface, logique et gabarit du verrou
scripts/                 Construction et contrôles
dist/                    Site chiffré à publier
```

Tout le dossier `private/`, les fichiers PDF et les fichiers `.env` sont ignorés par Git. Ne pas utiliser `git add -f` pour ces fichiers. Le site conserve des liens vers la liseuse officielle, qui demande ton abonnement ; il n'héberge aucun PDF, aucune page du magazine et aucun texte intégral.

Les résumés restituent le contenu à la date de publication des articles. Les repères de liseuse sont indiqués uniquement lorsqu'ils ont été vérifiés ; sinon, le lien ouvre le numéro et le titre permet de retrouver l'article dans son sommaire.

## Ajouter un numéro

Ajouter son entrée au catalogue local, puis ses fiches dans `private/data/epsiloon-N.json` ou `private/data/epsiloon-hs-N.json`. Les numéros initiaux, mensuels 51 à 65 et hors-séries 16 à 20, sont obligatoires dans le catalogue. Des numéros suivants peuvent être ajoutés.

Une fiche utilise ce schéma :

```json
{
  "id": "epsiloon-51-identifiant-du-sujet",
  "issueId": "epsiloon-51",
  "sourceEntity": "entity://identifiant-source",
  "title": "Titre du sujet",
  "theme": "Technologie",
  "format": "article",
  "oneLiner": "L'idée qui aide à se souvenir du sujet.",
  "summary": "Un résumé original et rapide.",
  "takeaways": ["Premier point concret.", "Deuxième point concret."],
  "keywords": ["mot clé", "concept", "domaine"],
  "nuance": "La limite ou l'incertitude importante de cet article.",
  "author": null,
  "readerPage": null,
  "sourceUrl": "https://www.epsiloon.com/compte/reader.html?titleRef=ROCSC.EPS&nb=51"
}
```

Thèmes : Espace, Physique, Vivant, Santé, Environnement, Technologie, Société. Formats : enquête, dossier, article, brève, image. Les rubriques regroupant plusieurs sujets peuvent donner plusieurs fiches avec le même `sourceEntity` et des identifiants distincts.

Ces fichiers sont les notes de travail locales. `scripts/compile-articles.mjs` regroupe les entrées partageant le même `sourceEntity` avant l’export et sépare les petites actualités des articles. Les corrections de synthèse peuvent être enregistrées dans `private/editorial/article-overrides.json`, avec une clé par identifiant `entity://…` et les champs `title`, `summary`, `takeaways` ou `keywords`. Les identifiants des anciennes fiches sont conservés comme alias pour les favoris et liens existants.

Chaque numéro possède aussi un bilan `private/coverage/IDENTIFIANT.json` de la forme `{"issueId":"epsiloon-51","excluded":[{"sourceEntity":"entity://identifiant","title":"Titre de l'entrée","reason":"Motif d'exclusion"}]}`. Les entrées non scientifiques (liste des chercheurs, annonces, citations seules) y sont consignées ; les sujets scientifiques sont rattachés aux fiches via `sourceEntity`.

Reconstruire ensuite le carnet et publier la nouvelle version de `dist/`. La construction complète refuse un numéro du catalogue sans fiches ou un sujet du sommaire qui n'est ni couvert ni explicitement exclu.

## Travail sur l'interface

Pour préparer un aperçu local pendant l'enrichissement du corpus :

```sh
node scripts/build.mjs --preview-only --allow-partial
npm run preview -- --plaintext
```

Cet aperçu local est en clair, reste dans `private/` et ne peut pas être publié par le workflow. La publication exige une construction complète et chiffrée.

# Compteur de musculation

Application web (installable sur le téléphone) qui compte les répétitions grâce à la caméra, gère les séries et les pauses, et guide à la voix les séances sans caméra.

En ligne : https://mattzepolstudio.github.io/compteur-muscu

## Organisation

- **4 onglets** : Accueil (séance du jour), Séances (mes séances et catalogue), Progrès, Profil (profil et réglages).
- **Une seule notion : la séance**, c'est-à-dire une liste d'étapes avec ou sans caméra. Un exercice seul est une séance d'une étape.

## Code

| Fichier | Rôle |
|---|---|
| `index.html` | Structure des écrans |
| `css/app.css` | Styles |
| `js/data.js` | Exercices, séances guidées, règles du plan (aucun accès au DOM) |
| `js/store.js` | Réglages, séances, historique, migration des anciennes données |
| `js/device.js` | Son, voix, écran allumé, navigation entre écrans |
| `js/camera.js` | Séance avec caméra : détection, comptage, séries, pauses |
| `js/guided.js` | Séance guidée : chrono et coach vocal |
| `js/app.js` | Interface : onglets, éditeur, résumé, profil |
| `js/vision.js` | Import de MediaPipe (remplacé pendant les tests) |

## Tests

À lancer avant chaque mise en ligne :

```
python3 tests/check_ids.py   # identifiants HTML manquants ou en double
python3 tests/e2e.py         # parcours complets avec une caméra simulée (Playwright)
```

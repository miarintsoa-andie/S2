# Challenges — Modules Vue.js à créer

Série de 7 exercices pratiques pour enrichir l'application `glpi-front`.  
Chaque challenge correspond à un module Vue.js autonome à intégrer dans l'app existante.

---

## Progression

| # | Module | Difficulté | Compétences travaillées |
|---|--------|-----------|------------------------|
| [01](./01-app-toast.md) | Système de notifications (Toast) | ⭐ Facile | Composant global, provide/inject, transitions |
| [02](./02-stats-overview.md) | Tableau de bord de statistiques | ⭐⭐ Facile+ | Appels API multiples, computed, réactivité |
| [03](./03-ticket-creator.md) | Formulaire de création de ticket | ⭐⭐⭐ Moyen | Formulaire contrôlé, validation, POST API |
| [04](./04-search-filter.md) | Recherche et filtres avancés | ⭐⭐⭐ Moyen | Debounce, filtres combinés, pagination |
| [05](./05-csv-bulk-import.md) | Import CSV avec prévisualisation | ⭐⭐⭐⭐ Moyen+ | Parsing CSV, mapping colonnes, upload batch |
| [06](./06-bulk-actions.md) | Actions en masse sur des items | ⭐⭐⭐⭐⭐ Difficile | PATCH API, state machine, gestion d'erreurs |
| [07](./07-import-diff.md) | Comparateur avant/après import | ⭐⭐⭐⭐⭐ Avancé | Diff d'objets, store Pinia, rollback |

---

## Règles du jeu

- Chaque module **doit fonctionner indépendamment** et s'intégrer dans le router existant.
- Le code de démarrage fourni dans chaque challenge est **intentionnellement incomplet** — c'est à toi de le compléter.
- Les **indices** sont là si tu bloques ; essaie sans avant de les lire.
- La section **Pour aller plus loin** propose des extensions optionnelles si le challenge de base est trop rapide.

## Prérequis

Avoir complété la mise en place de base décrite dans :
- [01-vue-app-setup.md](../01-vue-app-setup.md)
- [02-api-client.md](../02-api-client.md)

L'instance GLPI doit être accessible et l'API REST activée.

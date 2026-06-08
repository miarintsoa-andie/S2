# Documentation GLPI

Cette documentation résume le fonctionnement principal du GLPI présent dans cet espace de travail et explique comment utiliser les APIs disponibles.

## 1. En quoi consiste ce GLPI

GLPI est un logiciel libre de gestion de parc informatique et de helpdesk. Il permet de gérer:

- les actifs informatiques (ordinateurs, imprimantes, serveurs, licences, contrats, etc.)
- le suivi des incidents, des demandes de service, des changements et des problèmes
- la gestion des utilisateurs et des profils
- la configuration des entités et des services
- la gestion des contrats, des achats et de la maintenance
- des tableaux de bord et des rapports

Ce projet contient une installation de GLPI version `11.0.7` (voir `glpi/version/11.0.7`).

## 2. Architecture et composants principaux

Le dossier `/var/www/glpi` contient l'application GLPI. Les composants principaux sont:

- `index.html` et `front/` : pages publiques et interface web
- `apirest.php` : point d'entrée principal de l'API REST
- `ajax/` : scripts PHP utilisés par l'interface web et parfois par l'API
- `bin/console` : outils en ligne de commande pour la maintenance et les tâches système
- `config/` : configuration de l'application
- `inc/`, `src/` : code PHP central et classes métier
- `templates/`, `public/` : gabarits, ressources statiques, images
- `plugins/` : extensions et plugins GLPI
- `vendor/` : bibliothèques tierces installées via Composer
- `files/` : fichiers uploadés, documents, pièces jointes
- `version/` : version de l'application

### Prérequis techniques

GLPI tourne principalement sur une pile web standard :

- serveur web : Apache, Nginx, IIS, etc.
- PHP >= 8.2
- Base de données MariaDB >= 10.6 ou MySQL >= 8.0
- Extensions PHP obligatoires : dom, fileinfo, filter, libxml, simplexml, xmlreader, xmlwriter, bcmath, curl, gd, intl, mbstring, mysqli, openssl, zlib
- Extensions PHP recommandées : bz2, phar, zip, exif, ldap, opcache

## 3. Comment fonctionne ce GLPI

GLPI est une application PHP avec une logique métier centralisée dans `src/` et `inc/`. L'application utilise une base de données pour stocker :

- les utilisateurs
- les entités
- les profils et permissions
- les tickets / demandes
- les matériels et composants
- les contrats, licences et achats
- les documents et historiques

L'accès se fait via une interface web ou via l'API REST exposée par `apirest.php`.

Les éléments principaux sont organisés par itemtypes : chaque type d'objet métier (ticket, ordinateur, contrat, etc.) correspond à une classe GLPI.

## 4. API REST de GLPI

Le dossier `glpi/apirest.md` contient la documentation détaillée de l'API REST fournie par cette installation. Elle décrit les endpoints, l'authentification et les formats attendus.

### 4.1 Principes généraux

- L'API attend un header `Content-Type` pour chaque requête.
- `application/json` est utilisé pour les appels classiques.
- `multipart/form-data` est utilisé pour l'ajout de fichiers.
- Les requêtes `GET` ne doivent pas avoir de corps (`body`) et tous les paramètres doivent être passés dans l'URL.
- Les sessions sont en lecture seule par défaut ; certaines actions nécessitent `session_write=true` pour activer l'écriture.
- L'accès à l'API peut être restreint par plage IP, adresse IPv6 et `App-Token` dans la configuration générale.

### 4.2 Authentification API

L'authentification se fait avec `initSession` :

- soit avec un couple `login`/`password` en Basic Auth
- soit avec une `user_token` dans l'en-tête `Authorization`
- l'`App-Token` est optionnel mais recommandé si configuré

Réponse attendue : un `session_token` que l'on utilise ensuite sur les autres endpoints.

### 4.3 Tokens

- `App-Token` : jeton d'application optionnel pour identifier l'application cliente.
- `user_token` : clé utilisateur définie dans les préférences utilisateur (Remote access key).
- `session_token` : jeton de session délivré par `initSession`.

### 4.4 Endpoints courants

#### initSession

URL: `apirest.php/initSession/`
Méthode: GET
Headers:
- `Content-Type: application/json`
- `Authorization: Basic <base64(login:password)>` ou `Authorization: user_token <token>`
- `App-Token: <app token>` (optionnel)

Exemple :

```bash
curl -X GET \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic Z2xwaTpnbHBp' \
  -H 'App-Token: f7g3csp8mgatg5ebc5elnazakw20i9fyev1qopya7' \
  'http://path/to/glpi/apirest.php/initSession'
```

Réponse :

```json
{
  "session_token": "83af7e620c83a50a18d3eac2f6ed05a3ca0bea62"
}
```

#### killSession

URL: `apirest.php/killSession/`
Méthode: GET
Headers:
- `Session-Token: <session_token>`
- `App-Token: <app token>` (optionnel)

#### lostPassword

URL: `apirest.php/lostPassword/`
Méthode: PUT ou PATCH
Payload JSON minimal :

```json
{ "email": "user@domain.com" }
```

Pour réinitialiser le mot de passe :

```json
{
  "email": "user@domain.com",
  "password_forget_token": "<reset-token>",
  "password": "NewPassword"
}
```

#### getMyProfiles

URL: `apirest.php/getMyProfiles/`
Méthode: GET
Headers :
- `Session-Token`
- `App-Token` (optionnel)

#### getActiveProfile

URL: `apirest.php/getActiveProfile/`
Méthode: GET

### 4.5 Requêtes API et format

- Les paramètres de requête peuvent être envoyés dans l'URL sous forme de query string.
- Les données envoyées en POST, PUT, PATCH doivent être en JSON lorsque `Content-Type: application/json`.
- Les erreurs sont retournées avec des codes HTTP `400` ou `401` selon le contexte.

## 5. Utilisation et bonnes pratiques

- Préférer l'utilisation d'un `App-Token` pour isoler et tracer les clients API.
- Toujours fermer la session (`killSession`) après utilisation.
- Pour des opérations en écriture, s'assurer que `session_write=true` est envoyé si le point API l'exige.
- Pour les uploads, utiliser `multipart/form-data`.
- Sur les appels `GET`, ne pas inclure de corps de requête.

## 6. Liens et fichiers utiles dans ce workspace

- `glpi/README.md` : documentation générale du projet GLPI
- `glpi/apirest.md` : documentation détaillée de l'API REST de cette installation
- `glpi/version/11.0.7` : version de GLPI installée
- `glpi/bin/console` : outil CLI
- `glpi/config/` : configuration de l'application
- `glpi/plugins/` : plugins installés

## 7. À quoi sert ce dossier `glpi-docs`

Ce dossier est un espace de documentation dédié pour expliquer le fonctionnement de cette instance GLPI, ses dépendances et la manière d'utiliser son API.

Pour aller plus loin, consulter les documents officiels de GLPI :

- https://glpi-install.readthedocs.io
- https://glpi-user-documentation.readthedocs.io
- https://glpi-developer-documentation.readthedocs.io

# ThermoSense API

API REST de gestion du confort thermique des bâtiments tertiaires. Elle permet la supervision en temps réel des capteurs de température et d'humidité, le pilotage des équipements CVC (Chauffage, Ventilation, Climatisation) et la gestion multi-bâtiments avec contrôle d'accès par rôles.

---

## Sommaire

- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancer le projet](#lancer-le-projet)
- [Données de test (seed)](#données-de-test-seed)
- [Architecture](#architecture)
- [Routes API](#routes-api)
- [Sécurité](#sécurité)
- [Tests avec Bruno](#tests-avec-bruno)
- [OpenAPI / Documentation](#openapi--documentation)

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js v5 |
| Base de données | MongoDB (Atlas) + Mongoose |
| Authentification | JWT (jsonwebtoken, express-jwt) |
| Hachage des mots de passe | bcryptjs |
| Tests API | Bruno |
| Spécification | OpenAPI 3.0.3 |
| Simulation réseau | Toxiproxy |

---

## Prérequis

- Node.js >= 18
- npm >= 9
- Un cluster MongoDB Atlas (ou MongoDB local)

---

## Installation

```bash
git clone <url-du-repo>
cd ThermoSense
npm install
```

---

## Configuration

Créer un fichier `.env` à la racine du projet :

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
JWT_SECRET=thermosense-super-secret-change-in-prod-2026
PORT=3000
```

> **Important :** Remplacer `JWT_SECRET` par une valeur sécurisée en production.

---

## Lancer le projet

```bash
# Développement (hot-reload)
npm run dev

# Production (compilation puis exécution)
npm run build
npm run start:prod
```

Le serveur démarre sur `http://localhost:3000`.
Vérification : `GET http://localhost:3000/health`

---

## Données de test (seed)

La base de données est automatiquement peuplée au premier démarrage si elle est vide.

**Bâtiments :**
- Siège Social ThermoSense — Paris
- Entrepôt Logistique Nord — Lille

**Utilisateurs de test :**

| Login | Mot de passe | Rôle | Accès |
|-------|-------------|------|-------|
| `admin` | `Admin1234!` | admin | Accès total |
| `operator_zone_a` | `Operator1234!` | operator | Zone A uniquement |
| `operator_zone_b` | `Operator1234!` | operator | Zone B uniquement |
| `device_sensor_01` | `Device1234!` | device | Envoi de mesures |
| `device_actuator_01` | `Device1234!` | device | Commandes actionneur |

---

## Architecture

```
src/
├── index.ts              # Point d'entrée
├── app.ts                # Configuration Express et montage des routes
├── types/index.ts        # Interfaces TypeScript
├── db/
│   ├── connection.ts     # Connexion MongoDB
│   └── models.ts         # Schémas Mongoose
├── middleware/
│   ├── auth.ts           # Vérification JWT, RBAC, BOLA
│   ├── securityAudit.ts  # Journalisation des événements de sécurité
│   ├── rateLimit.ts      # Limitation de débit sur le login
│   └── errorHandler.ts   # Gestion globale des erreurs
├── routes/
│   ├── auth.ts           # POST /auth/login
│   ├── users.ts          # Gestion des utilisateurs
│   ├── buildings.ts      # CRUD bâtiments
│   ├── zones.ts          # CRUD zones
│   ├── sensors.ts        # CRUD capteurs
│   ├── measurements.ts   # Mesures
│   ├── actuators.ts      # Actionneurs + commandes
│   └── alertThresholds.ts
├── data/
│   └── seed.ts           # Peuplement initial de la BDD
└── simulation/
    └── sensors.ts        # Génération de données simulées
```

---

## Routes API

Toutes les routes (sauf `/health` et `POST /auth/login`) nécessitent un token JWT dans le header :
```
Authorization: Bearer <token>
```

### Santé

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/health` | Non | Statut de l'API |

### Authentification

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/auth/login` | Non | Connexion, retourne un JWT (expire dans 15 min) |

### Utilisateurs

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| POST | `/users` | admin | Créer un utilisateur |

### Bâtiments

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| GET | `/buildings` | admin, operator | Lister les bâtiments |
| POST | `/buildings` | admin, operator | Créer un bâtiment |
| GET | `/buildings/:buildingId` | admin, operator | Détails d'un bâtiment |
| PATCH | `/buildings/:buildingId` | admin, operator | Modifier un bâtiment |
| DELETE | `/buildings/:buildingId` | admin | Supprimer (cascade) |

### Zones

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| GET | `/buildings/:bId/zones` | admin | Lister les zones |
| POST | `/buildings/:bId/zones` | admin | Créer une zone |
| GET | `/buildings/:bId/zones/:zoneId` | admin, operator* | Détails d'une zone |
| PATCH | `/buildings/:bId/zones/:zoneId` | admin | Modifier une zone |
| DELETE | `/buildings/:bId/zones/:zoneId` | admin | Supprimer (cascade) |

### Capteurs

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| GET | `/buildings/:bId/zones/:zId/sensors` | admin, operator* | Lister les capteurs |
| POST | `/buildings/:bId/zones/:zId/sensors` | admin, operator* | Créer un capteur |
| GET | `/buildings/:bId/zones/:zId/sensors/:sId` | tous* | Détails d'un capteur |
| PATCH | `/buildings/:bId/zones/:zId/sensors/:sId` | admin, operator* | Modifier |
| DELETE | `/buildings/:bId/zones/:zId/sensors/:sId` | admin, operator* | Supprimer |

### Mesures

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| GET | `/buildings/:bId/zones/:zId/sensors/:sId/measurements` | admin, operator* | Historique |
| POST | `/buildings/:bId/zones/:zId/sensors/:sId/measurements` | admin, device* | Enregistrer une mesure |

> Retourne `503` si le capteur est hors ligne ou en maintenance.

### Actionneurs

| Méthode | Route | Rôles | Description |
|---------|-------|-------|-------------|
| GET | `/buildings/:bId/zones/:zId/actuators` | admin, operator* | Lister |
| POST | `/buildings/:bId/zones/:zId/actuators` | admin, operator* | Créer |
| GET | `/buildings/:bId/zones/:zId/actuators/:aId` | admin, operator* | Détails |
| PATCH | `/buildings/:bId/zones/:zId/actuators/:aId` | admin, operator* | Modifier |
| DELETE | `/buildings/:bId/zones/:zId/actuators/:aId` | admin | Supprimer |
| POST | `/buildings/:bId/zones/:zId/actuators/:aId/commands` | admin, operator* | Envoyer une commande |

> `*` = soumis au contrôle BOLA (l'opérateur ne peut accéder qu'à sa propre zone)

---

## Sécurité

### Contrôle d'accès basé sur les rôles (RBAC / BFLA)

| Rôle | Droits |
|------|--------|
| `admin` | Accès complet à toutes les ressources |
| `operator` | Lecture/écriture sur sa zone assignée, pas de suppression |
| `device` | Envoi de mesures uniquement (écriture restreinte) |

### Contrôle d'accès par objet (BOLA)

Les opérateurs sont limités à la zone associée à leur compte (`zoneId`). Toute tentative d'accès à une autre zone est refusée avec `403`.

### Autres mécanismes

- **Rate limiting** : 10 tentatives de login par tranche de 15 minutes par IP
- **JWT** : Tokens signés, expiration 15 minutes, audience et issuer validés
- **Audit de sécurité** : Journalisation structurée (JSON) de tous les événements d'authentification et d'accès refusé, avec correlation ID
- **Hachage des mots de passe** : bcryptjs, 10 rounds

---

## Tests avec Bruno

Le dossier `bruno/` contient une collection de tests organisée par ressource.

```
bruno/
├── Auth/
├── Buildings/
├── Zones/
├── Sensors/
├── Measurements/
├── Actuators/
├── Health Check.bru
└── environments/
```

Ouvrir le dossier `bruno/` dans le client Bruno pour accéder à tous les scénarios de test, y compris les cas nominaux et les tests de sécurité BFLA/BOLA.

---

## OpenAPI / Documentation

Le fichier `ThermoSense_openapi.yaml` contient la spécification complète de l'API au format OpenAPI 3.0.3.

Il peut être visualisé avec :
- [Swagger Editor](https://editor.swagger.io/)
- L'extension VS Code **OpenAPI (Swagger) Editor**
- Bruno (import OpenAPI)
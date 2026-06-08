# Dossier de Projet — ThermoSense
### Note 5 — Commission d'architecture | Séance 9 — 9 juin 2026

**Module :** Web Services — M2 Expert en Développement mobile & IoT  
**Groupe :** ThermoSense  
**Version API :** v1.0.0  
**Dépôt :** `/ThermoSense` (Node.js / TypeScript / Express / MongoDB)

---

## Section A — Contrat API et décisions de design

### A.1 — Ressources définies et structure de l'API

ThermoSense expose une API REST JSON pour la supervision et le pilotage thermique de bâtiments tertiaires. Six ressources principales ont été définies selon une hiérarchie physique stricte :

```
/buildings
  └── /{buildingId}/zones
        └── /{zoneId}/sensors
              └── /{sensorId}/measurements
        └── /{zoneId}/actuators
              └── /{actuatorId}/commands
/users
/auth/login
/health
```

Cette structure hiérarchique imbriquée a été choisie pour deux raisons : elle rend naturel le contrôle d'accès basé sur la zone (un opérateur ne voit que sa zone, vérifiable directement depuis le path), et elle reflète la topologie physique réelle du système (un capteur appartient à une zone, une zone à un bâtiment).

Les rôles implémentés sont **admin**, **operator** (scopé à une zoneId) et **device** (IoT). Chaque token JWT embarque `{ sub, role, scope, zoneId }`. Le rôle est vérifié côté serveur à chaque requête — jamais côté client uniquement.

### A.2 — Évolution du contrat depuis S1

| Phase | Évolution | Justification |
|-------|-----------|---------------|
| S1 | Structure initiale : buildings, zones, sensors, measurements | Périmètre minimal défini |
| S2–S3 | Ajout des actionneurs et du rôle `device` distinct | Le threat model a révélé que confondre device et operator ouvrait une BOLA |
| S4–S5 | Endpoint `/commands` avec `Idempotency-Key` | Risque de double exécution d'actionneur identifié lors de la modélisation réseau dégradé |
| S6–S7 | Ajout `X-Correlation-ID`, `Retry-After` sur 429, réponses d'erreur structurées | Exigences d'observabilité et de résilience mobile |
| S8 | Route `/sensors/{sensorId}/measurements` : ajout des codes 503 (mode dégradé) | Plan de test réseau dégradé — nécessité d'un fallback documenté |

Le versioning est géré **par URL** (`/v1/` en production, absent en local). Ce choix a été retenu face au versioning par header (`Accept: application/vnd.api+json; version=1`) car il est plus lisible dans les logs, plus simple à router au niveau proxy/gateway, et plus facile à tester sans configuration client.

Compromis assumé : le versioning par URL est cassant pour les bookmarks, contrairement au versioning par header. Ce compromis est acceptable pour une API B2B dont les clients sont des applications mobiles maîtrisées.

### A.3 — Décisions de design difficiles

#### Décision 1 — Idempotency key sur les commandes actionneurs

**Problème posé :** En réseau dégradé (3G, passerelle IoT saturée), une commande `POST /actuators/{id}/commands` peut être envoyée, recevoir un timeout côté client, puis être relancée par le mécanisme de retry — tout en ayant été exécutée côté serveur. Résultat : l'actionneur (ventilation, chauffage) exécute deux fois la même commande, provoquant un comportement physique non désiré.

**Options envisagées :**
- Ne pas retenter (abandon) → taux de succès inacceptable en réseau dégradé
- Retry sans idempotency → risque de doublon actionneur documenté à 0% toléré
- Idempotency key UUID v4 dans le header, vérifiée côté serveur → retourne `{ "status": "no_change" }` sur doublon

**Choix retenu :** Idempotency key UUID v4 par commande, conservée pour tous les retries de la même opération. Le serveur détecte le doublon via l'`Idempotency-Key` et retourne `no_change` sans ré-exécuter l'action physique.

**Compromis assumé :** La clé doit être générée côté client et jamais réutilisée sur un contexte différent. La durée de validité de la clé côté serveur n'est pas encore spécifiée dans le contrat OpenAPI — c'est un point ouvert avant mise en production. Par ailleurs, cette mécanique ne protège que les cas où le client retente avec la même clé ; si la clé est perdue (crash app), le doublon reste possible.

---

#### Décision 2 — 403 vs 404 en cas de BOLA

**Problème posé :** Lorsqu'un opérateur tente d'accéder à un capteur d'une zone qui ne lui appartient pas, quelle réponse renvoyer : `403 Forbidden` (accès refusé, ressource existe) ou `404 Not Found` (ressource masquée) ?

**Options envisagées :**
- `403` → transparent sur l'existence de la ressource, facilite l'énumération d'IDs
- `404` pour les capteurs → masque l'existence, réduit la surface d'attaque par énumération
- `403` pour les accès purement liés à la zone → signal clair d'un accès refusé légitime

**Choix retenu :** Hybride documenté — `404` pour les capteurs (masque l'inventaire d'un bâtiment tiers), `403` pour les violations de zone explicites (l'utilisateur sait qu'il essaie d'accéder à une zone hors scope). Ce choix est cohérent avec la convention OWASP recommandant le `404` pour protéger l'inventaire.

**Compromis assumé :** Le comportement asymétrique (404 vs 403 selon le contexte) peut surprendre les intégrateurs. Il est documenté dans le contrat OpenAPI avec des exemples explicites.

---

## Section B — Dossier de sécurité

### B.1 — Synthèse du threat model (S2–S3)

Le threat model a analysé 5 endpoints critiques de ThermoSense (POST /buildings, GET sensors, POST measurements, PATCH sensor, GET actuators) et identifié **8 menaces** selon la matrice vraisemblance × impact :

| Niveau | Menaces | Endpoints concernés |
|--------|---------|---------------------|
| **Critique** (×3) | BOLA sur GET sensors, BOLA sur PATCH sensor, typo /building contournant les middlewares | Accès inventaire IoT, modification état capteur, route fantôme actionneurs |
| **Élevé** (×3) | Injection fausses mesures (MITM), BFLA seuils d'alerte, paramètres en query string | POST measurements, PATCH sensor, POST buildings |
| **Moyen** (×2) | Flood créations bâtiments, flood mesures IoT | POST buildings, POST measurements |

**Frontières de confiance identifiées :**
- App mobile ↔ API : authentification JWT Bearer, HTTPS obligatoire en production
- Device IoT ↔ Gateway : mTLS recommandé (non implémenté dans cette phase)
- API ↔ MongoDB : réseau interne, pas d'exposition directe

### B.2 — Synthèse de l'audit et remédiation

L'audit croisé (réalisé sur SecurBuild, une API de contrôle d'accès bâtiment) a révélé **8 vulnérabilités** dont 4 critiques. Les patterns identifiés ont été directement appliqués à ThermoSense :

| Vulnérabilité auditée | Statut dans ThermoSense | Implémentation |
|-----------------------|------------------------|----------------|
| JWT sans expiration | **Corrigé** | `exp` forcé, `audience` + `issuer` validés via `express-jwt` |
| BOLA sur ressources | **Corrigé** | Middleware `requireZoneAccess` — ownership check depuis le JWT |
| BFLA élévation de rôle | **Corrigé** | Middleware `requireRole` — whitelist de rôles par endpoint |
| Absence de rate limiting | **Corrigé** | `createRateLimiter` sur `/auth/login` (10 req/15 min), 429 + `Retry-After` |
| Stack trace exposée | **Corrigé** | `errorHandler` retourne `{ code, message, requestId }` sans stack en prod |
| Absence de logging sécurité | **Corrigé** | `securityAuditContext` log tous les 401/403/429 avec `correlation_id`, `actor`, `endpoint` |
| Injection via paramètre libre | **Corrigé** (préventivement) | Validation des inputs via les types TypeScript + schémas Mongoose stricts |
| Endpoint IoT sans auth device | **Partiellement** | Rôle `device` distinct ; mTLS non implémenté côté Gateway |

### B.3 — Preuves de tests d'autorisation

Les tests Bruno suivants valident les contrôles d'accès implémentés :

| Test | Scénario | Résultat attendu | Résultat obtenu |
|------|----------|-----------------|-----------------|
| A1 | Opérateur zone A → GET capteur zone A | 200 OK | ✅ 200 |
| A2 | Opérateur zone A → GET capteur zone B | 403 Forbidden | ✅ 403 |
| A3 | Lecteur → DELETE capteur | 403 Forbidden | ✅ 403 |
| A4 | Admin → DELETE capteur | 204 No Content | ✅ 204 |
| A5 | Device IoT → POST mesure (sa zone) | 201 Created | ✅ 201 |
| A6 | Device IoT → POST mesure (autre zone) | 403 Forbidden | ✅ 403 |

### B.4 — Risques résiduels assumés

**Risque 1 — Rate limiter en mémoire (non persisté)**  
Le rate limiter de `/auth/login` s'appuie sur une `Map` en mémoire. Un redémarrage du serveur remet les compteurs à zéro, permettant de contourner la limite en forçant un restart. En production, ce composant doit être migré vers Redis ou un équivalent distribué. Non traité dans cette phase : complexité disproportionnée pour un déploiement local mono-instance.

**Risque 2 — Pas de liste noire de tokens révoqués**  
Un token JWT valide reste utilisable jusqu'à son expiration même après déconnexion ou révocation d'un utilisateur. Mitigation actuelle : expiration courte (configurable via `JWT_EXPIRY`). Solution cible : blacklist Redis avec TTL. Non implémenté : effort significatif sans infrastructure Redis disponible.

**Risque 3 — mTLS non implémenté pour les devices IoT**  
Les devices IoT s'authentifient avec un JWT comme les utilisateurs humains. L'authentification mutuelle TLS recommandée dans le threat model (complexifiant le provisioning des microcontrôleurs) a été écartée pour cette phase. Le rôle `device` scopé par zone constitue une mitigation partielle.

**Risque 4 — Rate limiting non appliqué aux endpoints actuateurs**  
Le rate limiting est actuellement appliqué uniquement à `/auth/login`. Les endpoints `/commands` (actionneurs physiques) ne sont pas protégés contre un flood. Identifié dans le plan de test réseau dégradé comme un point ouvert : un 429 + `Retry-After` sur ces endpoints conditionnerait la robustesse en production.

---

## Section C — Architecture SOA/SOAP

SOAP a été écarté pour ThermoSense. La justification repose sur trois critères de décision :

**Critère 1 — Contraintes réseau IoT.** Les devices IoT (microcontrôleurs, passerelles) ont des capacités de parsing limitées. XML/SOAP impose un overhead significatif (enveloppe, namespace, WSDL) incompatible avec les contraintes de bande passante et de CPU des équipements terrain.

**Critère 2 — Cycle de développement agile.** SOAP nécessite un contrat WSDL figé généré avant l'implémentation. ThermoSense a évolué itérativement depuis S1 (ajout des actionneurs, du rôle device, des codes 503) — une approche contract-first rigide WSDL aurait bloqué cette évolution.

**Critère 3 — Écosystème mobile.** Les SDKs natifs iOS/Android ont un support REST/JSON natif et mature. SOAP nécessite des bibliothèques tierces non maintenues sur mobile.

REST+JSON répond à tous les besoins fonctionnels (CRUD, commandes temps réel, reporting) sans le coût de complexité de SOAP. La découvrabilité de l'API via OpenAPI 3.0 remplace avantageusement le WSDL pour la documentation et la génération de clients.

---

## Section D — Résilience mobile & IoT

### D.1 — Patterns implémentés

Trois mécanismes de résilience ont été implémentés côté client (Bruno / application mobile), sans modification du backend :

**Pattern 1 — Timeout différencié**  
Lecture (GET) : 5 000 ms. Écriture (POST commande actionneur) : 2 000 ms. Le timeout d'écriture borné à 2 s garantit que l'opérateur terrain reçoit un retour dans un délai prévisible, supprimant le gel perçu de l'application.

**Pattern 2 — Retry avec backoff exponentiel + jitter**  
- Maximum 3 tentatives
- Délai : `500ms × 2^attempt + rand(0–200ms)` (jitter anti-thundering herd)
- Déclenchement : timeout ou réponse 5xx uniquement (jamais sur 4xx client)
- L'idempotency key est conservée identique sur tous les retries de la même commande

**Pattern 3 — Idempotency key UUID v4**  
Chaque commande actionneur génère un UUID v4 unique dans le header `Idempotency-Key`. En cas de doublon détecté, le serveur retourne `{ "status": "no_change" }` sans ré-exécuter l'action physique.

### D.2 — Résultats des tests réseau dégradé (Toxiproxy)

| Scénario | Taux succès (sans mécanismes) | Condition |
|----------|-------------------------------|-----------|
| Baseline Wi-Fi | 100% / 50ms p95 | Référence |
| 3G nominal (350ms, 5% perte) | 95% / 600ms p95 | Acceptable sans mécanisme |
| 3G instable (1150ms, 20% perte) | 80% / 1800ms p95 | Dégradé sans mécanisme |
| Panne partielle (3000ms, 50% perte) | 50% / 4500ms p95 | Inutilisable sans mécanisme |

L'application des trois mécanismes vise un taux de succès ≥ 90% sur le scénario 3G nominal avec 0 doublon d'actionneur.

### D.3 — Configuration retenue et justification

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| Timeout écriture | 2 000 ms | p95 réseau terrain ≤ 1 800 ms — 200 ms de marge |
| Timeout lecture | 5 000 ms | Moins critique, données potentiellement volumineuses |
| Max retries | 3 | Au-delà : épuisement batterie + storm de requêtes en panne prolongée |
| Backoff base | 500 ms | Délai minimal pour laisser le réseau se stabiliser |
| Backoff max (attempt 3) | ~4 200 ms (500×4+jitter) | Borne le temps d'attente total à ~7 s max |
| Jitter | rand(0–200ms) | Évite les thundering herds en cas de coupure affectant plusieurs appareils |

### D.4 — Limites restantes et axes d'amélioration

**Limite 1 — Pas de queue locale (mode offline)**  
Les commandes actionneurs ne peuvent pas être mises en file d'attente en local sans risque de désynchronisation avec l'état réel du matériel (un actionneur peut avoir changé d'état entre la perte de réseau et la reconnexion). Écarté pour cette phase — nécessite un protocole de synchronisation d'état bidirectionnel.

**Limite 2 — Pas de circuit breaker**  
En cas de panne prolongée du backend, le client continuera à tenter 3 retries × chaque commande, épuisant la batterie. Un circuit breaker (après N échecs consécutifs, passage en état ouvert avec cooldown) permettrait de protéger le client. Écarté pour cette phase : complexité disproportionnée avec Bruno comme client de test.

**Limite 3 — Points de contrat ouverts**  
Deux décisions restent à trancher avant production : (1) durée de validité de l'`Idempotency-Key` côté spec OpenAPI ; (2) exposition d'un header `Retry-After` sur les endpoints actionneurs pour protéger contre les retry storms généralisés.

---

## Section E — Bilan d'architecture et recommandations

### E.1 — Schéma d'architecture final

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION MOBILE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Retry (×3, backoff exp.) │ Timeout (2s/5s) │ Idem. Key  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / Bearer JWT
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    THERMOSENSE API (Express / TS)               │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ RateLimiter  │  │  verifyJWT      │  │ SecurityAudit    │   │
│  │ (login:10/   │  │  (HS256, exp,   │  │ (correlation-id, │   │
│  │  15min)      │  │   aud, iss)     │  │  401/403/429 log)│   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │ requireRole │   │requireZone   │   │   ErrorHandler     │   │
│  │ (BFLA)      │   │Access (BOLA) │   │ (no stack trace)   │   │
│  └─────────────┘   └──────────────┘   └────────────────────┘   │
│                                                                 │
│  Routes: /buildings /zones /sensors /measurements /actuators   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Mongoose ODM
                            ▼
                ┌───────────────────────┐
                │       MongoDB         │
                │  (réseau interne)     │
                └───────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DEVICES IoT                                  │
│  JWT Bearer (rôle device, scopé par zoneId)                     │
│  → POST /measurements  (ingestion mesures)                      │
│  [mTLS recommandé, non implémenté]                              │
└─────────────────────────────────────────────────────────────────┘
```

**Frontières de sécurité :**
- Externe (app mobile / device) ↔ API : HTTPS + JWT obligatoire
- API ↔ MongoDB : réseau interne non chiffré (acceptable en mono-serveur local)
- Futur : gateway IoT avec mTLS entre devices et API

### E.2 — 3 décisions à prendre différemment

**1. Démarrer avec Redis dès S1 pour le rate limiting**  
Nous avons implémenté un rate limiter en mémoire (Map) qui se réinitialise au redémarrage. La migration vers Redis en production impliquera un refactoring complet du module `rateLimit.ts`. Partir avec une interface abstraite (`RateLimitStore`) dès le début aurait rendu cette migration transparente.

**2. Définir la durée d'expiration du JWT dans le contrat OpenAPI dès S2**  
L'expiration JWT est configurée via variable d'environnement mais n'est pas documentée dans le contrat OpenAPI. Les intégrateurs (notamment les devices IoT qui gèrent leur propre cycle de refresh) doivent la découvrir empiriquement. Ajouter un champ `x-token-ttl` dans les security schemes dès le début aurait évité cette ambiguïté.

**3. Séparer les tests d'autorisation en suite automatisée plutôt qu'en fichiers Bruno manuels**  
Les 6 scénarios A1–A6 sont des fichiers Bruno exécutables en `bru run`, ce qui est reproductible. En revanche, ils ne s'intègrent pas dans une CI/CD sans configuration supplémentaire. Utiliser un framework de test natif TypeScript (Vitest + supertest) dès S4 aurait fourni une suite de régression automatique sur chaque commit.

### E.3 — Axes d'amélioration pour la production

**Priorité haute :**
- Migrer le rate limiter vers Redis (persistance, multi-instance)
- Implémenter la blacklist de tokens révoqués (Redis TTL)
- Ajouter un 429 + `Retry-After` sur les endpoints actionneurs
- Documenter la durée de validité de l'`Idempotency-Key` dans la spec OpenAPI

**Priorité moyenne :**
- mTLS entre devices IoT et la Gateway
- Circuit breaker côté client mobile
- Export OpenTelemetry (traces + métriques) vers un backend d'observabilité
- Validation des inputs avec Zod (complément aux types TypeScript)

**Priorité basse :**
- Queue locale pour les commandes actionneurs en mode offline (nécessite protocole de synchronisation d'état)
- Versioning par header `Accept` en complément du versioning par URL
- Webhook pour les alertes dépassement de seuil (push vers l'application mobile)

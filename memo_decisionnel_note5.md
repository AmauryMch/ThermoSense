# Mémo Décisionnel — ThermoSense
### Commission d'architecture — 9 juin 2026

**Projet :** ThermoSense | **Version API :** v1.0.0 | **Stack :** Node.js / TypeScript / Express / MongoDB

---

## 1. Contexte système

ThermoSense est une API REST JSON de supervision et pilotage thermique pour bâtiments tertiaires. Elle permet à une application mobile de consulter les mesures de capteurs IoT (température, humidité) et de piloter des actionneurs (ventilation, chauffage, climatisation) à distance, via un modèle de rôles **admin / operator / device**.

---

## 2. Trois décisions structurantes

### Décision 1 — Idempotency key sur les commandes actionneurs

**Problème :** En réseau dégradé (3G terrain, 20–50% de perte), le retry automatique d'une commande `POST /commands` peut déclencher deux fois le même actionneur physique — risque de surchauffe ou de comportement non désiré en bâtiment.

**Options écartées :**
- Pas de retry → taux de succès 50% en panne partielle (inacceptable opérateur terrain)
- Retry sans protection → 0% de tolérance aux doublons incompatible avec un système physique

**Choix retenu :** Header `Idempotency-Key: <UUID v4>` conservé sur tous les retries de la même commande. Le serveur retourne `{ "status": "no_change" }` sur doublon sans ré-exécuter l'action.

**Compromis assumé :** La durée de validité de la clé côté serveur n'est pas encore spécifiée dans le contrat OpenAPI — point ouvert à trancher avant production.

---

### Décision 2 — Retry backoff exponentiel borné à 3 tentatives

**Problème :** Sans retry, 80% de succès en 3G instable. Avec retry non borné, risque de retry storm (épuisement batterie, saturation réseau en panne généralisée).

**Options écartées :**
- Retry illimité → consommation réseau et batterie non bornées, tempête de requêtes en panne prolongée
- Circuit breaker → pertinent mais complexité disproportionnée pour cette phase (pas d'état persistant côté client)

**Choix retenu :** Max 3 tentatives, délai `500ms × 2^attempt + rand(0–200ms)`, sur timeout et 5xx uniquement. Le jitter anti-thundering herd est actif. Le timeout d'écriture est borné à 2 000 ms.

**Compromis assumé :** Le retry triple peut tripler la consommation réseau en panne prolongée. L'absence de circuit breaker laisse le client tenter 3 fois même si le backend est clairement hors service.

---

### Décision 3 — BOLA : 404 pour les capteurs, 403 pour les violations de zone

**Problème :** Un opérateur accédant à un capteur d'une zone tierce — révéler l'existence de la ressource (403) ou la masquer (404) ?

**Options écartées :**
- 403 systématique → confirme l'existence de toutes les ressources, facilite l'énumération d'UUIDs
- 404 systématique → perd la distinction entre "ressource inexistante" et "accès refusé", difficile à déboguer pour l'intégrateur légitime

**Choix retenu :** 404 pour les capteurs (masque l'inventaire IoT d'un bâtiment tiers), 403 pour les violations de zone explicites. Comportement documenté dans les réponses OpenAPI avec exemples.

**Compromis assumé :** Comportement asymétrique pouvant surprendre un intégrateur — compensé par des exemples de réponse détaillés dans le contrat.

---

## 3. Risque résiduel majeur

**Rate limiter non persisté et non appliqué aux actionneurs**

Le rate limiter actuel (`createRateLimiter`) s'appuie sur une `Map` en mémoire de Node.js. Deux problèmes en production : (1) un redémarrage du serveur remet les compteurs à zéro, permettant de contourner la limite de `/auth/login` en forçant un restart ; (2) les endpoints `POST /commands` (actionneurs physiques) ne sont pas protégés contre un flood, laissant ouverte la possibilité d'un retry storm ou d'un accès abusif.

**Quantification :** Un attaquant ou un client défaillant peut déclencher des commandes actionneurs physiques sans limitation, avec impact direct sur les équipements du bâtiment.

**Décision assumée :** Migration vers Redis non réalisée dans cette phase (déploiement local mono-instance). Axes de remédiation identifiés : interface abstraite `RateLimitStore`, Redis TTL, rate limiting sur `/commands` avec 429 + `Retry-After`.

---

## 4. Scénario d'incident préparé

**Scénario : Retry storm sur actionneur en réseau dégradé (scénario #3 — panne partielle)**

**Choix de ce scénario :** C'est le scénario le plus critique du projet ThermoSense. Il cumule deux risques distincts — le doublon d'actionneur physique (impact terrain immédiat) et l'épuisement réseau — et met en jeu les trois mécanismes implémentés simultanément.

**Déroulé de la démo :**
1. Lancement de Toxiproxy : latence 3 000 ms ± 1 000 ms, 50% de perte de paquets
2. `POST /buildings/b-001/zones/z-001/actuators/a-001/commands { "action": "on" }`
3. Observation : le client déclenche jusqu'à 3 retries avec l'*identique* `Idempotency-Key`
4. Preuves attendues : logs serveur montrant `status: "no_change"` sur le 2e envoi reçu, compteur de retries ≤ 3, 0 doublon d'exécution côté actionneur
5. Si la démo tombe : affichage du log de fallback (`correlation_id`, `retry_count`, `status: timeout`) — la gestion de l'incident est elle-même évaluée

**Critère de succès :** 0 doublon actionneur, retries bornés à 3, feedback utilisateur dans ≤ 2 s par tentative.

# Revue croisée

### Protocole

1. Échangez votre fichier thermosense-api.yaml avec le groupe désigné par
   l'enseignant.
2. Vous avez 15 minutes pour analyser le contrat reçu. Vous êtes dans le rôle
   d'un développeur mobile qui découvre cette API pour la première fois.
3. Préparez un retour structuré avec :

- **2 points forts** (ce qui est clair, bien pensé, réutilisable)
- **3 améliorations** argumentées (pas « c'est pas bien » mais « cet aspect pose
  problème parce que… et je suggère… »)
- **1 endpoint manquant ou insusamment documenté** qui poserait problème à un
  développeur mobile

--- 

ligne 74 : Description trop courte et pas assez précise

### **Points forts**
- Schémas complets avant même que toute les routes soient implémentées
- Code erreur bien définis
---

### **3 améliorations**
- Description/Documentation pas assez précise ou ne correspond pas la l'action réalisé (ex: post Building)
- Faire un choix entre endpoints plats ou imbriqués : on a ```/areas/{areaId}/sensors``` avec ```/sensors/{sensorId}```, plutôt choisir entre :
    - Soit : ```/sensors``` et ```/sensors/{sensorId}```
    - Soit : ```/areas/{areaId}/sensors``` et ```/areas/{areaId}/sensors/{sensorId} ```; /!\ on peut aussi se demander pourquoi pas imbriqués les **_areas_** avec les **_buildings_**, exemple : ```/buildings/{buildingId}/areas/{areaId}/sensors```
- Finir les composants **_parameters_** comme pour les schémas avant de finir d'implémenter les routes manquantes
- L'endpoint GET /buildings retourne les buildings + areas + sensors
---

### **1 endpoint manquant ou insusamment documenté** 

- Il manque le schéma user

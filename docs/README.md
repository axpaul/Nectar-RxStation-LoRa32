# 🚀 RocketStation Nectar - Console Web de Télémétrie

Bienvenue sur le centre de contrôle web officiel de la station sol **RocketStation Nectar**. Cette application web Vanilla JS moderne permet de se connecter en direct à une station sol LoRa32 par port USB (via l'API Web Serial) pour recevoir, décoder et cartographier les signaux de télémétrie émis par des trackers de fusées et de ballons sondes (protocoles NectarMC et WASP).

---

## 🛠️ Fonctionnalités Clés
- **Liaison Série USB Directe** : Connexion temps réel via l'API Web Serial standard du navigateur (sans logiciel tiers à installer).
- **Décodage Multi-Protocoles** :
  - Décodage des trames binaires NectarMC (Magic Byte `0xEB`, ID Mission, GS Flag, Payload, RSSI, SNR, et horodatage).
  - Décodage de la charge utile WASP de 29 octets (données GPS haute précision, altitude, vitesse, température et batterie).
- **Suivi Cartographique Live** : Affichage en direct des trajectoires sur une carte **Leaflet.js** avec micro-animations de pulsation CSS.
- **Console & Commandes AT** : Envoi séquentiel de commandes de configuration radio (fréquence, SF, BW, CRC) et retour visuel.
- **Journaux SD intégrés** : Lecture et téléchargement de fichiers CSV stockés sur la carte SD de la station sol.
- **Flasheur de Firmware Intégré** : Mise à jour en un clic du firmware de la carte ESP32 par USB via `esptool.js`.
- **Synthèse Vocale** : Alarmes sonores automatiques en cas d'acquisition de signal ("Nouveau tracker détecté") ou de perte de liaison ("Alerte, tracker perdu").

---

## 🏗️ Architecture Modulaire (ES6 Modules)
Pour assurer une séparation stricte des responsabilités et une maintenance aisée, le code est découpé en modules Javascript ES6 autonomes :

- **`js/translate.js`** : Gère la localisation dynamique de l'IHM (FR/EN) et la propagation de l'événement `'lang-changed'`.
- **`js/decoder.js`** : Décodeur binaire pur et calculs mathématiques (CRC16-CCITT) sans aucune dépendance au DOM.
- **`js/serial.js`** : Classe `NectarSerial` gérant la boucle matérielle asynchrone d'acquisition USB, le parsing binaire et l'écriture du flasheur.
- **`js/map.js`** : Classe `NectarMap` encapsulant l'affichage des marqueurs et des polylines Leaflet.js.
- **`js/app.js`** : Point d'entrée principal (`NectarApp`) orchestrant les événements utilisateur, les graphiques en direct (RSSI/SNR en SVG) et la mise à jour des indicateurs.

---

## 💻 Démarrage Local
Les navigateurs restreignent l'accès à l'API Web Serial aux contextes sécurisés. Pour faire fonctionner l'interface en local, il est nécessaire de la lancer à travers un serveur HTTP local.

### Option A : Python (Recommandé)
Lancez la commande suivante à la racine du projet ou du dossier `docs/` :
```bash
python -m http.server 8000 --directory docs
```
Puis ouvrez l'adresse suivante dans Google Chrome, Edge ou Opera :
👉 **[http://localhost:8000](http://localhost:8000)**

### Option B : Serveur Node.js (http-server)
Installez et lancez le serveur statique Node :
```bash
npx http-server docs/ -p 8000
```
Puis ouvrez :
👉 **[http://localhost:8000](http://localhost:8000)**

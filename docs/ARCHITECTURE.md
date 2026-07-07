# 📐 Architecture Logicielle - RocketStation Nectar

Ce document détaille l'architecture technique de la console web de la station sol. Il a pour but d'expliquer le fonctionnement de l'application de manière claire, visuelle et structurée, afin qu'un développeur débutant puisse rapidement comprendre les responsabilités de chaque composant.

---

## 🗺️ Flux de Données Événementiel (Interruption)

La station sol fonctionne sur un modèle **événementiel par interruption**. Il n'y a aucun processus de temporisation ou de tampon (Throttling) pour retarder l'affichage. Chaque octet reçu sur le port USB est immédiatement accumulé, analysé et envoyé à l'IHM dès qu'une trame complète est assemblée.

Le schéma ci-dessous décrit le cheminement d'un signal, depuis sa réception physique jusqu'à son rendu visuel et sonore :

```mermaid
graph TD
  USB[Port Série USB] -->|Flux d'octets| Serial[NectarSerial]
  Serial -->|Accumulation| Buf[rxBuffer]
  Buf -->|Magic Byte 0xEB & GSFLAG/Size| Parser[parseRxBuffer]
  Parser -->|Trame isolée| Dec[decodeNectarFrame]
  Dec -->|Validation CRC16| Event{CRC Valide ?}
  Event -->|Non| Err[onLog: Erreur CRC dans Console]
  Event -->|Oui| OK[onPacket: Trame Décodée]
  OK -->|WASP Payload 29B| Wasp[decodeWaspPayload]
  Wasp -->|Indicateurs GPS| Map[NectarMap: Leaflet Map]
  Wasp -->|Données Physiques| Cockpit[Cockpit WASP IHM]
  OK -->|RSSI / SNR| Charts[Graphiques SVG & Live Telemetry]
  OK -->|Nouveau SSID| Audio[speak: Alertes Vocales]
```

---

## 🏛️ Diagramme des Classes et Modules

L'application respecte les principes de la programmation orientée objet (POO) avec une séparation stricte des responsabilités (découplage Vue-Modèle) :

```mermaid
classDiagram
  class NectarApp {
    +NectarSerial serial
    +NectarMap map
    +Object activeTrackers
    +Object waspTrackersData
    +init()
    +onPacketReceived(decoded)
    +onLineReceived(lineText)
    +speak(text)
  }
  class NectarSerial {
    +SerialPort port
    +ReadableStream reader
    +Array rxBuffer
    +connect(baud, fmt)
    +disconnect()
    +readSerialLoop(fmt)
    +parseRxBuffer(fmt)
    +sendSerialText(text)
    +flashFirmware(url, onProgress, onLog)
  }
  class NectarMap {
    +Map map
    +Object markers
    +Object trajectories
    +init()
    +updateTrackerPosition(name, data, activeName)
    +clear()
  }
  class Decoder {
    +calculateCRC16(data)
    +decodeNectarFrame(frame, fmt)
    +decodeWaspPayload(payload)
  }
  class Translate {
    +translations
    +getTranslation(key, replacements)
    +updateLanguage(lang)
  }

  NectarApp --> NectarSerial : Instancie et écoute
  NectarApp --> NectarMap : Instancie et pilote
  NectarSerial ..> Decoder : Utilise pour découper
  NectarApp ..> Decoder : Utilise pour WASP
  NectarApp ..> Translate : Utilise pour I18n
```

---

## 📋 Tableau des Responsabilités ("Qui fait quoi ?")

| Composant | Fichier | Responsabilité Principale | Fonctions Clés |
| :--- | :--- | :--- | :--- |
| **Orchestrateur** | `app.js` | Point d'entrée, gestion du cycle de vie, liaison des événements du DOM, graphiques SVG temps réel et synthèse vocale. | `init()`, `onPacketReceived()`, `speak()`, `drawSignalCharts()` |
| **Communication** | `serial.js` | Liaison Web Serial, boucle asynchrone matérielle de lecture continue et interfaçage avec `esptool-js` pour le flashage USB de l'ESP32. | `connect()`, `readSerialLoop()`, `parseRxBuffer()`, `flashFirmware()` |
| **Décodeur** | `decoder.js` | Algorithme mathématique CRC16 et parsing binaire pur des paquets de télémétrie. **Zéro dépendance au DOM**. | `calculateCRC16()`, `decodeNectarFrame()`, `decodeWaspPayload()` |
| **Localisation** | `translate.js`| Chargement des dictionnaires FR/EN, scannage et injection dans le DOM, propagation de l'événement custom `lang-changed`. | `updateLanguage()`, `getTranslation()` |
| **Cartographie** | `map.js` | Encapsulation de la bibliothèque Leaflet, placement des marqueurs, animation de pulsation des émetteurs et dessin des lignes de trajectoire. | `init()`, `updateTrackerPosition()`, `clear()` |

---

## ⚡ Résolution du Bug d'Arrêt de Flux après la Première Trame
### Le Problème Réel Constaté
Sur les versions récentes du micrologiciel (à partir de la v1.6.2), la liaison série USB a cessé d'envoyer le caractère de retour à la ligne `\n` (`0x0A`) en fin de trame binaire. Le décodeur JavaScript d'origine attendait un décalage de `+1` octet pour marquer la fin de la trame. Dès la réception de la deuxième trame, le buffer série subissait un décalage de 1 octet, ce qui masquait le premier octet magique `0xEB`, entraînant la perte et la désynchronisation immédiate et définitive de la liaison.

### Le Correctif Appliqué
1. **Parser Binaire Conforme (v1.6.2)** : Le parser a été corrigé dans `serial.js` pour lire la taille exacte de la trame (`totalFrameSize`) sans attendre d'octet supplémentaire de fin de ligne. Les trames suivantes sont désormais alignées et décodées de manière continue sans aucune perte.
2. **Isolation Mémoire WASP** : Pour éviter toute instabilité de lecture dans la structure binaire, la charge utile WASP de 29 octets est isolée dans un `ArrayBuffer` et lue par un `DataView` indépendant.

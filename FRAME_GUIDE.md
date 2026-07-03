# Guide des Formats de Trames (Radio LoRa & Série NectarMC)

Ce guide décrit en détail les formats et la structure binaire des trames utilisées par la station **NECTAR RX STATION - LoRa32** pour la communication radio et la transmission série vers le PC.

---

## 📡 1. Format des Trames Radio LoRa (Air)

Les trames émises par les trackers/émetteurs dans les airs vers la station sol respectent le format suivant. La présence ou non du CRC en queue dépend du mode de contrôle configuré (voir le [Guide sur les CRC](./CRC_GUIDE.md)) :

### Option A : Format avec CRC matériel (Recommandé & Par défaut)
Le contrôle d'intégrité est pris en charge directement par le silicium de la puce SX1276. Le paquet LoRa physique se compose uniquement du Header Applicatif et des Données Utiles.
* **Taille totale** : $3 + N$ octets (où $N$ est la taille des données utiles).

```
┌───────────────────────────────────────────────────────────┬───────────────────┐
│                          HEADER                           │      PAYLOAD      │
├───────────────────────────────────────────────────────────┼───────────────────┤
│       SSID_NUM       │     APID      │     SSID_TYPE      │      N data       │
│        1 Byte        │    1 Byte     │       1 Byte       │       bytes       │
│       (0-255)        │    (0-63)     │       (0-3)        │     (N bytes)     │
└──────────────────────┴───────────────┴────────────────────┴───────────────────┘
```

### Option B : Format avec CRC logiciel (Si le CRC matériel est désactivé)
Si le CRC matériel est désactivé (`AT+CRC=0`), la station s'attend à ce que l'émetteur calcule un CRC16 logiciel et l'ajoute à la fin de la charge utile LoRa. L'ESP32 de la station sol vérifiera ce CRC logiciel avant de valider le paquet (voir [radio.cpp](./src/radio.cpp#L145-L173)).
* **Taille totale** : $5 + N$ octets.

```
┌───────────────────────────────────────────────────────────┬───────────────────┬───────────────┐
│                          HEADER                           │      PAYLOAD      │    CONTROL    │
├───────────────────────────────────────────────────────────┼───────────────────┼───────────────┤
│       SSID_NUM       │     APID      │     SSID_TYPE      │      N data       │     CRC16     │
│        1 Byte        │    1 Byte     │       1 Byte       │       bytes       │    2 Bytes    │
│       (0-255)        │    (0-63)     │       (0-3)        │     (N bytes)     │  (Software)   │
└──────────────────────┴───────────────┴────────────────────┴───────────────────┴───────────────┘
```

### Description des octets de la trame radio

| Position | Type | Nom du Champ | Description |
| :--- | :--- | :--- | :--- |
| **Octet 0** | `uint8_t` | `SSID_NUM` | ID ou numéro unique du tracker (de 0 à 255). |
| **Octet 1** | `uint8_t` | `APID` | Identifiant du processus applicatif / type de paquet (de 0 à 63). |
| **Octet 2** | `uint8_t` | `SSID_TYPE` | Type de mission (`0` = FX, `1` = MF, `2` = BALLOON, `3` = OTHER). |
| **Octets 3 à 2+N** | `uint8_t[]` | `Payload` | Charge utile contenant les données brutes des capteurs ($N$ octets). |
| **Octets 3+N à 4+N** | `uint16_t` | `CRC16` | *(Option B uniquement)* Somme de contrôle logicielle de 2 octets en Little-Endian calculée sur les octets 0 à `2+N` inclus. |

---

## 💻 2. Format de la Trame Série NectarMC (Série USB & Bluetooth)

Lorsque la station sol a validé une trame radio, elle l'encapsule dans une trame binaire conforme au protocole NectarMC pour l'envoyer au PC sur le port série USB ou Bluetooth. Deux formats de trame série sont supportés et configurables à chaud sur le récepteur :

---

### A. Format avec GSFLAG (v1.5.0 / FrameFormatWithGsFlag - Par défaut)
Ce format propose un en-tête étendu intégrant l'octet **`gs_flag`** (Ground Station Flag). Le footer s'adapte dynamiquement pour inclure le RSSI et le SNR s'ils sont demandés par le drapeau, suivis d'un **Timestamp Epoch Unix de 4 octets** fixe de manière standard.
* **Taille totale** : $12 + N + M$ octets (où $M$ est le nombre de métadonnées présentes : 0, 1 ou 2 octets).

```
┌───────────────────────────────────────────────────────────┬───────────────────┬───────────────────────────────────────┬───────────────┐
│                          HEADER                           │      PAYLOAD      │               METADATA                │    CONTROL    │
├─────────────┬──────────────┬──────────────┬───────────────┼───────────────────┼───────────┬───────────┬───────────────┼───────────────┤
│   MAGIC     │  Id_mission  │   gs_flag    │ payload_size  │      N data       │   RSSI    │    SNR    │   Timestamp   │     CRC16     │
│   1 Byte    │   2 Bytes    │    1 Byte    │    1 Byte     │      bytes        │  (Option) │  (Option) │    4 Bytes    │    2 Bytes    │
│    0xEB     │ (Little-End) │   (Bitmask)  │   (N bytes)   │                   │  1 Byte   │  1 Byte   │ (uint32_t L-E)│ (Little-End)  │
└─────────────┴──────────────┴──────────────┴───────────────┴───────────────────┴───────────┴───────────┴───────────────┴───────────────┘
```

#### Fonctionnement du Ground Station Flag (`gs_flag`) :
L'octet `gs_flag` (Octet 3) est un masque de bits utilisé pour activer ou désactiver l'envoi de métriques spécifiques :
```
bit7    bit6    bit5    bit4    bit3    bit2    bit1    bit0
 ─ Réservés ─   └───────── Timestamp ──────────┘   │       │
                (Si l'un de ces bits est à 1)     │       └─ 1 = Inclure RSSI dans le footer
                                                   └───────── 1 = Inclure SNR dans le footer
```

* **RSSI** (Octet 5+N si présent) : Présent uniquement si `(gs_flag & 0x01) == 1`.
* **SNR** (Octet 5+N+$hasRssi$ si présent) : Présent uniquement si `(gs_flag & 0x02) == 2`. La valeur transmise est codée sous forme d'un entier signé sur 8 bits (`int8_t`) représentant le SNR physique en dB multiplié par 4 (exprimé en quarts de dB, ex: un SNR réel de 8.5 dB est transmis sous la forme d'un octet valant `34`).
* **Timestamp** (4 octets si présent) : Présent uniquement si `(gs_flag & 0x3C) != 0` (les bits 2 à 5 décrivent sa présence).
* **Par défaut sur Nectar RX Station** : Le `gs_flag` est fixé à `0x3F` (tous les bits de RSSI, SNR et Timestamp actifs) afin d'inclure systématiquement l'ensemble de ces informations.

#### Description détaillée des octets :
| Position | Type | Nom du Champ | Description |
| :--- | :--- | :--- | :--- |
| **Octet 0** | `uint8_t` | `MAGIC` | Octet de synchronisation. Vaut toujours `0xEB`. |
| **Octets 1 à 2** | `uint16_t` | `Id_mission` | Identifiant de mission Little-Endian. Regroupe SSID_TYPE (bits 15-14), SSID_NUM (bits 13-6) et APID (bits 5-0). |
| **Octet 3** | `uint8_t` | `gs_flag` | Masque de bits indiquant la présence de RSSI (bit 0), SNR (bit 1) et Timestamp (bits 2 à 5) dans le footer. |
| **Octet 4** | `uint8_t` | `payload_size` | Longueur $N$ de la charge utile LoRa brute. |
| **Octets 5 à 4+N** | `uint8_t[]` | `Payload` | Données brutes LoRa ($N$ octets). |
| **Octets facultatifs** | `int8_t` | `RSSI` / `SNR` | En fonction de `gs_flag` (0, 1 ou 2 octets insérés après la payload). Le RSSI est exprimé directement en dBm, le SNR est codé en quarts de dB (SNR réel en dB = valeur_transmise / 4). |
| **4 octets suivants** | `uint32_t` | `Timestamp` | (Optionnel) Horodatage Unix Epoch (secondes) Little-Endian issu de la RTC de la station (présent si `gs_flag & 0x3C` est non-nul). |
| **2 octets suivants** | `uint16_t` | `CRC16` | CRC16-CCITT Little-Endian calculé sur toute la trame (du Magic `0xEB` jusqu'aux métadonnées incluses). |
| **Dernier octet** | `char` | `Newline` | Retour à la ligne `\n` (`0x0A`). |

---

### B. Format sans GSFLAG (v1.3.1 / master)
Ce format binaire minimaliste n'inclut aucune métadonnée réseau (RSSI, SNR) ni d'horodatage. Il est idéal pour minimiser le traitement et les transferts série.
* **Taille totale** : $7 + N$ octets.

```
┌───────────────────────────────────────────┬───────────────────┬───────────────┐
│                  HEADER                   │      PAYLOAD      │    CONTROL    │
├───────────────────────────────────────────┼───────────────────┼───────────────┤
│   MAGIC     │  Id_mission  │ payload_size │      N data       │     CRC16     │
│   1 Byte    │   2 Bytes    │   1 Byte     │      bytes        │    2 Bytes    │
│    0xEB     │ (Little-End) │   (N bytes)  │                   │ (Little-End)  │
└─────────────┴──────────────┴──────────────┴───────────────────┴───────────────┘
```

#### Description détaillée des octets :
| Position | Type | Nom du Champ | Description |
| :--- | :--- | :--- | :--- |
| **Octet 0** | `uint8_t` | `MAGIC` | Octet de synchronisation. Vaut toujours `0xEB`. |
| **Octets 1 à 2** | `uint16_t` | `Id_mission` | Identifiant de mission Little-Endian. Regroupe SSID_TYPE (bits 15-14), SSID_NUM (bits 13-6) et APID (bits 5-0). |
| **Octet 3** | `uint8_t` | `payload_size` | Longueur $N$ de la charge utile LoRa brute. |
| **Octets 4 à 3+N** | `uint8_t[]` | `Payload` | Données brutes LoRa ($N$ octets). |
| **Octets 4+N à 5+N** | `uint16_t` | `CRC16` | CRC16-CCITT Little-Endian calculé sur les octets 0 à `3+N` (Header + Payload). |
| **Octet 6+N** | `char` | `Newline` | Retour à la ligne `\n` (`0x0A`). |

---

## 📈 Historique et Évolution des Versions

Pour s'assurer que vos parseurs et décodeurs côté PC fonctionnent correctement, voici le récapitulatif des versions de la station et l'impact sur le format des trames :

| Version | Taille Trame Série | Format de Trame Série | Nouveautés Majeures |
| :---: | :---: | :--- | :--- |
| **v1.5.0 (GSFLAG)** | **$12 + N + M$ octets** | `MAGIC` (1B) + `Id_mission` (2B) + `gs_flag` (1B) + `Size` (1B) + `Payload` (NB) + `Metadata` (MB) + **`Timestamp` (4B)** + `CRC16` (2B) + `\n` (1B) | - Intégration du **Ground Station Flag** (`gs_flag`) pour des métadonnées dynamiques. <br>- Choix des paramètres RSSI/SNR conditionnés par bitmask. <br>- Présence fixe d'un **Timestamp RTC** (Epoch Unix) de 4 octets. |
| **v1.3.1** | **$7 + N$ octets** | `MAGIC` (1B) + `Id_mission` (2B) + `Size` (1B) + `Payload` (NB) + `CRC16` (2B) + `\n` (1B) | - Version originale compatible NectarMC.<br>- Aucune métadonnée insérée (pas de RSSI, SNR ni de timestamp). |

---

## Liens Utiles :
* **[README.md](./README.md)** : Retourner à la page principale.
* **[CRC_GUIDE.md](./CRC_GUIDE.md)** : Guide explicatif des deux niveaux de CRC (Liaison Radio et Liaison Série).
* **[src/serial.cpp](./src/serial.cpp)** : Code source de formatage et d'envoi de la trame série vers le PC.

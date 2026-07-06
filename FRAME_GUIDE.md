# **NectarMC** — Guide des Formats de Trames
> Référence des trames binaires émises et reçues par la **NECTAR RX STATION - LoRa32**.  
> Destinée à tout logiciel de vol, simulateur ou parseur traitant des trames NectarMC.

---

Ce document décrit le format des trames côté **bord** (liaison radio LoRa dans les airs) et côté **station sol** (liaison série USB / Bluetooth vers le PC) afin que celles-ci puissent être ingérées par **[NectarMC](https://github.com/mlavardin/NectarMC)**.

---

## 📡 1. Trame Radio LoRa (Côté bord → Station sol)

Une trame NectarMC côté bord est composée de trois blocs contigus : **Header**, **Payload** et **Packet Control** (optionnel).

### Option A : CRC matériel (Recommandé & Par défaut)

Le contrôle d'intégrité est pris en charge directement par le silicium de la puce SX1276. Le paquet LoRa ne contient que le Header et la Payload.
* **Taille totale** : `4 + N` octets (où `N` est la taille des données utiles).

```
┌─────────────────────────────────────────────────────────────────────────┬───────────────────┐
│                                 HEADER                                  │      PAYLOAD      │
├─────────────┬─────────────────────────────────────────────┬─────────────┼───────────────────┤
│   MAGIC     │                 Id_mission                  │payload_size │      N data       │
│   1 Byte    │                  2 Bytes                    │   1 Byte    │       bytes       │
│    0xEB     │         (SSID & APID Little-Endian)         │ (valeur N)  │     (N bytes)     │
└─────────────┴─────────────────────────────────────────────┴─────────────┴───────────────────┘
```

### Option B : CRC logiciel (Si le CRC matériel est désactivé)

Si le CRC matériel est désactivé (`AT+CRC=0`), l'émetteur calcule un CRC16 logiciel et l'ajoute en queue de payload. L'ESP32 de la station sol le vérifie avant de valider le paquet.
* **Taille totale** : `6 + N` octets.

```
┌─────────────────────────────────────────────────────────────────────────┬───────────────────┬───────────────────┐
│                                 HEADER                                  │      PAYLOAD      │  PACKET CONTROL   │
├─────────────┬─────────────────────────────────────────────┬─────────────┼───────────────────┼───────────────────┤
│   MAGIC     │                 Id_mission                  │payload_size │      N data       │       CRC16       │
│   1 Byte    │                  2 Bytes                    │   1 Byte    │       bytes       │      2 Bytes      │
│    0xEB     │         (SSID & APID Little-Endian)         │ (valeur N)  │     (N bytes)     │    (Software)     │
└─────────────┴─────────────────────────────────────────────┴─────────────┴───────────────────┴───────────────────┘
```

> [!WARNING]
> **Validation stricte (v1.6.1)** : Toute trame ne commençant pas par le Magic byte `0xEB`, de taille inférieure à 4 octets, ou ayant un décalage de taille de charge utile (`payload_size`) incorrect est **rejetée** par la station sol. Les trames historiques sans Magic byte ne sont plus acceptées.

---

## Header (4 bytes)

### Magic byte (Byte 0)

Ce champ est codé par un `uint8_t`.

Il représente un octet de synchronisation. Sa présence permet à **NectarMC** de se **resynchroniser rapidement** après un problème de transmission : il scanne le buffer jusqu'à la prochaine occurrence de `0xEB` plutôt que de tenter un parsing octet par octet.

Le choix de `0xEB` repose sur deux critères :
- **Convention aérospatiale** — c'est le préfixe du mot de synchronisation IRIG-106 (`0xEB90`).
- **Propriétés binaires** — le motif `1110 1011` présente une densité de transitions élevée, le rendant statistiquement peu probable dans un flux de données aléatoires.

### Id_mission (Bytes 1–2)

Ce champ est codé par un `uint16_t` en **Little-Endian**.

Les 16 bits encodent le **SSID** (10 bits, poids fort) et l'**APID** (6 bits, poids faible).

Le SSID identifie la **mission** (la fusée ou l'engin émetteur). Il est subdivisé en **TYPE** (bits 9–8) et **NUM** (bits 7–0, valeur 0–255).

```
Bits:  |15  14  13  12  11  10   9   8   7   6 | 5   4   3   2   1   0|
       ├───────────── SSID (10 bits) ──────────┼───── APID (6 bits) ──┤
       │        TYPE      │      NUM (0-255)   │     Application ID   │
       │      (2 bits)    │      (8 bits)      │        (0-63)        │
```

Les quatre types disponibles :

| Bits 9–8 | Préfixe    |
|:--------:|------------|
| `00`     | `FX`       |
| `01`     | `MF`       |
| `10`     | `BALLOON`  |
| `11`     | `OTHER`    |

Le champ `NUM` peut valoir une valeur entre 0 et 255.

#### Exemples de SSID encodés :

| Identifiant  | Type (bits) | NUM (déc.) | SSID (hex) | SSID (bin)       |
|:------------:|:-----------:|:----------:|:----------:|:----------------:|
| `FX99`       | `00`        | 99         | `0x063`    | `00 01100011`    |
| `FX7`        | `00`        | 7          | `0x007`    | `00 00000111`    |
| `MF12`       | `01`        | 12         | `0x10C`    | `01 00001100`    |
| `BALLOON3`   | `10`        | 3          | `0x203`    | `10 00000011`    |
| `OTHER200`   | `11`        | 200        | `0x3C8`    | `11 11001000`    |

L'**APID** ou **Application Process Identifier** identifie le type de trame au sein d'une même mission. Valeur sur 6 bits : `0–63`.

Le router NectarMC utilise la paire `(SSID, APID)` comme clé pour acheminer la trame vers la bonne décom.

### payload_size (Byte 3)

Ce champ est codé par un `uint8_t`. Il contient le nombre d'octets `N` de la charge utile (payload) qui suit immédiatement.

### Description des octets de la trame radio

| Index | Type | Champ | Description |
| :---: | :---: | :--- | :--- |
| **0** | `uint8_t` | `MAGIC` | Octet de synchronisation. Vaut toujours `0xEB`. |
| **1–2** | `uint16_t` | `Id_mission` | Identifiant de mission Little-Endian. Encode SSID (10 bits) et APID (6 bits). |
| **3** | `uint8_t` | `payload_size` | Longueur `N` de la charge utile (payload). |
| **4 à 3+N** | `uint8_t[]` | `Payload` | Charge utile contenant les données brutes des capteurs (`N` octets). |
| **4+N à 5+N** | `uint16_t` | `CRC16` | *(Option B uniquement)* CRC16 logiciel Little-Endian sur les octets 0 à `3+N`. |

---

## 💻 2. Trame Série NectarMC (Station sol → PC)

Lorsque la station sol a validé une trame radio, elle l'encapsule dans une trame binaire conforme au protocole NectarMC pour l'envoyer au PC sur le port série USB ou Bluetooth. Quatre formats sont configurables via la commande `AT+FMT=<0-3>`.

---

### A. Formats avec GSFLAG (Formats 1, 2 et 3)

Ces formats proposent un en-tête de **5 octets** intégrant l'octet `gs_flag` (Ground Station Flag) à l'index 3. Le footer s'adapte dynamiquement selon le masque de bits de `gs_flag`.

* **Taille totale** : `5 + N + M + T + 3` octets

  Où `N` = taille payload, `M` = métadonnées RSSI/SNR (0 à 2 octets), `T` = Timestamp (0 ou 4 octets).

```
┌───────────────────────────────────────────────────────────┬───────────────────┬───────────────────────────────────────┬─────────────────────────┐
│                          HEADER                           │      PAYLOAD      │               METADATA                │     PACKET CONTROL      │
├─────────────┬──────────────┬──────────────┬───────────────┼───────────────────┼───────────┬───────────┬───────────────┼───────────────┬─────────┤
│   MAGIC     │  Id_mission  │   gs_flag    │ payload_size  │      N data       │   RSSI    │    SNR    │   Timestamp   │     CRC16     │ Newline │
│   1 Byte    │   2 Bytes    │    1 Byte    │    1 Byte     │      bytes        │  (Option) │  (Option) │  (0 or 4 B)   │    2 Bytes    │ 1 Byte  │
│    0xEB     │ (Little-End) │   (Bitmask)  │   (N bytes)   │                   │  1 Byte   │  1 Byte   │ (uint32_t LE) │ (Little-End)  │  0x0A   │
└─────────────┴──────────────┴──────────────┴───────────────┴───────────────────┴───────────┴───────────┴───────────────┴───────────────┴─────────┘
```

#### Les trois configurations de GSFLAG :

| Format | Commande AT | `gs_flag` | RSSI | SNR | Timestamp | Taille totale |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **2** *(défaut)* | `AT+FMT=2` | `0x03` | ✅ 1B | ✅ 1B | ❌ | `9 + N` |
| **1** | `AT+FMT=1` | `0x3F` | ✅ 1B | ✅ 1B | ✅ 4B | `13 + N` |
| **3** | `AT+FMT=3` | `0x00` | ❌ | ❌ | ❌ | `8 + N` |

### gs_flag (Byte 3)

Le **Ground Station Flag** est codé par un `uint8_t`. Chaque bit indique à **NectarMC** si un champ doit être ajouté dans le footer :

```
bit7    bit6    bit5    bit4    bit3    bit2    bit1    bit0
                                                 |       |
                                                 |       └──────── RSSI
                                                 └──────────────── SNR
└──────────────── Réservés ─────────────────┘
```

> À ce jour, seuls 2 flags sont utilisés (bits 0 et 1). Les bits 2 à 5 sont réservés pour le Timestamp.

* **RSSI** : Présent si `(gs_flag & 0x01) == 1`. Entier signé `int8_t` exprimé directement en dBm.
* **SNR** : Présent si `(gs_flag & 0x02) == 2`. Entier signé `int8_t` codé en **quarts de dB** (SNR réel = valeur / 4). Exemple : un SNR de 8.5 dB est transmis `34`.
* **Timestamp** : Présent si `(gs_flag & 0x3C) != 0`. Horodatage Unix Epoch (secondes) Little-Endian sur 4 octets issu de la RTC de la station.

### payload_size (Byte 4)

Ce champ est codé par un `uint8_t`.

Nombre d'octets de la payload qui suit. Le parseur lit exactement ce nombre d'octets après le header avant d'atteindre le footer.

### Description détaillée des octets (Formats 1, 2, 3) :

| Index | Type | Champ | Description |
| :---: | :---: | :--- | :--- |
| **0** | `uint8_t` | `MAGIC` | Octet de synchronisation. Vaut toujours `0xEB`. |
| **1–2** | `uint16_t` | `Id_mission` | Identifiant de mission Little-Endian. Encode SSID (10 bits) et APID (6 bits). |
| **3** | `uint8_t` | `gs_flag` | Masque de bits des métadonnées footer (`0x3F`, `0x03` ou `0x00`). |
| **4** | `uint8_t` | `payload_size` | Longueur `N` de la charge utile LoRa brute. |
| **5 à 4+N** | `uint8_t[]` | `Payload` | Données brutes LoRa (`N` octets). |
| **5+N** | `int8_t` | `RSSI` | *(si bit 0 de gs_flag)* RSSI en dBm. |
| **5+N+M₁** | `int8_t` | `SNR` | *(si bit 1 de gs_flag)* SNR en quarts de dB. |
| **5+N+M₁+M₂** | `uint32_t` | `Timestamp` | *(si bits 2–5 de gs_flag)* Epoch Unix LE (4 octets). |
| **5+N+M₁+M₂+T** | `uint16_t` | `CRC16` | CRC16-CCITT Little-Endian (2 octets). Calculé sur tous les octets précédents (index 0 à `4+N+M₁+M₂+T`). |
| **7+N+M₁+M₂+T** | `char` | `Newline` | Terminaison de trame `\n` (`0x0A`). |

> Où `M₁` = 1 si RSSI présent, 0 sinon. `M₂` = 1 si SNR présent, 0 sinon. `T` = 4 si Timestamp présent, 0 sinon.

---

### B. Format sans GSFLAG (Format 0 — Historique v1.3.1)

Ce format binaire minimaliste n'inclut ni `gs_flag`, ni métadonnée réseau. Son en-tête fait **4 octets**.
* **Taille totale** : `7 + N` octets.

```
┌───────────────────────────────────────────┬───────────────────┬─────────────────────────┐
│                  HEADER                   │      PAYLOAD      │     PACKET CONTROL      │
├─────────────┬──────────────┬──────────────┼───────────────────┼───────────────┬─────────┤
│   MAGIC     │  Id_mission  │ payload_size │      N data       │     CRC16     │ Newline │
│   1 Byte    │   2 Bytes    │   1 Byte     │      bytes        │    2 Bytes    │ 1 Byte  │
│    0xEB     │ (Little-End) │   (N bytes)  │                   │ (Little-End)  │  0x0A   │
└─────────────┴──────────────┴──────────────┴───────────────────┴───────────────┴─────────┘
```

### Description détaillée des octets (Format 0) :

| Index | Type | Champ | Description |
| :---: | :---: | :--- | :--- |
| **0** | `uint8_t` | `MAGIC` | Octet de synchronisation. Vaut toujours `0xEB`. |
| **1–2** | `uint16_t` | `Id_mission` | Identifiant de mission Little-Endian. Encode SSID (10 bits) et APID (6 bits). |
| **3** | `uint8_t` | `payload_size` | Longueur `N` de la charge utile LoRa brute. |
| **4 à 3+N** | `uint8_t[]` | `Payload` | Données brutes LoRa (`N` octets). |
| **4+N à 5+N** | `uint16_t` | `CRC16` | CRC16-CCITT Little-Endian sur les octets 0 à `3+N`. |
| **6+N** | `char` | `Newline` | Retour à la ligne `\n` (`0x0A`). |

---

## Payload

La Payload est la partie **personnalisable** des trames. C'est ici que l'équipe du projet définit ses capteurs ou tout autre paramètre devant redescendre au sol dans la télémétrie.

Si l'utilisateur souhaite décommuter la payload (et non simplement la stocker en brut), il faut fournir un fichier JSON décrivant chaque champ de la payload à **NectarMC**.

---

## 📈 Historique et Évolution des Versions

Pour s'assurer que vos parseurs côté PC fonctionnent correctement, voici le récapitulatif des versions et l'impact sur le format des trames :

| Version | Format AT+FMT | Taille Trame Série | En-tête / Métadonnées |
| :---: | :---: | :---: | :--- |
| **v1.6.1 (Actuelle)** | `AT+FMT=2` (Par défaut) | `9 + N` | Header 5 octets (`gs_flag = 0x03`). RSSI + SNR. Pas de Timestamp. |
| | `AT+FMT=1` | `13 + N` | Header 5 octets (`gs_flag = 0x3F`). RSSI + SNR + Timestamp (4B). |
| | `AT+FMT=3` | `8 + N` | Header 5 octets (`gs_flag = 0x00`). Aucune métadonnée. |
| | `AT+FMT=0` | `7 + N` | Header 4 octets (sans `gs_flag`). Format historique v1.3.1. |
| **v1.3.1** | — | `7 + N` | Header 4 octets. Aucun champ supplémentaire. |

---

## Liens Utiles
* **[README.md](./README.md)** : Retourner à la page principale.
* **[CRC_GUIDE.md](./CRC_GUIDE.md)** : Guide explicatif des deux niveaux de CRC (Liaison Radio et Liaison Série).
* **[NectarMC — Format officiel](https://github.com/mlavardin/NectarMC/blob/master/DOCUMENTATION/FRAME_FORMAT.md)** : Documentation officielle du format de trame NectarMC.
* **[src/serial.cpp](./src/serial.cpp)** : Code source de formatage et d'envoi de la trame série vers le PC.

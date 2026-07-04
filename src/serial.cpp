/**
 * @file serial.cpp
 * @brief Gestion de la liaison série USB et Bluetooth pour l'envoi des trames NectarMC.
 * @version 1.6.1
 * @author Paul Miailhe
 * @date 27/06/2026
 * 
 * Version 1.6.1 : Refactorisation multitâche dual-core (FreeRTOS) et écran OLED séparé.
 */

#include "header.h"

#if ENABLE_BLUETOOTH
BluetoothSerial SerialBT;
#endif

/**
 * @brief Calcule le CRC16-CCITT d'un tableau d'octets.
 * @param data Pointeur vers le tableau de données.
 * @param len Longueur du tableau de données.
 * @return Valeur du CRC16 calculé.
 * 
 * Utilise le polynôme standard 0x1021 avec une valeur initiale de 0xFFFF.
 */
uint16_t calculate_crc16(const uint8_t *data, size_t len) {
    if (data == nullptr || len == 0) {
        return 0xFFFF;
    }
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; ++i) {
        crc ^= (data[i] << 8);
        for (int j = 0; j < 8; ++j) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

/**
 * @brief Construit, valide et émet une trame conforme au protocole NectarMC.
 * @param ssid_type Type de tracker (0: FX, 1: MF, 2: BALLOON, 3: OTHER).
 * @param ssid_num Numéro unique de tracker.
 * @param apid Identifiant d'application (Application Process Identifier).
 * @param payload Pointeur vers les données utiles de la trame.
 * @param len Longueur des données utiles en octets.
 * 
 * Cette fonction assemble :
 * - Le header NectarMC (octet magic 0xEB, identifiant de mission encodé sur 16 bits en Little-Endian, taille de payload).
 * - La charge utile (payload).
 * - Le CRC16-CCITT calculé sur le header et la payload.
 * La trame finale est émise sur USB (Serial) et Bluetooth (SerialBT) si un appareil est appairé.
 * Un caractère '\n' est ajouté en fin de trame pour en faciliter l'enregistrement.
 */
void sendNectarFrame(uint16_t id_mission, const uint8_t *payload, size_t len, int8_t rssi, int8_t snr) {
    // 1. Limiter la longueur brute de LoRa à 250 octets max pour laisser de la place
    if (len > 250) {
        len = 250;
    }

    uint8_t frame[275];
    size_t frameIndex = 0;

    // Écriture unique du header commun NectarMC
    frame[0] = NECTAR_MAGIC;
    frame[1] = id_mission & 0xFF;
    frame[2] = (id_mission >> 8) & 0xFF;

    // 3. Assembler le buffer série selon le format configuré
    if (activeConfig.activeFrameFormat >= 1) {
        // --- FORMAT AVEC GSFLAG ---
        // Header (5 octets) : MAGIC | Id_mission (2B) | gs_flag (1B) | payload_size (1B)
        uint8_t gs_flag = 0x00;
        if (activeConfig.activeFrameFormat == 1) {
            gs_flag = 0x3F; // RSSI + SNR + Timestamp
        } else if (activeConfig.activeFrameFormat == 2) {
            gs_flag = 0x03; // RSSI + SNR
        } else if (activeConfig.activeFrameFormat == 3) {
            gs_flag = 0x00; // Pas de métadonnées, GSFLAG à 0
        }
        
        frame[3] = gs_flag;
        frame[4] = (uint8_t)(len & 0xFF);
        frameIndex = 5;

        // Payload LoRa
        if (len > 0 && payload != nullptr) {
            memcpy(frame + frameIndex, payload, len);
        }
        frameIndex += len;

        // Footer conditionnel
        if (gs_flag & 0x01) {
            frame[frameIndex++] = (uint8_t)rssi;
        }
        if (gs_flag & 0x02) {
            frame[frameIndex++] = (uint8_t)snr;
        }

        // Ajout conditionnel du Timestamp Unix Epoch (4 octets - Little-Endian)
        if (gs_flag & 0x3C) {
            uint32_t epoch = rtc.getEpoch();
            frame[frameIndex++] = epoch & 0xFF;
            frame[frameIndex++] = (epoch >> 8) & 0xFF;
            frame[frameIndex++] = (epoch >> 16) & 0xFF;
            frame[frameIndex++] = (epoch >> 24) & 0xFF;
        }

        // Calcul du CRC16 sur l'ensemble [Header + Payload + Footer + (Timestamp si présent)]
        uint16_t crc = calculate_crc16(frame, frameIndex);
        frame[frameIndex++] = crc & 0xFF;
        frame[frameIndex++] = (crc >> 8) & 0xFF;
        frame[frameIndex++] = '\n';
    }
    else {
        // --- FORMAT SANS GSFLAG (Original - v1.3.1 / master) ---
        // Header (4 octets) : MAGIC | Id_mission (2B) | payload_size (1B)
        frame[3] = (uint8_t)(len & 0xFF);
        frameIndex = 4;

        // Payload LoRa
        if (len > 0 && payload != nullptr) {
            memcpy(frame + frameIndex, payload, len);
        }
        frameIndex += len;

        // CRC16 sur [Header + Payload] uniquement (sans metadata)
        uint16_t crc = calculate_crc16(frame, frameIndex);
        frame[frameIndex++] = crc & 0xFF;
        frame[frameIndex++] = (crc >> 8) & 0xFF;
        frame[frameIndex++] = '\n';
    }

    // 4. Émettre la trame complète en un seul appel (Série USB)
    Serial.write(frame, frameIndex);

#if ENABLE_BLUETOOTH
    // 5. Émettre également en Bluetooth si un client est connecté.
    if (SerialBT.connected()) {
        SerialBT.write(frame, frameIndex);
    }
#endif
}
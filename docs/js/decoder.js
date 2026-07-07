/**
 * @file decoder.js
 * @brief Fonctions de calcul d'intégrité (CRC) et de décodage binaire des paquets NectarMC et WASP.
 * Zéro interaction DOM pour une réutilisabilité et testabilité maximale.
 */

/**
 * Calcule le CRC16-CCITT (polynôme 0x1021, valeur initiale 0xFFFF).
 * @param {Uint8Array|number[]} data Tableau d'octets.
 * @returns {number} Valeur du CRC16 calculé.
 */
export function calculateCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data[i] << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

/**
 * Décode une trame NectarMC brute.
 * @param {Uint8Array|number[]} frame Octets de la trame reçue.
 * @param {string} fwVersion Version du firmware ('gs_flag' ou autre).
 * @returns {Object} Objet structuré contenant l'en-tête, la payload, les métriques et les infos CRC.
 * @throws {Error} Si le CRC reçu est différent du CRC calculé.
 */
export function decodeNectarFrame(frame, fwVersion) {
  let payloadSize = 0;
  let payloadOffset = 4;
  let epoch = 0;
  let crc = 0;
  let calculatedCrc = 0;
  let rssi = 0;
  let snr = 0;
  let gsFlag = 0;

  if (fwVersion === 'gs_flag') {
    payloadOffset = 5;
    gsFlag = frame[3];
    payloadSize = frame[4];
    
    let footerOffset = 5 + payloadSize;
    if (gsFlag & 0x01) {
      const rawRssi = frame[footerOffset++];
      rssi = rawRssi >= 128 ? rawRssi - 256 : rawRssi;
    }
    if (gsFlag & 0x02) {
      const rawSnr = frame[footerOffset++];
      const signedSnr = rawSnr >= 128 ? rawSnr - 256 : rawSnr;
      snr = signedSnr / 4.0;
    }
    
    // Lecture du Timestamp (4 octets Unix Epoch Little-Endian) si présent
    if (gsFlag & 0x3C) {
      epoch = (frame[footerOffset + 3] << 24 >>> 0) +
              (frame[footerOffset + 2] << 16) +
              (frame[footerOffset + 1] << 8) +
              frame[footerOffset];
      footerOffset += 4;
    }
    
    crc = (frame[footerOffset + 1] << 8) | frame[footerOffset];
    calculatedCrc = calculateCRC16(frame.slice(0, footerOffset));
  } else { // 1.3.1 (Original sans GSFLAG)
    payloadSize = frame[3];
    payloadOffset = 4;
    rssi = 0;
    snr = 0;
    
    crc = (frame[4 + payloadSize + 1] << 8) | frame[4 + payloadSize];
    calculatedCrc = calculateCRC16(frame.slice(0, 4 + payloadSize));
  }

  // Vérification de l'intégrité de la trame
  if (crc !== calculatedCrc) {
    throw new Error(`CRC check failed. Received: 0x${crc.toString(16).toUpperCase().padStart(4, '0')}, Calculated: 0x${calculatedCrc.toString(16).toUpperCase().padStart(4, '0')}`);
  }

  const idMission = (frame[2] << 8) | frame[1];
  const ssid = idMission >> 6;
  const apid = idMission & 0x3F;
  const ssidType = (ssid >> 8) & 0x03;
  const ssidNum = ssid & 0xFF;
  
  const payload = frame.slice(payloadOffset, payloadOffset + payloadSize);

  let ssidPrefix = 'OTHER';
  let missionTypeLabelKey = 'mission_other';
  if (ssidType === 0) {
    ssidPrefix = 'FX';
    missionTypeLabelKey = 'mission_rocket';
  } else if (ssidType === 1) {
    ssidPrefix = 'MF';
    missionTypeLabelKey = 'mission_minirocket';
  } else if (ssidType === 2) {
    ssidPrefix = 'BALLOON';
    missionTypeLabelKey = 'mission_balloon';
  }
  
  const trackerName = `${ssidPrefix}${ssidNum}`;

  return {
    header: {
      idMission,
      ssid,
      apid,
      ssidType,
      ssidNum,
      trackerName,
      missionTypeLabelKey
    },
    payload,
    metrics: {
      rssi,
      snr,
      timestamp: epoch
    },
    crc: {
      received: crc,
      calculated: calculatedCrc
    }
  };
}

/**
 * Décode la charge utile (payload) géodésique WASP.
 * @param {Uint8Array|number[]} payload Tableau d'octets de taille 29.
 * @returns {Object} Objet structuré contenant les indicateurs GPS et physiques.
 */
export function decodeWaspPayload(payload) {
  const buffer = new ArrayBuffer(29);
  const view = new DataView(buffer);
  for (let i = 0; i < 29; i++) {
    view.setUint8(i, payload[i]);
  }
  
  const utc = view.getUint32(0, true);
  const lat = view.getFloat32(4, true);
  const lon = view.getFloat32(8, true);
  const alt = view.getFloat32(12, true);
  const spd = view.getFloat32(16, true);
  const cog = view.getFloat32(20, true);
  const vbatRaw = view.getUint16(24, true);
  const tempRaw = view.getInt16(26, true);
  const status = view.getUint8(28);
  
  const gpsFix = (status & 0x80) !== 0;
  const numSats = status & 0x1F;
  const vbat = vbatRaw / 1000.0;
  const temp = tempRaw / 100.0;

  // Controle de coherence strict (garde-fou pour trames non-WASP de 29 octets)
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || numSats > 32 || vbat > 15.0 || Math.abs(temp) > 100) {
    throw new Error("Controle de coherence WASP echoue (valeurs physiques aberrantes)");
  }

  return {
    utc,
    lat,
    lon,
    alt,
    spd,
    cog,
    vbat,
    temp,
    gpsFix,
    numSats
  };
}

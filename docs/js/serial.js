/**
 * @file serial.js
 * @brief Gestion de l'acquisition Web Serial et du flashage d'ESP32 pour RocketStation.
 */

import { ESPLoader, Transport } from 'https://cdn.jsdelivr.net/npm/esptool-js@0.6.0/+esm';
import { decodeNectarFrame } from './decoder.js';

export class NectarSerial {
  constructor(callbacks = {}) {
    this.port = null;
    this.reader = null;
    this.isConnected = false;
    this.rxBuffer = [];
    this.readLoopPromise = null;
    
    // Callbacks d'interaction avec le contrôleur d'IHM
    this.onPacket = callbacks.onPacket || null;
    this.onLine = callbacks.onLine || null;
    this.onLog = callbacks.onLog || null;
    this.onBytesRead = callbacks.onBytesRead || null;
    this.onConnectionChanged = callbacks.onConnectionChanged || null;
  }

  /**
   * Tente d'ouvrir une connexion Web Serial avec le périphérique sélectionné.
   * @param {number} baudRate Vitesse de transmission (ex: 115200).
   * @param {string} fwVersionFormat Format de trame actif ('gs_flag' ou autre).
   */
  async connect(baudRate, fwVersionFormat) {
    if (!('serial' in navigator)) {
      throw new Error("unsupported");
    }

    try {
      this.port = await navigator.serial.requestPort();
      this.log(`Ouverture du port série à ${baudRate} baud...`, 'sys-out');
      
      await this.port.open({ baudRate });
      this.isConnected = true;
      
      const portInfo = this.port.getInfo();
      const friendlyName = this.getFriendlyPortName(portInfo);
      
      if (this.onConnectionChanged) {
        this.onConnectionChanged(true, friendlyName);
      }
      
      this.log("Connexion établie avec succès.", 'sys-out');

      // Démarrage de la boucle de lecture
      this.readLoopPromise = this.readSerialLoop(fwVersionFormat);
    } catch (err) {
      this.log(`Erreur de connexion : ${err.message}`, 'sys-out');
      this.disconnect();
      throw err;
    }
  }

  /**
   * Ferme proprement la connexion série et libère le lecteur.
   */
  async disconnect() {
    if (!this.isConnected && !this.port) return;
    this.isConnected = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (err) {}
    }

    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch (err) {}
      this.readLoopPromise = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {
        console.error("Erreur de fermeture du port série:", err);
      }
      this.port = null;
    }

    if (this.onConnectionChanged) {
      this.onConnectionChanged(false, '');
    }
    
    this.log("Liaison série déconnectée.", 'sys-out');
  }

  /**
   * Boucle continue d'acquisition d'octets.
   * @private
   */
  async readSerialLoop(fwVersionFormat) {
    try {
      while (this.port && this.port.readable && this.isConnected) {
        this.reader = this.port.readable.getReader();
        try {
          while (this.isConnected) {
            const { value, done } = await this.reader.read();
            if (done) {
              break;
            }
            if (value && value.length > 0) {
              if (this.onBytesRead) {
                this.onBytesRead(value.length);
              }
              
              // Accumulation
              for (let i = 0; i < value.length; i++) {
                this.rxBuffer.push(value[i]);
              }
              
              // Parsing immédiat (interruption)
              this.parseRxBuffer(fwVersionFormat);
            }
          }
        } catch (err) {
          this.log(`Erreur de lecture : ${err.message}`, 'sys-out');
          break;
        } finally {
          if (this.reader) {
            this.reader.releaseLock();
            this.reader = null;
          }
        }
      }
    } finally {
      if (this.isConnected) {
        setTimeout(() => this.disconnect(), 0);
      }
    }
  }

  /**
   * Analyse le buffer de réception pour isoler les trames binaires et les lignes de texte.
   * @private
   */
  parseRxBuffer(fwVersionFormat) {
    let processing = true;

    while (processing && this.rxBuffer.length > 0) {
      // 1. Détection de trame binaire NectarMC (Magic Byte 0xEB)
      if (this.rxBuffer[0] === 0xEB) {
        let totalFrameSize = 0;

        if (fwVersionFormat === 'gs_flag') {
          if (this.rxBuffer.length < 5) {
            processing = false;
            break;
          }
          const gsFlag = this.rxBuffer[3];
          const payloadSize = this.rxBuffer[4];
          const hasRssi = (gsFlag & 0x01) ? 1 : 0;
          const hasSnr = (gsFlag & 0x02) ? 1 : 0;
          const hasTimestamp = (gsFlag & 0x3C) ? 4 : 0;
          // v1.6.2 : Pas de Newline \n à la fin de la trame
          totalFrameSize = 5 + payloadSize + hasRssi + hasSnr + hasTimestamp + 2;
        } else {
          // Format historique v1.3.1
          if (this.rxBuffer.length < 4) {
            processing = false;
            break;
          }
          const payloadSize = this.rxBuffer[3];
          totalFrameSize = 4 + payloadSize + 2 + 1; // Avec Newline \n
        }

        if (this.rxBuffer.length < totalFrameSize) {
          processing = false;
          break;
        }

        const frameBytes = this.rxBuffer.slice(0, totalFrameSize);
        this.rxBuffer = this.rxBuffer.slice(totalFrameSize);

        try {
          const decoded = decodeNectarFrame(frameBytes, fwVersionFormat);
          if (this.onPacket) {
            this.onPacket(decoded);
          }
        } catch (decErr) {
          console.error("Erreur de décodage:", decErr);
          this.log(`[ERREUR DECODAGE] Trame rejetée : ${decErr.message}`, 'sys-out');
        }
      } 
      // 2. Détection de lignes textuelles brutes
      else {
        const lfIndex = this.rxBuffer.indexOf(10);
        const crIndex = this.rxBuffer.indexOf(13);

        let splitIndex = -1;
        if (lfIndex !== -1 && crIndex !== -1) {
          splitIndex = Math.min(lfIndex, crIndex);
        } else {
          splitIndex = lfIndex !== -1 ? lfIndex : crIndex;
        }

        if (splitIndex !== -1) {
          const lineBytes = this.rxBuffer.slice(0, splitIndex);
          
          let skipBytes = splitIndex + 1;
          if (this.rxBuffer[splitIndex] === 13 && this.rxBuffer[splitIndex + 1] === 10) {
            skipBytes = splitIndex + 2;
          }
          this.rxBuffer = this.rxBuffer.slice(skipBytes);

          const decoder = new TextDecoder();
          const lineText = decoder.decode(new Uint8Array(lineBytes)).trim();
          
          if (lineText.length > 0) {
            if (this.onLine) {
              this.onLine(lineText);
            }
          }
        } else {
          // Vider le buffer si le texte accumulé est anormalement long pour éviter les fuites mémoire
          if (this.rxBuffer.length > 1024) {
            this.rxBuffer = [];
          }
          processing = false;
        }
      }
    }
  }

  /**
   * Envoie une commande AT textuelle avec retour chariot (\n) sur le port série.
   * @param {string} text Commande textuelle.
   */
  async sendSerialText(text) {
    if (!this.port || !this.port.writable) return;
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text + '\n');
      
      const writer = this.port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      
      if (this.onLine) {
        this.onLine(text); // Écho local dans la console
      }
    } catch (err) {
      this.log(`Erreur d'envoi : ${err.message}`, 'sys-out');
      console.error("Erreur sendSerialText:", err);
    }
  }

  /**
   * Flashe le firmware sur la carte ESP32 via esptool-js.
   * @param {string} binUrl URL de téléchargement du binaire .bin.
   * @param {Function} onProgress Callback (percent, statusKey, extraParam).
   * @param {Function} onLog Callback pour les messages de journalisation brute.
   */
  async flashFirmware(binUrl, onProgress, onLog) {
    let esploader = null;
    let transport = null;
    
    const customTerminal = {
      clean() {},
      writeLine(data) {
        if (onLog) onLog(data);
      },
      write(data) {
        if (onLog) onLog(data);
      }
    };

    try {
      if (onLog) onLog("Sélection du port série pour le flash (choisissez le port de votre carte)...");
      const flashPort = await navigator.serial.requestPort();
      
      transport = new Transport(flashPort, true);
      esploader = new ESPLoader({
        transport: transport,
        terminal: customTerminal,
        baudrate: 115200
      });
      
      if (onProgress) onProgress(0, 'flash_status_syncing');
      await esploader.main();
      
      if (onProgress) onProgress(0, 'flash_status_chip', esploader.chipName);
      if (onLog) onLog(`Téléchargement du firmware depuis ${binUrl}...`);
      
      const response = await fetch(binUrl + '?t=' + Date.now());
      if (!response.ok) {
        throw new Error(`Impossible de récupérer le binaire (${response.statusText})`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const firmwareData = new Uint8Array(arrayBuffer);
      
      if (onProgress) onProgress(0, 'flash_status_writing');
      if (onLog) onLog("Début de l'écriture de l'application à 0x10000...");
      
      const fileArray = [
        { data: firmwareData, address: 0x10000 }
      ];
      
      await esploader.writeFlash({
        fileArray: fileArray,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          const percent = Math.round((written / total) * 100);
          if (onProgress) onProgress(percent, 'flash_status_writing');
        }
      });
      
      if (onProgress) onProgress(100, 'flash_status_success');
      if (onLog) onLog("Mise à jour terminée ! Redémarrage de la carte...");
      
      // Redémarrer la carte matériellement
      await transport.setDTR(false);
      await new Promise(resolve => setTimeout(resolve, 100));
      await transport.setDTR(true);
      
    } catch (err) {
      if (onProgress) onProgress(0, 'flash_status_failed');
      if (onLog) onLog(`Erreur lors du flash : ${err.message}`);
      throw err;
    } finally {
      if (transport) {
        try {
          await transport.disconnect();
        } catch (err) {}
      }
    }
  }

  /**
   * Journalise un log de statut.
   * @private
   */
  log(message, type = 'cmd-out') {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }

  /**
   * Retourne un nom compréhensible pour la puce USB de communication.
   * @private
   */
  getFriendlyPortName(portInfo) {
    const vid = portInfo.usbVendorId;
    const pid = portInfo.usbProductId;
    
    if (vid === undefined || pid === undefined) {
      return localStorage.getItem('nectar_lang') === 'en' ? "Unknown Serial Device" : "Appareil Série Inconnu";
    }
    
    const hexVid = `0x${vid.toString(16).toUpperCase().padStart(4, '0')}`;
    const hexPid = `0x${pid.toString(16).toUpperCase().padStart(4, '0')}`;
    
    const chipsets = {
      "0x10C4": {
        name: "Silicon Labs CP210x (USB-to-UART Bridge)",
        pids: { "0xEA60": "CP2102/CP2109" }
      },
      "0x1A86": {
        name: "WCH CH340/CH341 (USB-to-Serial)",
        pids: { "0x7523": "CH340" }
      },
      "0x0403": {
        name: "FTDI USB Serial",
        pids: { "0x6001": "FT232R" }
      },
      "0x067B": {
        name: "Prolific PL2303",
        pids: { "0x2303": "PL2303 TA" }
      },
      "0x2341": {
        name: "Arduino",
        pids: {
          "0x0043": "Uno R3",
          "0x0001": "Uno",
          "0x0042": "Mega 2560 R3"
        }
      },
      "0x303A": {
        name: "Espressif USB-JTAG-Serial",
        pids: {
          "0x1001": "ESP32-S3/C3 USB"
        }
      }
    };
    
    const chipset = chipsets[hexVid];
    if (chipset) {
      const specificModel = chipset.pids[hexPid] || "";
      return `${chipset.name}${specificModel ? ` (${specificModel})` : ''} [VID: ${hexVid}, PID: ${hexPid}]`;
    }
    
    return `USB Device [VID: ${hexVid}, PID: ${hexPid}]`;
  }
}

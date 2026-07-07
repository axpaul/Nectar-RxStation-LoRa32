/**
 * @file app.js
 * @brief Point d'entrée principal et orchestrateur de l'interface (NectarApp).
 * Version modulaire, optimisée et persistante (IndexedDB & LocalStorage).
 */

import { NectarSerial } from './serial.js';
import { NectarMap } from './map.js';
import { getTranslation, updateLanguage } from './translate.js';
import { decodeWaspPayload } from './decoder.js';
import { 
  saveFrame, 
  loadFrames, 
  clearFrames, 
  saveTrackersState, 
  loadTrackersState, 
  saveWaspTrackersData, 
  loadWaspTrackersData, 
  saveActiveWaspTracker, 
  loadActiveWaspTracker,
  clearAllStorage
} from './storage.js';

// Convertit un tableau d'octets en chaîne hexadécimale continue
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
}

class NectarApp {
  constructor() {
    this.serial = null;
    this.map = null;
    
    // États de l'application
    this.packetIndex = 0;
    this.crcErrorsCount = 0;
    this.activeTrackers = {};     // { trackerName: { name, typeLabelKey, lastApid, packetCount, lastSeen, lastPayloadHex, lastRssi, lastSnr, isLost } }
    this.allReceivedFrames = [];  // Capé à 5000 trames
    this.waspTrackersData = {};   // { trackerName: { alt, spd, ... } }
    this.activeWaspTrackerName = "";
    
    // Graphiques de signal
    this.maxChartPoints = 30;
    this.rssiHistory = [];
    this.snrHistory = [];
    
    // Débit série
    this.bytesCountThisSecond = 0;
    this.throughputHistory = Array(30).fill(0);
    
    // Configuration Radio Active
    this.currentConfig = {
      frequency: 869.525,
      sf: 8,
      bw: 250.0
    };
    this.currentPortName = '';
    
    // Variables pour les journaux SD
    this.isDownloadingSdFile = false;
    this.sdDownloadFilename = '';
    this.sdDownloadSize = 0;
    this.sdDownloadBuffer = [];
    this.sdDownloadLinesCount = 0;

    // Référencement des sélecteurs DOM
    this.dom = {};
  }

  /**
   * Initialise l'application, instancie les modules et lie les événements du DOM.
   */
  init() {
    this.cacheDomElements();
    
    // Instanciation de la carte
    this.map = new NectarMap('wasp-map');
    
    // Instanciation du module Web Serial (héritier de EventTarget)
    this.serial = new NectarSerial();
    
    // Abonnement aux événements du port série
    this.serial.addEventListener('packet', (e) => this.onPacketReceived(e.detail));
    this.serial.addEventListener('line', (e) => this.onLineReceived(e.detail));
    this.serial.addEventListener('log', (e) => this.logToTerminal(e.detail.message, e.detail.type));
    this.serial.addEventListener('bytes-read', (e) => { this.bytesCountThisSecond += e.detail; });
    this.serial.addEventListener('connection-changed', (e) => this.updateConnectionUI(e.detail.connected, e.detail.name));

    this.bindEvents();
    
    // Rendu initial de l'aide AT
    this.renderAtHelperList();
    this.updateFlashTexts();

    // Démarrage des tâches périodiques (Calcul débit 1Hz, Péremption trackers 0.5Hz)
    setInterval(() => this.calculateThroughput(), 1000);
    setInterval(() => this.checkTrackersTimeout(), 2000);

    // Écoute de l'événement personnalisé de changement de langue
    window.addEventListener('lang-changed', (e) => this.onLanguageChanged(e.detail));

    // Restauration asynchrone de la session précédente
    this.restorePersistedSession();
  }

  /**
   * Référence tous les éléments HTML requis pour l'IHM.
   */
  cacheDomElements() {
    this.dom = {
      btnConnect: document.getElementById('btn-connect'),
      btnDisconnect: document.getElementById('btn-disconnect'),
      lblPortName: document.getElementById('lbl-port-name'),
      connBadge: document.getElementById('conn-badge'),
      selectBaudrate: document.getElementById('baudrate'),
      selectFwVersion: document.getElementById('select-fw-version'),
      
      // Configuration Radio
      inputFreq: document.getElementById('input-freq'),
      selectSf: document.getElementById('select-sf') || document.getElementById('input-sf'),
      selectBw: document.getElementById('select-bw') || document.getElementById('input-bw'),
      selectCrc: document.getElementById('select-crc'),
      btnReadCfg: document.getElementById('btn-read-cfg'),
      btnWriteCfg: document.getElementById('btn-write-cfg'),
      btnSaveCfg: document.getElementById('btn-save-cfg'),
      btnResetCfg: document.getElementById('btn-reset-cfg'),
      
      // Indicateurs
      statRssi: document.getElementById('stat-rssi'),
      statSnr: document.getElementById('stat-snr'),
      statCount: document.getElementById('stat-count'),
      statCrcErrors: document.getElementById('stat-crc-errors'),
      lblThroughput: document.getElementById('lbl-throughput'),
      
      // Terminal
      terminalLogs: document.getElementById('terminal-logs'),
      terminalForm: document.getElementById('terminal-form'),
      terminalInput: document.getElementById('terminal-input'),
      btnSend: document.getElementById('btn-send'),
      btnClearTerminal: document.getElementById('btn-clear-terminal'),
      
      // Flashage
      btnFlash: document.getElementById('btn-flash'),
      selectBand: document.getElementById('select-band'),
      selectFlashFwVersion: document.getElementById('select-flash-fw-version'),
      flashProgressContainer: document.getElementById('flash-progress-container'),
      flashProgressBar: document.getElementById('flash-progress-bar'),
      lblFlashStatus: document.getElementById('lbl-flash-status'),
      lblFlashPercent: document.getElementById('lbl-flash-percent'),
      
      // Télémétrie & Logs
      tableTelemetryBody: document.querySelector('#table-telemetry tbody'),
      rowEmpty: document.getElementById('row-empty'),
      btnClearTelemetry: document.getElementById('btn-clear-telemetry'),
      btnExportTelemetry: document.getElementById('btn-export-telemetry'),
      btnClearTrackers: document.getElementById('btn-clear-trackers'),
      btnListSd: document.getElementById('btn-list-sd'),
      
      // WASP
      chkWaspDecoding: document.getElementById('chk-wasp-decoding'),
      waspSection: document.getElementById('wasp-section'),
      selectWaspTracker: document.getElementById('select-wasp-tracker'),
      btnRecenterWasp: document.getElementById('btn-recenter-wasp'),
      chkVoiceAlerts: document.getElementById('chk-voice-alerts')
    };
  }

  /**
   * Lie les écouteurs d'événements utilisateur aux contrôles du DOM.
   */
  bindEvents() {
    // Connexion Série
    this.dom.btnConnect?.addEventListener('click', () => {
      const baud = this.dom.selectBaudrate ? parseInt(this.dom.selectBaudrate.value, 10) : 115200;
      const fmt = this.dom.selectFwVersion ? this.dom.selectFwVersion.value : 'gs_flag';
      this.serial.connect(baud, fmt).then(() => {
        // Demande de configuration initiale après démarrage de la carte (6 secondes de temporisation)
        setTimeout(() => {
          const currentEpoch = Math.floor(Date.now() / 1000);
          this.serial.sendSerialText(`AT+TIME=${currentEpoch}`);
          this.serial.sendSerialText('AT+FREQ?');
          this.serial.sendSerialText('AT+SF?');
          this.serial.sendSerialText('AT+BW?');
          this.serial.sendSerialText('AT+CRC?');
        }, 6000);
      }).catch(err => {
        if (err.message === "unsupported") {
          alert(getTranslation('alert_browser_unsupported'));
        }
      });
    });
    
    this.dom.btnDisconnect?.addEventListener('click', () => this.serial.disconnect());

    // Détection déconnexion matérielle USB
    navigator.serial?.addEventListener('disconnect', (event) => {
      if (this.serial.port && event.target === this.serial.port) {
        this.logToTerminal(getTranslation('log_physical_disconnect'), "sys-out");
        this.serial.disconnect();
      }
    });

    // Lecture / Écriture de Configuration Radio
    this.dom.btnReadCfg?.addEventListener('click', () => {
      this.serial.sendSerialText('AT+FREQ?');
      this.serial.sendSerialText('AT+SF?');
      this.serial.sendSerialText('AT+BW?');
      this.serial.sendSerialText('AT+CRC?');
    });
    
    this.dom.btnWriteCfg?.addEventListener('click', () => {
      if (this.dom.inputFreq) {
        const freq = parseFloat(this.dom.inputFreq.value);
        if (!isNaN(freq)) this.serial.sendSerialText(`AT+FREQ=${freq.toFixed(3)}`);
      }
      if (this.dom.selectSf) {
        this.serial.sendSerialText(`AT+SF=${this.dom.selectSf.value}`);
      }
      if (this.dom.selectBw) {
        this.serial.sendSerialText(`AT+BW=${this.dom.selectBw.value}`);
      }
      if (this.dom.selectCrc) {
        this.serial.sendSerialText(`AT+CRC=${this.dom.selectCrc.value}`);
      }
    });
    
    this.dom.btnSaveCfg?.addEventListener('click', () => this.serial.sendSerialText('AT+SAVE'));
    
    this.dom.btnResetCfg?.addEventListener('click', () => {
      if (confirm(getTranslation('confirm_factory_reset'))) {
        this.serial.sendSerialText('AT+RESET');
      }
    });

    // Terminal
    this.dom.terminalForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.dom.terminalInput) {
        const cmd = this.dom.terminalInput.value.trim();
        if (cmd.length > 0) {
          this.serial.sendSerialText(cmd);
          this.dom.terminalInput.value = '';
        }
      }
    });
    
    this.dom.btnClearTerminal?.addEventListener('click', () => {
      if (this.dom.terminalLogs) this.dom.terminalLogs.innerHTML = '';
    });

    // Téléchargement Logs SD
    this.dom.btnListSd?.addEventListener('click', () => {
      const tableBody = document.querySelector('#table-sd-files tbody');
      if (tableBody) {
        tableBody.innerHTML = '';
        const rowEmpty = document.createElement('tr');
        rowEmpty.id = 'row-empty-sd-files';
        rowEmpty.innerHTML = `<td colspan="3" class="text-center text-secondary" style="padding: 1rem 0; text-align: center;">${getTranslation('sd_files_empty')}</td>`;
        tableBody.appendChild(rowEmpty);
      }
      this.serial.sendSerialText('AT+LIST');
    });

    // Nettoyage Télémétrie et Trackers
    this.dom.btnClearTelemetry?.addEventListener('click', () => {
      this.allReceivedFrames = [];
      this.packetIndex = 0;
      this.crcErrorsCount = 0;
      this.rssiHistory = [];
      this.snrHistory = [];
      
      if (this.dom.statCount) this.dom.statCount.textContent = '0 / 0';
      if (this.dom.statCrcErrors) this.dom.statCrcErrors.textContent = '0';
      if (this.dom.statRssi) this.dom.statRssi.textContent = '--';
      if (this.dom.statSnr) this.dom.statSnr.textContent = '--';
      
      this.renderTelemetryTable();
      this.drawSignalCharts();
      clearFrames();
    });
    
    this.dom.btnExportTelemetry?.addEventListener('click', () => this.exportTelemetryToCSV());
    
    this.dom.btnClearTrackers?.addEventListener('click', () => {
      this.activeTrackers = {};
      this.waspTrackersData = {};
      this.activeWaspTrackerName = "";
      
      this.updateTrackersTable();
      
      this.map?.clear();
      
      this.updateWaspCockpit(null);
      if (this.dom.selectWaspTracker) {
        this.dom.selectWaspTracker.innerHTML = '<option value="" disabled selected>Attente émetteur...</option>';
      }
      clearAllStorage();
    });

    // Options Décodeur WASP
    this.dom.chkWaspDecoding?.addEventListener('change', () => {
      if (this.dom.chkWaspDecoding?.checked) {
        if (this.dom.waspSection) {
          this.dom.waspSection.classList.remove('hidden');
          this.map?.init();
          
          // Re-dessiner les trackers WASP rechargés sur la carte
          Object.keys(this.waspTrackersData).forEach(name => {
            const data = this.waspTrackersData[name];
            if (data.lat !== 0 && data.lon !== 0) {
              this.map.updateTrackerPosition(name, data, this.activeWaspTrackerName);
            }
          });

          setTimeout(() => {
            this.map?.invalidateSize();
            if (this.map?.lastPos) {
              this.map.setView(this.map.lastPos.lat, this.map.lastPos.lon, 13);
            }
          }, 150);
          this.dom.waspSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        if (this.dom.waspSection) {
          this.dom.waspSection.classList.add('hidden');
        }
      }
    });

    this.dom.selectWaspTracker?.addEventListener('change', () => {
      this.activeWaspTrackerName = this.dom.selectWaspTracker?.value || "";
      saveActiveWaspTracker(this.activeWaspTrackerName);
      this.updateWaspCockpit(this.activeWaspTrackerName);
      
      const data = this.waspTrackersData[this.activeWaspTrackerName];
      if (data && data.lat !== 0 && data.lon !== 0) {
        this.map?.setView(data.lat, data.lon, this.map.map.getZoom() < 10 ? 14 : this.map.map.getZoom());
        this.map?.markers[this.activeWaspTrackerName]?.openPopup();
      }
    });

    this.dom.btnRecenterWasp?.addEventListener('click', () => {
      if (!this.activeWaspTrackerName) return;
      const data = this.waspTrackersData[this.activeWaspTrackerName];
      if (data && data.lat !== 0 && data.lon !== 0) {
        this.map?.setView(data.lat, data.lon, this.map.map.getZoom() < 10 ? 14 : this.map.map.getZoom());
        this.map?.markers[this.activeWaspTrackerName]?.openPopup();
      }
    });

    // Outil de Flashage de Firmware
    this.dom.btnFlash?.addEventListener('click', () => {
      if (this.serial.isConnected) {
        alert(getTranslation('alert_monitor_active_disconnect'));
        return;
      }
      
      const band = this.dom.selectBand ? this.dom.selectBand.value : '868';
      const fwVersion = this.dom.selectFlashFwVersion ? this.dom.selectFlashFwVersion.value : 'latest';
      const verTag = fwVersion === 'latest' ? 'v1.6.2' : fwVersion;
      const binUrl = `binaries/firmware_bluetooth_${band}_${verTag}.bin`;
      
      this.setFlasherControlsDisabled(true);
      if (this.dom.flashProgressContainer) this.dom.flashProgressContainer.classList.remove('hidden');
      if (this.dom.lblFlashStatus) this.dom.lblFlashStatus.textContent = getTranslation('flash_status_connecting');
      if (this.dom.lblFlashPercent) this.dom.lblFlashPercent.textContent = "0%";
      if (this.dom.flashProgressBar) this.dom.flashProgressBar.style.width = "0%";
      
      this.serial.flashFirmware(
        binUrl,
        (percent, statusKey, extra) => {
          if (this.dom.lblFlashPercent) this.dom.lblFlashPercent.textContent = `${percent}%`;
          if (this.dom.flashProgressBar) this.dom.flashProgressBar.style.width = `${percent}%`;
          if (this.dom.lblFlashStatus) {
            this.dom.lblFlashStatus.textContent = extra ? getTranslation(statusKey, { chip: extra }) : getTranslation(statusKey);
          }
        },
        (logMsg) => this.logToTerminal(logMsg, 'sys-out')
      ).catch(err => {
        if (this.dom.lblFlashStatus) this.dom.lblFlashStatus.textContent = getTranslation('flash_status_failed');
        console.error("Flash failure:", err);
      }).finally(() => {
        this.setFlasherControlsDisabled(false);
      });
    });

    this.dom.selectFlashFwVersion?.addEventListener('change', () => this.updateFlashTexts());
  }

  /**
   * Restaure les donnees de la session precedente stockees dans IndexedDB et LocalStorage.
   * @private
   */
  async restorePersistedSession() {
    try {
      // 1. Charger l'historique des trames
      const savedFrames = await loadFrames();
      if (savedFrames && savedFrames.length > 0) {
        this.allReceivedFrames = savedFrames;
        this.packetIndex = Math.max(...savedFrames.map(f => f.index)) || 0;
        
        // Remplir l'historique RSSI/SNR pour les graphes
        const recentFrames = savedFrames.slice(-this.maxChartPoints);
        recentFrames.forEach(f => {
          this.rssiHistory.push({ value: f.rssi, time: f.timestamp });
          this.snrHistory.push({ value: f.snr, time: f.timestamp });
        });
        
        const lastFrame = savedFrames[savedFrames.length - 1];
        if (this.dom.statRssi) this.dom.statRssi.textContent = `${lastFrame.rssi} dBm`;
        if (this.dom.statSnr) this.dom.statSnr.textContent = `${lastFrame.snr} dB`;
        if (this.dom.statCount) {
          this.dom.statCount.textContent = `${this.packetIndex} / ${this.crcErrorsCount}`;
        }
        
        // Dessiner les graphiques
        this.drawSignalCharts();
        
        // Remplir la table de télémétrie
        if (this.dom.tableTelemetryBody) {
          this.dom.tableTelemetryBody.innerHTML = '';
          if (this.dom.rowEmpty) this.dom.rowEmpty.style.display = 'none';
          
          const framesToShow = this.allReceivedFrames.slice(-50).reverse();
          framesToShow.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${f.index}</td>
              <td>${f.timestamp}</td>
              <td><span class="badge connected">${f.tracker}</span></td>
              <td>${f.apid}</td>
              <td>${f.size} ${getTranslation('unit_bytes')}</td>
              <td>${f.rssi} dBm</td>
              <td>${f.snr} dB</td>
              <td><span style="font-family: var(--font-mono); color: var(--color-success); font-weight: 600; white-space: nowrap;">✔ ${f.crcHex}</span></td>
              <td style="font-family: var(--font-mono); color: var(--color-cyan); word-break: break-all;">${f.payload}</td>
            `;
            this.dom.tableTelemetryBody.appendChild(tr);
          });
        }
      }
      
      // 2. Charger les trackers actifs
      const savedTrackers = loadTrackersState();
      if (savedTrackers && Object.keys(savedTrackers).length > 0) {
        this.activeTrackers = savedTrackers;
        this.updateTrackersTable();
      }
      
      // 3. Charger la trajectoire WASP
      const savedWaspData = loadWaspTrackersData();
      const savedActiveWasp = loadActiveWaspTracker();
      
      if (savedWaspData && Object.keys(savedWaspData).length > 0) {
        this.waspTrackersData = savedWaspData;
        this.activeWaspTrackerName = savedActiveWasp;
        
        if (this.activeWaspTrackerName) {
          this.updateWaspCockpit(this.activeWaspTrackerName);
        }
        
        if (this.dom.selectWaspTracker) {
          this.dom.selectWaspTracker.innerHTML = '';
          Object.keys(this.waspTrackersData).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `${name} (APID: ${this.waspTrackersData[name].apid})`;
            this.dom.selectWaspTracker.appendChild(opt);
          });
          if (this.activeWaspTrackerName) {
            this.dom.selectWaspTracker.value = this.activeWaspTrackerName;
          }
        }
        
        // Si le décodeur WASP est déjà coché, placer les marqueurs
        if (this.dom.chkWaspDecoding?.checked) {
          this.map?.init();
          Object.keys(this.waspTrackersData).forEach(name => {
            const data = this.waspTrackersData[name];
            if (data.lat !== 0 && data.lon !== 0) {
              this.map.updateTrackerPosition(name, data, this.activeWaspTrackerName);
            }
          });
        }
      }
    } catch (err) {
      console.error("Erreur de restauration de la session persistee :", err);
    }
  }

  /**
   * Appelé lorsque le module de traduction signale que la langue a été modifiée.
   */
  onLanguageChanged(lang) {
    this.updateConnectionUI(this.serial.isConnected, this.currentPortName);
    this.renderTelemetryTable();
    this.updateTrackersTable();
    this.renderAtHelperList();
    this.updateFlashTexts();
  }

  /**
   * Gère l'activation/désactivation des éléments du flasheur pendant l'écriture.
   */
  setFlasherControlsDisabled(disabled) {
    setElementDisabled(this.dom.btnFlash, disabled);
    setElementDisabled(this.dom.selectBand, disabled);
    setElementDisabled(this.dom.selectFlashFwVersion, disabled);
  }

  /**
   * Synthèse vocale.
   */
  speak(text) {
    if (!this.dom.chkVoiceAlerts || !this.dom.chkVoiceAlerts.checked) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const currentLang = localStorage.getItem('nectar_lang') || 'fr';
      utterance.lang = currentLang === 'fr' ? 'fr-FR' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Loggue une ligne dans la console terminal de l'IHM.
   */
  logToTerminal(message, type = 'cmd-out') {
    const logsEl = this.dom.terminalLogs;
    if (!logsEl) return;
    
    const div = document.createElement('div');
    div.className = type;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsEl.appendChild(div);
    
    while (logsEl.children.length > 500) {
      logsEl.removeChild(logsEl.firstChild);
    }
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  /**
   * Met à jour les éléments de liaison série de l'IHM.
   */
  updateConnectionUI(connected, name = '') {
    this.currentPortName = name;
    
    if (this.dom.connBadge) {
      this.dom.connBadge.textContent = connected ? getTranslation('badge_connected') : getTranslation('badge_disconnected');
      this.dom.connBadge.className = connected ? 'badge connected' : 'badge disconnected';
    }
    if (this.dom.lblPortName) {
      this.dom.lblPortName.textContent = connected ? getTranslation('conn_port_prefix') + name : getTranslation('conn_no_device');
    }
    
    setElementDisabled(this.dom.btnConnect, connected);
    setElementDisabled(this.dom.btnDisconnect, !connected);
    setElementDisabled(this.dom.selectBaudrate, connected);

    const disabledState = !connected;
    setElementDisabled(this.dom.inputFreq, disabledState);
    setElementDisabled(this.dom.selectSf, disabledState);
    setElementDisabled(this.dom.selectBw, disabledState);
    setElementDisabled(this.dom.selectCrc, disabledState);
    setElementDisabled(this.dom.btnReadCfg, disabledState);
    setElementDisabled(this.dom.btnWriteCfg, disabledState);
    setElementDisabled(this.dom.btnSaveCfg, disabledState);
    setElementDisabled(this.dom.btnResetCfg, disabledState);
    setElementDisabled(this.dom.terminalInput, disabledState);
    setElementDisabled(this.dom.btnSend, disabledState);
    setElementDisabled(this.dom.btnListSd, disabledState);
  }

  /**
   * Calcule périodiquement le débit série réel en réception (1Hz).
   */
  calculateThroughput() {
    this.throughputHistory.push(this.bytesCountThisSecond);
    if (this.throughputHistory.length > 30) {
      this.throughputHistory.shift();
    }
    
    const kbps = (this.bytesCountThisSecond * 8) / 1000.0;
    if (this.dom.lblThroughput) {
      const currentLang = localStorage.getItem('nectar_lang') || 'fr';
      if (currentLang === 'fr') {
        this.dom.lblThroughput.textContent = `${this.bytesCountThisSecond} octets/s (${kbps.toFixed(2)} kbps)`;
      } else {
        this.dom.lblThroughput.textContent = `${this.bytesCountThisSecond} bytes/s (${kbps.toFixed(2)} kbps)`;
      }
    }
    
    this.bytesCountThisSecond = 0;
    this.updateThroughputChart();
  }

  /**
   * Scanne les émetteurs actifs pour marquer comme LOST (perdu) ceux inactifs depuis plus de 15 secondes.
   */
  checkTrackersTimeout() {
    const now = Date.now();
    let statusChanged = false;
    
    Object.keys(this.activeTrackers).forEach(name => {
      const tracker = this.activeTrackers[name];
      if (!tracker.isLost && (now - tracker.lastSeen > 15000)) {
        tracker.isLost = true;
        statusChanged = true;
        this.speak(getTranslation('voice_tracker_lost', { name: name.split('').join(' ') }));
      }
    });
    
    if (statusChanged) {
      this.updateTrackersTable();
      saveTrackersState(this.activeTrackers);
    }
  }

  /**
   * Traite et affiche le paquet décodé reçu depuis le module série (Interruption).
   */
  onPacketReceived(decoded) {
    const { ssidType, ssidNum, apid, trackerName, missionTypeLabelKey } = decoded.header;
    const { rssi, snr, timestamp: epoch } = decoded.metrics;
    const payload = decoded.payload;
    const payloadSize = payload.length;
    
    this.packetIndex++;

    const timestamp = (epoch > 100000000) ? new Date(epoch * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
    const crcHex = '0x' + decoded.crc.received.toString(16).toUpperCase().padStart(4, '0');

    // 1. Ajouter à l'historique complet
    const frameObj = {
      index: this.packetIndex,
      timestamp,
      tracker: trackerName,
      apid,
      size: payloadSize,
      payload: bytesToHex(payload),
      rssi,
      snr,
      crcHex
    };
    this.allReceivedFrames.push(frameObj);
    if (this.allReceivedFrames.length > 5000) {
      this.allReceivedFrames.shift();
    }
    saveFrame(frameObj); // Sauvegarde persistante IndexedDB

    // 2. Statistiques en direct et Graphiques
    if (this.dom.statRssi) this.dom.statRssi.textContent = `${rssi} dBm`;
    if (this.dom.statSnr) this.dom.statSnr.textContent = `${snr} dB`;
    if (this.dom.statCount) {
      this.dom.statCount.textContent = `${this.packetIndex} / ${this.crcErrorsCount}`;
    }

    this.rssiHistory.push({ value: rssi, time: timestamp });
    if (this.rssiHistory.length > this.maxChartPoints) this.rssiHistory.shift();

    this.snrHistory.push({ value: snr, time: timestamp });
    if (this.snrHistory.length > this.maxChartPoints) this.snrHistory.shift();

    this.drawSignalCharts();
    this.renderTelemetryTable();

    // 3. Classification du tracker actif
    const isNew = !this.activeTrackers[trackerName];
    if (isNew) {
      this.activeTrackers[trackerName] = {
        name: trackerName,
        typeLabelKey: missionTypeLabelKey,
        lastApid: apid,
        packetCount: 0,
        lastSeen: Date.now(),
        lastPayloadHex: bytesToHex(payload),
        lastRssi: rssi,
        lastSnr: snr,
        isLost: false
      };
      this.speak(getTranslation('voice_new_tracker', { name: trackerName.split('').join(' ') }));
    } else {
      if (this.activeTrackers[trackerName].isLost) {
        this.activeTrackers[trackerName].isLost = false;
        this.speak(getTranslation('voice_tracker_back', { name: trackerName.split('').join(' ') }));
      }
    }

    // Mise à jour des stats du tracker
    this.activeTrackers[trackerName].lastApid = apid;
    this.activeTrackers[trackerName].packetCount++;
    this.activeTrackers[trackerName].lastSeen = Date.now();
    this.activeTrackers[trackerName].lastPayloadHex = bytesToHex(payload);
    this.activeTrackers[trackerName].lastRssi = rssi;
    this.activeTrackers[trackerName].lastSnr = snr;
    
    saveTrackersState(this.activeTrackers); // Sauvegarde LocalStorage

    // 4. Décodage WASP conditionnel (29 octets LoRa)
    if (this.dom.chkWaspDecoding?.checked && payloadSize === 29) {
      try {
        const waspData = decodeWaspPayload(payload);
        const isNewWasp = !this.waspTrackersData[trackerName];

        // Limitation stricte à 10 trackers WASP max
        if (isNewWasp && Object.keys(this.waspTrackersData).length >= 10) {
          let oldestTrackerName = "";
          let oldestTime = Infinity;

          Object.keys(this.waspTrackersData).forEach(name => {
            const lastSeen = this.activeTrackers[name] ? this.activeTrackers[name].lastSeen : 0;
            if (lastSeen < oldestTime && name !== this.activeWaspTrackerName) {
              oldestTime = lastSeen;
              oldestTrackerName = name;
            }
          });

          if (oldestTrackerName) {
            this.map?.removeTracker(oldestTrackerName);
            delete this.waspTrackersData[oldestTrackerName];
            
            if (this.dom.selectWaspTracker) {
              const optionToRemove = Array.from(this.dom.selectWaspTracker.options).find(opt => opt.value === oldestTrackerName);
              if (optionToRemove) {
                this.dom.selectWaspTracker.removeChild(optionToRemove);
              }
            }
          }
        }

        // Enregistrement des données WASP
        this.waspTrackersData[trackerName] = {
          id: ssidNum,
          apid: apid,
          type: ssidType,
          utc: waspData.utc,
          lat: waspData.lat,
          lon: waspData.lon,
          alt: waspData.alt,
          spd: waspData.spd,
          cog: waspData.cog,
          vbat: waspData.vbat,
          temp: waspData.temp,
          gpsFix: waspData.gpsFix,
          numSats: waspData.numSats,
          rssi,
          snr
        };
        
        saveWaspTrackersData(this.waspTrackersData); // Sauvegarde LocalStorage

        // Remplissage du sélecteur IHM de trackers
        if (this.dom.selectWaspTracker) {
          if (isNewWasp) {
            if (Object.keys(this.waspTrackersData).length === 1) {
              this.dom.selectWaspTracker.innerHTML = '';
            }
            const opt = document.createElement('option');
            opt.value = trackerName;
            opt.textContent = `${trackerName} (APID: ${apid})`;
            this.dom.selectWaspTracker.appendChild(opt);

            if (!this.activeWaspTrackerName) {
              this.activeWaspTrackerName = trackerName;
              this.dom.selectWaspTracker.value = trackerName;
              saveActiveWaspTracker(trackerName);
            }
          }
        }

        // Trace sur la carte Leaflet
        if (waspData.lat !== 0 && waspData.lon !== 0 && Math.abs(waspData.lat) <= 90 && Math.abs(waspData.lon) <= 180) {
          this.map?.updateTrackerPosition(trackerName, {
            lat: waspData.lat,
            lon: waspData.lon,
            alt: waspData.alt,
            spd: waspData.spd,
            cog: waspData.cog,
            gpsFix: waspData.gpsFix,
            utc: waspData.utc,
            apid: apid
          }, this.activeWaspTrackerName);
        }

        // Mise à jour du cockpit si c'est le tracker sélectionné
        if (trackerName === this.activeWaspTrackerName) {
          this.updateWaspCockpit(trackerName);
        }
      } catch (e) {
        console.error("WASP payload decode error:", e);
        this.logToTerminal(`⚠️ Erreur Décodeur WASP : ${e.message}`, "sys-out");
      }
    }

    this.updateTrackersTable();
  }

  /**
   * Traite les lignes textuelles reçues du périphérique (Echo AT, SD Dump).
   */
  onLineReceived(lineText) {
    if (lineText === "+DUMP: START") {
      this.isDownloadingSdFile = true;
      this.sdDownloadBuffer = [];
      this.sdDownloadLinesCount = 0;
      return;
    }
    
    if (lineText === "+DUMP: END") {
      this.isDownloadingSdFile = false;
      this.finishSdFileDownload();
      return;
    }

    if (this.isDownloadingSdFile) {
      this.sdDownloadBuffer.push(lineText);
      this.sdDownloadLinesCount++;
      
      const approxBytes = this.sdDownloadLinesCount * 60; // 60 octets par ligne en moyenne
      let percent = Math.min(99, Math.round((approxBytes / this.sdDownloadSize) * 100));
      if (isNaN(percent) || percent < 0) percent = 50;
      this.updateSdProgress(percent);
      return;
    }

    // Affichage classique dans la console
    this.logToTerminal(lineText, 'cmd-out');
    this.parseATResponse(lineText);
  }

  /**
   * Décode les retours d'interrogations de commandes AT pour synchroniser les inputs de l'IHM.
   */
  parseATResponse(line) {
    if (line.startsWith("+FREQ:")) {
      const val = parseFloat(line.split(":")[1]);
      if (this.dom.inputFreq && !isNaN(val)) {
        this.dom.inputFreq.value = val.toFixed(3);
        this.currentConfig.frequency = val;
      }
    } else if (line.startsWith("+SF:")) {
      const val = parseInt(line.split(":")[1], 10);
      if (this.dom.selectSf && !isNaN(val)) {
        this.dom.selectSf.value = val.toString();
        this.currentConfig.sf = val;
      }
    } else if (line.startsWith("+BW:")) {
      const val = parseFloat(line.split(":")[1]);
      if (this.dom.selectBw && !isNaN(val)) {
        this.dom.selectBw.value = val.toString();
        this.currentConfig.bw = val;
      }
    } else if (line.startsWith("+CRC:")) {
      const val = parseInt(line.split(":")[1], 10);
      if (this.dom.selectCrc && !isNaN(val)) {
        this.dom.selectCrc.value = val.toString();
      }
    } else if (line.startsWith("+LIST:")) {
      // Format attendu : +LIST:file_name.csv,file_size_bytes
      const parts = line.split(":")[1].split(",");
      if (parts.length === 2) {
        const name = parts[0].trim();
        const size = parseInt(parts[1].trim(), 10);
        this.addSdFileToList(name, size);
      }
    }
  }

  /**
   * Démarre la lecture dynamique du téléchargement SD.
   */
  startSdFileDownload(filename, size) {
    this.sdDownloadFilename = filename;
    this.sdDownloadSize = size;
    this.sdDownloadBuffer = [];
    this.sdDownloadLinesCount = 0;
    
    this.logToTerminal(getTranslation('log_sd_download_start', { file: filename }), 'sys-out');
    this.serial.sendSerialText(`AT+DUMP=${filename}`);
  }

  /**
   * Finalise le téléchargement d'un log SD et déclenche son enregistrement dans le navigateur.
   */
  finishSdFileDownload() {
    this.updateSdProgress(100);
    this.logToTerminal(getTranslation('log_sd_download_success', { file: this.sdDownloadFilename, lines: this.sdDownloadLinesCount }), 'sys-out');
    
    const csvContent = this.sdDownloadBuffer.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", this.sdDownloadFilename.replace(new RegExp('/', 'g'), '_'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Dissimulation de la barre de progression après 2 secondes
    setTimeout(() => {
      const progressContainer = document.getElementById('sd-progress-container');
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    }, 2000);
  }

  /**
   * Met à jour visuellement la barre de progression du téléchargement SD.
   */
  updateSdProgress(percent) {
    const progressContainer = document.getElementById('sd-progress-container');
    const progressBar = document.getElementById('sd-progress-bar');
    const percentText = document.getElementById('lbl-sd-progress-percent');
    
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
  }

  /**
   * Ajoute un fichier SD listé dans le tableau HTML.
   */
  addSdFileToList(filename, size) {
    const tableBody = document.querySelector('#table-sd-files tbody');
    const rowEmpty = document.getElementById('row-empty-sd-files');
    if (rowEmpty) {
      rowEmpty.style.display = 'none';
    }
    
    const rowId = `sd-file-row-${filename.replace(new RegExp('/', 'g'), '_').replace(new RegExp('\\.', 'g'), '_')}`;
    let row = document.getElementById(rowId);
    if (!row) {
      row = document.createElement('tr');
      row.id = rowId;
      row.className = 'sd-file-row';
      
      const tdName = document.createElement('td');
      tdName.className = 'sd-file-cell';
      tdName.textContent = filename;
      row.appendChild(tdName);
      
      const tdSize = document.createElement('td');
      tdSize.className = 'sd-file-cell';
      tdSize.textContent = (size / 1024).toFixed(2) + ' KB';
      row.appendChild(tdSize);
      
      const tdAction = document.createElement('td');
      tdAction.className = 'sd-file-cell';
      const btn = document.createElement('button');
      btn.className = 'btn primary small';
      btn.textContent = getTranslation('sd_download_btn');
      btn.addEventListener('click', () => this.startSdFileDownload(filename, size));
      tdAction.appendChild(btn);
      row.appendChild(tdAction);
      
      if (tableBody) tableBody.appendChild(row);
    }
  }

  /**
   * Exporte l'historique de télémétrie en CSV.
   */
  exportTelemetryToCSV() {
    if (this.allReceivedFrames.length === 0) {
      alert(getTranslation('alert_no_frames_export'));
      return;
    }
    
    let csvRows = ["Index,Horodatage,Tracker,APID,Taille(octets),RSSI(dBm),SNR(dB),ChargeUtileHex"];
    this.allReceivedFrames.forEach(f => {
      csvRows.push(`${f.index},${f.timestamp},${f.tracker},${f.apid},${f.size},${f.rssi},${f.snr},${f.payload}`);
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    link.setAttribute("download", `nectar_telemetry_${dateStr}_${timeStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Construit la liste AT de l'IHM.
   */
  renderAtHelperList() {
    const container = document.getElementById('at-helper-list');
    if (!container) return;
    container.innerHTML = '';
    
    const AT_COMMANDS_HELP = [
      { cmd: "AT", descKey: "at_desc_at" },
      { cmd: "AT+HELP", descKey: "at_desc_help" },
      { cmd: "AT+INFO", descKey: "at_desc_info" },
      { cmd: "AT+FREQ?", descKey: "at_desc_freq_get" },
      { cmd: "AT+FREQ=", descKey: "at_desc_freq_set" },
      { cmd: "AT+SF?", descKey: "at_desc_sf_get" },
      { cmd: "AT+SF=", descKey: "at_desc_sf_set" },
      { cmd: "AT+BW?", descKey: "at_desc_bw_get" },
      { cmd: "AT+BW=", descKey: "at_desc_bw_set" },
      { cmd: "AT+CRC?", descKey: "at_desc_crc_get" },
      { cmd: "AT+CRC=", descKey: "at_desc_crc_set" },
      { cmd: "AT+FMT?", descKey: "at_desc_fmt_get" },
      { cmd: "AT+FMT=", descKey: "at_desc_fmt_set" },
      { cmd: "AT+TIME?", descKey: "at_desc_time_get" },
      { cmd: "AT+TIME=", descKey: "at_desc_time_set" },
      { cmd: "AT+RSSI?", descKey: "at_desc_rssi_get" },
      { cmd: "AT+SNR?", descKey: "at_desc_snr_get" },
      { cmd: "AT+SIG?", descKey: "at_desc_sig_get" },
      { cmd: "AT+ERR?", descKey: "at_desc_err_get" },
      { cmd: "AT+CFG", descKey: "at_desc_cfg" },
      { cmd: "AT+LIST", descKey: "at_desc_list" },
      { cmd: "AT+DUMP=", descKey: "at_desc_dump" },
      { cmd: "AT+SAVE", descKey: "at_desc_save" },
      { cmd: "AT+RESET", descKey: "at_desc_reset" }
    ];

    AT_COMMANDS_HELP.forEach(item => {
      const el = document.createElement('div');
      el.className = 'at-helper-item';
      el.innerHTML = `
        <span class="at-helper-cmd">${item.cmd}</span>
        <span class="at-helper-desc">${getTranslation(item.descKey)}</span>
      `;
      el.addEventListener('click', () => {
        if (this.dom.terminalInput) {
          this.dom.terminalInput.value = item.cmd;
          this.dom.terminalInput.focus();
        }
      });
      container.appendChild(el);
    });
  }

  /**
   * Remplit dynamiquement le tableau de télémétrie en insérant chirurgicalement le dernier élément reçu.
   */
  renderTelemetryTable() {
    const tableBody = this.dom.tableTelemetryBody;
    if (!tableBody) return;
    
    // S'il n'y a pas de trame en mémoire, afficher le message vide
    if (this.allReceivedFrames.length === 0) {
      tableBody.innerHTML = '';
      if (this.dom.rowEmpty) {
        this.dom.rowEmpty.style.display = 'table-row';
        tableBody.appendChild(this.dom.rowEmpty);
      }
      return;
    }
    
    // Cacher le message vide
    if (this.dom.rowEmpty) {
      this.dom.rowEmpty.style.display = 'none';
    }
    
    // Récupérer la toute dernière trame
    const f = this.allReceivedFrames[this.allReceivedFrames.length - 1];
    
    // Si c'est le tout premier élément ajouté, s'assurer de vider le tableau
    if (this.allReceivedFrames.length === 1) {
      tableBody.innerHTML = '';
    }
    
    // Création de l'élément tr
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.index}</td>
      <td>${f.timestamp}</td>
      <td><span class="badge connected">${f.tracker}</span></td>
      <td>${f.apid}</td>
      <td>${f.size} ${getTranslation('unit_bytes')}</td>
      <td>${f.rssi} dBm</td>
      <td>${f.snr} dB</td>
      <td><span style="font-family: var(--font-mono); color: var(--color-success); font-weight: 600; white-space: nowrap;">✔ ${f.crcHex}</span></td>
      <td style="font-family: var(--font-mono); color: var(--color-cyan); word-break: break-all;">${f.payload}</td>
    `;
    
    // Ajout chirurgical au début du tableau (prepend)
    tableBody.prepend(tr);
    
    // Limite de 50 lignes affichées
    while (tableBody.children.length > 50) {
      tableBody.lastElementChild.remove();
    }
  }

  /**
   * Remplit le tableau des trackers actifs par mise à jour chirurgicale individuelle.
   */
  updateTrackersTable() {
    const tableBody = document.querySelector('#table-trackers tbody');
    const rowEmpty = document.getElementById('row-empty-trackers');
    if (!tableBody) return;
    
    const keys = Object.keys(this.activeTrackers);
    
    if (keys.length === 0) {
      tableBody.innerHTML = '';
      if (rowEmpty) {
        rowEmpty.style.display = 'table-row';
        tableBody.appendChild(rowEmpty);
      }
      return;
    }
    
    if (rowEmpty) {
      rowEmpty.style.display = 'none';
    }
    
    keys.forEach(key => {
      const tracker = this.activeTrackers[key];
      const rowId = `tracker-row-${tracker.name}`;
      let tr = document.getElementById(rowId);
      
      const lastSeenTime = new Date(tracker.lastSeen).toLocaleTimeString();
      const statusClass = tracker.isLost ? 'badge disconnected' : 'badge connected';
      const statusText = tracker.isLost ? getTranslation('status_lost') : getTranslation('status_active');
      
      const rowHtml = `
        <td class="tracker-cell"><span class="badge connected">${tracker.name}</span></td>
        <td class="tracker-cell">${getTranslation(tracker.typeLabelKey)}</td>
        <td class="tracker-cell">${tracker.lastApid}</td>
        <td class="tracker-cell" style="font-weight: 600;">${tracker.packetCount}</td>
        <td class="tracker-cell">${lastSeenTime}</td>
        <td class="tracker-cell"><span class="${statusClass}">${statusText}</span></td>
        <td class="tracker-cell tracker-cell-signal">${tracker.lastRssi} dBm / ${tracker.lastSnr} dB</td>
      `;
      
      if (!tr) {
        tr = document.createElement('tr');
        tr.id = rowId;
        tr.className = 'tracker-row';
        tr.innerHTML = rowHtml;
        tableBody.appendChild(tr);
      } else {
        tr.className = 'tracker-row';
        tr.innerHTML = rowHtml;
      }
    });
  }

  /**
   * Remplit les indicateurs Cockpit WASP.
   */
  updateWaspCockpit(trackerName) {
    const data = this.waspTrackersData[trackerName];
    
    const txtAlt = document.getElementById('wasp-alt');
    const txtSpd = document.getElementById('wasp-spd');
    const txtSats = document.getElementById('wasp-sats');
    const txtTemp = document.getElementById('wasp-temp');
    const txtVbat = document.getElementById('wasp-vbat');
    const txtSignal = document.getElementById('wasp-signal');
    
    if (!data) {
      if (txtAlt) txtAlt.textContent = '--';
      if (txtSpd) txtSpd.textContent = '--';
      if (txtSats) txtSats.textContent = '--';
      if (txtTemp) txtTemp.textContent = '--';
      if (txtVbat) txtVbat.textContent = '--';
      if (txtSignal) txtSignal.textContent = '--';
      return;
    }
    
    if (txtAlt) txtAlt.textContent = data.alt.toFixed(1) + ' m';
    if (txtSpd) txtSpd.textContent = data.spd.toFixed(1) + ' km/h';
    if (txtSats) txtSats.textContent = (data.gpsFix ? '🟢 ' : '🔴 ') + data.numSats;
    if (txtTemp) txtTemp.textContent = data.temp.toFixed(2) + ' °C';
    if (txtVbat) txtVbat.textContent = data.vbat.toFixed(2) + ' V';
    if (txtSignal) txtSignal.textContent = `${data.rssi} / ${data.snr}`;
  }

  /**
   * Met à jour le texte du flasheur en fonction de la version choisie.
   */
  updateFlashTexts() {
    const fwVersion = this.dom.selectFlashFwVersion ? this.dom.selectFlashFwVersion.value : 'latest';
    const verStr = fwVersion === 'v1.3.1' ? 'v1.3.1' : 'v1.6.2';
    
    const descEl = document.querySelector('[data-i18n="flash_desc"]');
    if (descEl) {
      const currentLang = localStorage.getItem('nectar_lang') || 'fr';
      if (currentLang === 'fr') {
        descEl.innerHTML = `Flashez directement la version <strong>${verStr}</strong> depuis votre navigateur par port USB.`;
      } else {
        descEl.innerHTML = `Flash version <strong>${verStr}</strong> directly from your browser via USB port.`;
      }
    }
    
    const btnEl = document.getElementById('btn-flash');
    if (btnEl) {
      const currentLang = localStorage.getItem('nectar_lang') || 'fr';
      if (currentLang === 'fr') {
        btnEl.textContent = `Flasher la carte (${verStr})`;
      } else {
        btnEl.textContent = `Flash Board (${verStr})`;
      }
    }
  }

  /**
   * Dessine les graphiques SVG RSSI et SNR en direct.
   */
  drawSignalCharts() {
    this.drawSingleChart('rssi-chart-line', 'rssi-chart-fill', this.rssiHistory, -120, 0);
    this.drawSingleChart('snr-chart-line', 'snr-chart-fill', this.snrHistory, -20, 20);
    
    // Mettre à jour les indicateurs de temps
    const lblRssiTime = document.getElementById('chart-rssi-time');
    const lblSnrTime = document.getElementById('chart-snr-time');
    if (this.rssiHistory.length > 0 && lblRssiTime) {
      lblRssiTime.textContent = this.rssiHistory[this.rssiHistory.length - 1].time;
    }
    if (this.snrHistory.length > 0 && lblSnrTime) {
      lblSnrTime.textContent = this.snrHistory[this.snrHistory.length - 1].time;
    }
  }

  /**
   * Dessine un graphique linéaire en SVG pour une ligne et un fond donnés.
   * @private
   */
  drawSingleChart(lineId, fillId, history, minVal, maxVal) {
    const chartLine = document.getElementById(lineId);
    const chartFill = document.getElementById(fillId);
    if (!chartLine || !chartFill) return;
    
    const width = 300;
    const height = 100;
    const pointsCount = history.length;
    
    if (pointsCount === 0) {
      chartLine.setAttribute('d', '');
      chartFill.setAttribute('d', 'M 0 100 L 300 100 Z');
      return;
    }
    
    let dLine = '';
    let dFill = 'M 0 100';
    
    for (let i = 0; i < pointsCount; i++) {
      const val = history[i].value;
      const clampedVal = Math.max(minVal, Math.min(maxVal, val));
      const ratio = (clampedVal - minVal) / (maxVal - minVal);
      const x = (i / (this.maxChartPoints - 1)) * width;
      const y = height - (ratio * height);
      
      if (i === 0) {
        dLine += `M ${x} ${y}`;
      } else {
        dLine += ` L ${x} ${y}`;
      }
      dFill += ` L ${x} ${y}`;
    }
    
    const lastX = ((pointsCount - 1) / (this.maxChartPoints - 1)) * width;
    dFill += ` L ${lastX} 100 Z`;
    
    chartLine.setAttribute('d', dLine);
    chartFill.setAttribute('d', dFill);
  }

  /**
   * Met à jour le débit (les calculs de texte sont faits dans calculateThroughput).
   */
  updateThroughputChart() {
    // Pas de rendu de courbe requis pour le débit.
  }
}

// Lancement automatique de l'application modulaire à la fin du chargement
function setElementDisabled(el, disabled) {
  if (el) el.disabled = disabled;
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new NectarApp();
  app.init();
});

/**
 * @file translate.js
 * @brief Gestion de la localisation (FR/EN) et des éléments textuels du DOM.
 */

export const translations = {
  fr: {
    badge_disconnected: "Déconnecté",
    badge_connected: "Connecté",
    header_title: "NECTAR RX STATION",
    header_subtitle: "Web Control Center v1.6.2",
    conn_title: "🔌 Liaison Série USB",
    maintenance_title: "🛠️ Outils & Maintenance",
    sd_title: "📁 Journaux Carte SD",
    sd_desc: "Listez et téléchargez directement les fichiers CSV de vol enregistrés sur la carte SD.",
    at_helper_title: "📋 Aide-Mémoire AT",
    at_desc_at: "Test de communication avec la station",
    at_desc_help: "Afficher le menu d'aide complet",
    at_desc_info: "Interroger l'identification de la station",
    at_desc_freq_get: "Interroger la fréquence active",
    at_desc_freq_set: "Configurer la fréquence LoRa (en MHz)",
    at_desc_sf_get: "Interroger le Spreading Factor",
    at_desc_sf_set: "Configurer le Spreading Factor (6-12)",
    at_desc_bw_get: "Interroger la bande passante",
    at_desc_bw_set: "Configurer la bande passante (kHz)",
    at_desc_crc_get: "Interroger le statut du CRC",
    at_desc_crc_set: "Configurer le CRC (0=OFF, 1=ON [,mode])",
    at_desc_fmt_get: "Interroger le format de la trame série active",
    at_desc_fmt_set: "Configurer le format de trame (0=Sans GSFLAG, 1=Avec GSFLAG)",
    at_desc_err_get: "Nombre cumulé de paquets rejetés/corrompus (ex: échec CRC)",
    at_desc_time_get: "Interroger l'heure RTC de la station",
    at_desc_time_set: "Configurer l'heure RTC (Unix Epoch)",
    at_desc_rssi_get: "RSSI du dernier paquet reçu",
    at_desc_snr_get: "SNR du dernier paquet reçu",
    at_desc_sig_get: "RSSI et SNR du dernier paquet",
    at_desc_cfg: "Obtenir la configuration détaillée",
    at_desc_list: "Lister les fichiers CSV sur la carte SD",
    at_desc_dump: "Afficher/télécharger un fichier CSV",
    at_desc_save: "Sauvegarder la config active en NVS",
    at_desc_reset: "Reset d'usine et redémarrage",
    sd_btn_list: "Lister les fichiers",
    sd_th_name: "Nom",
    sd_th_size: "Taille",
    sd_th_action: "Action",
    sd_files_empty: "Aucun fichier listé",
    sd_status_label: "Téléchargement :",
    sd_download_btn: "Télécharger",
    sd_download_wait: "Téléchargement...",
    log_sd_download_start: "Téléchargement du fichier {file}...",
    log_sd_download_success: "Téléchargement réussi : {file} ({lines} lignes)",
    log_sd_download_error: "Erreur lors du téléchargement : {message}",
    conn_baudrate: "Vitesse de transmission (Baud) :",
    conn_fw_version: "Format trame :",
    conn_fw_with_gs: "Avec GS Flag (v1.6.2)",
    conn_fw_without_gs: "Sans GS Flag (v1.3.1)",
    conn_btn_connect: "Connexion",
    conn_btn_disconnect: "Déconnexion",
    conn_status_label: "Statut :",
    conn_no_device: "Aucun appareil connecté",
    conn_port_prefix: "Port : ",
    conn_voice_alerts: "🎙️ Synthèse Vocale (Alertes Tracker)",
    conn_wasp_decoding: "🐝 Activer décodeur WASP (32B)",
    wasp_title: "🚀 Télémétrie Wasp Décryptée",
    wasp_waiting_tracker: "Attente émetteur...",
    wasp_recenter_title: "Recentrer la carte sur le tracker actif",
    wasp_alt: "ALTITUDE (M)",
    wasp_spd: "VITESSE (KM/H)",
    wasp_cog: "CAP (COG)",
    wasp_lat: "LATITUDE",
    wasp_lon: "LONGITUDE",
    wasp_sats: "SATELLITES",
    wasp_temp: "TEMPÉRATURE (°C)",
    wasp_vbat: "BATTERIE (V)",
    wasp_signal: "RSSI / SNR",
    wasp_map_title: "🗺️ Position GPS Live",
    config_title: "⚙️ Paramètres Radio",
    config_frequency: "Fréquence (MHz) :",
    config_sf: "Spreading Factor (SF) :",
    config_bw: "Bande Passante (BW) :",
    config_crc: "Contrôle CRC :",
    config_btn_read: "Actualiser",
    config_btn_write: "Appliquer",
    config_btn_save: "Sauver NVS",
    config_btn_reset: "Reset Usine",
    stats_title: "📊 Qualité de Liaison",
    stats_rssi: "RSSI (dBm)",
    stats_snr: "SNR (dB)",
    chart_rssi_title: "Tendance RSSI",
    chart_snr_title: "Tendance SNR",
    stats_count: "Trames (Reçues / KO)",
    stats_count_recv: "Trames Reçues",
    stats_crc_errors: "Erreurs CRC",
    flash_title: "⚡ Mise à Jour Firmware",
    flash_desc: "Flashez directement la version <strong>v1.6.2</strong> depuis votre navigateur par port USB.",
    flash_version: "Version du Firmware :",
    flash_version_latest: "Dernière version (v1.6.2)",
    flash_version_131: "Version historique (v1.3.1)",
    flash_band: "Bande Radio native de la carte :",
    flash_band_868: "868 MHz (Europe)",
    flash_band_433: "433 MHz",
    flash_btn_flash: "Flasher la carte (v1.6.2)",
    flash_status_label: "Statut :",
    flash_status_waiting: "Attente...",
    trackers_title: "🛸 Émetteurs Détectés (Active Trackers)",
    btn_reset: "Réinitialiser",
    th_tracker: "Tracker (SSID)",
    th_mission_type: "Type de Mission",
    th_last_apid: "Dernier APID",
    th_received_frames: "Trames Reçues",
    th_last_activity: "Dernière Activité",
    th_status: "Statut",
    th_payload: "Charge Utile (Hex)",
    th_crc: "CRC",
    th_signal_quality: "Qualité Signal (RSSI / SNR)",
    trackers_empty: "Aucun émetteur détecté pour l'instant. Branchez le récepteur LoRa pour intercepter les signaux.",
    telemetry_title: "📡 Trames reçues en direct (NectarMC)",
    telemetry_btn_export: "Exporter CSV",
    btn_clear: "Effacer",
    th_index: "Index",
    th_timestamp: "Horodatage",
    th_apid: "APID",
    th_size: "Taille",
    th_rssi: "RSSI",
    th_snr: "SNR",
    telemetry_empty: "Aucune trame reçue pour l'instant. Branchez le port série et mettez sous tension vos trackers.",
    terminal_title: "📟 Console & Terminal",
    terminal_placeholder: "Tapez une commande AT (ex: AT, AT+FREQ?, AT+CFG)...",
    btn_send: "Envoyer",
    footer_credit: "Conçu et développé par",
    
    // Dialogues et logs
    alert_browser_unsupported: "Votre navigateur ne supporte pas l'API Web Serial. Veuillez utiliser Google Chrome, Microsoft Edge ou Opera.",
    confirm_factory_reset: "Voulez-vous restaurer les paramètres d'usine ? La carte va redémarrer.",
    alert_no_frames_export: "Aucune trame en mémoire à exporter.",
    alert_monitor_active_disconnect: "La liaison moniteur série est active. Veuillez cliquer sur 'Déconnexion' avant de lancer le flash du firmware.",
    log_flash_port_select: "Sélection du port série pour le flash (choisissez le port de votre carte)...",
    log_port_opening: "Ouverture du port série à {baud} baud...",
    log_conn_success: "Connexion établie avec succès.",
    log_conn_error: "Erreur de connexion : {message}",
    log_disconnected: "Liaison série déconnectée.",
    log_read_error: "Erreur de lecture : {message}",
    log_send_error: "Erreur d'envoi : {message}",
    log_physical_disconnect: "Le port série a été déconnecté physiquement.",
    log_crc_error: "[ERREUR CRC] Trame rejetée : CRC reçu = {rec}, calculé = {calc}",
    log_write_flash_start: "Début de l'écriture de l'application à 0x10000...",
    log_update_complete_reboot: "Mise à jour terminée ! Redémarrage de la carte...",
    log_flash_error: "Erreur lors du flash : {message}",
    flash_status_connecting: "Connexion à l'ESP32...",
    flash_status_syncing: "Synchronisation de la carte...",
    flash_status_chip: "Puce détectée : {chip}",
    log_download_bin: "Téléchargement du firmware depuis {url}...",
    log_download_bin_failed: "Impossible de récupérer le binaire ({status})",
    flash_status_writing: "Écriture en cours (flash)...",
    flash_status_success: "Flash Réussi !",
    flash_status_failed: "ÉCHEC !",
    
    // Télémétrie dynamique
    mission_rocket: "Fusée (FX)",
    mission_minirocket: "Minifusée (MF)",
    mission_balloon: "Ballon (BALLOON)",
    mission_other: "Autre (OTHER)",
    unit_bytes: "octets",
    status_active: "ACTIF",
    status_lost: "PERDU",
    
    // Alertes vocales
    voice_new_tracker: "Nouveau tracker détecté, {name}",
    voice_tracker_back: "Tracker {name} de retour en ligne",
    voice_tracker_lost: "Alerte, tracker {name} perdu"
  },
  en: {
    badge_disconnected: "Disconnected",
    badge_connected: "Connected",
    header_title: "NECTAR RX STATION",
    header_subtitle: "Web Control Center v1.6.2",
    conn_title: "🔌 USB Serial Link",
    maintenance_title: "🛠️ Tools & Maintenance",
    sd_title: "📁 SD Card Logs",
    sd_desc: "List and download flight CSV files recorded on the SD card.",
    at_helper_title: "📋 AT Command Cheatsheet",
    at_desc_at: "Test communication with the station",
    at_desc_help: "Print the complete help menu",
    at_desc_info: "Query station identification",
    at_desc_freq_get: "Query the active frequency",
    at_desc_freq_set: "Set the LoRa frequency (in MHz)",
    at_desc_sf_get: "Query the Spreading Factor",
    at_desc_sf_set: "Set the Spreading Factor (6-12)",
    at_desc_bw_get: "Query the bandwidth",
    at_desc_bw_set: "Set the bandwidth (kHz)",
    at_desc_crc_get: "Query CRC status",
    at_desc_crc_set: "Set CRC (0=OFF, 1=ON [,mode])",
    at_desc_fmt_get: "Query the active serial frame format",
    at_desc_fmt_set: "Set the serial frame format (0=No GSFLAG, 1=With GSFLAG)",
    at_desc_err_get: "Get count of invalid/corrupted packets (e.g. CRC fail)",
    at_desc_time_get: "Query the station's RTC time",
    at_desc_time_set: "Set the RTC time (Unix Epoch)",
    at_desc_rssi_get: "RSSI of the last received packet",
    at_desc_snr_get: "SNR of the last received packet",
    at_desc_sig_get: "RSSI and SNR of the last packet",
    at_desc_cfg: "Get detailed configuration",
    at_desc_list: "List CSV log files on the SD card",
    at_desc_dump: "Print/download a CSV file",
    at_desc_save: "Save active configuration to NVS",
    at_desc_reset: "Factory reset and reboot",
    sd_btn_list: "List Files",
    sd_th_name: "Name",
    sd_th_size: "Size",
    sd_th_action: "Action",
    sd_files_empty: "No files listed",
    sd_status_label: "Downloading:",
    sd_download_btn: "Download",
    sd_download_wait: "Downloading...",
    log_sd_download_start: "Downloading {file}...",
    log_sd_download_success: "Download successful: {file} ({lines} lines)",
    log_sd_download_error: "Download error: {message}",
    conn_baudrate: "Baud Rate:",
    conn_fw_version: "Frame Format:",
    conn_fw_with_gs: "With GS Flag (v1.6.2)",
    conn_fw_without_gs: "Without GS Flag (v1.3.1)",
    conn_btn_connect: "Connect",
    conn_btn_disconnect: "Disconnect",
    conn_status_label: "Status:",
    conn_no_device: "No device connected",
    conn_port_prefix: "Port: ",
    conn_voice_alerts: "🎙️ Voice Synthesis (Tracker Alerts)",
    conn_wasp_decoding: "🐝 Enable WASP Decoder (32B)",
    wasp_title: "🚀 Decrypted Wasp Telemetry",
    wasp_waiting_tracker: "Waiting for transmitter...",
    wasp_recenter_title: "Recenter map on active tracker",
    wasp_alt: "ALTITUDE (M)",
    wasp_spd: "SPEED (KM/H)",
    wasp_cog: "HEADING (COG)",
    wasp_lat: "LATITUDE",
    wasp_lon: "LONGITUDE",
    wasp_sats: "SATELLITES",
    wasp_temp: "TEMPERATURE (°C)",
    wasp_vbat: "BATTERY (V)",
    wasp_signal: "RSSI / SNR",
    wasp_map_title: "🗺️ Live GPS Position",
    config_title: "⚙️ Radio Settings",
    config_frequency: "Frequency (MHz):",
    config_sf: "Spreading Factor (SF):",
    config_bw: "Bandwidth (BW):",
    config_crc: "CRC Control:",
    config_btn_read: "Refresh",
    config_btn_write: "Apply",
    config_btn_save: "Save NVS",
    config_btn_reset: "Factory Reset",
    stats_title: "📊 Link Quality",
    stats_rssi: "RSSI (dBm)",
    stats_snr: "SNR (dB)",
    chart_rssi_title: "RSSI Trend",
    chart_snr_title: "SNR Trend",
    stats_count: "Frames (Received / KO)",
    stats_count_recv: "Received Frames",
    stats_crc_errors: "CRC Errors",
    flash_title: "⚡ Firmware Update",
    flash_desc: "Flash version <strong>v1.6.2</strong> directly from your browser via USB port.",
    flash_version: "Firmware Version:",
    flash_version_latest: "Latest version (v1.6.2)",
    flash_version_131: "Historical version (v1.3.1)",
    flash_btn_flash: "Flash Board (v1.6.2)",
    flash_band: "Board's native Radio Band:",
    flash_band_868: "868 MHz (Europe)",
    flash_band_433: "433 MHz",
    flash_status_label: "Status:",
    flash_status_waiting: "Waiting...",
    trackers_title: "🛸 Detected Transmitters (Active Trackers)",
    btn_reset: "Reset",
    th_tracker: "Tracker (SSID)",
    th_mission_type: "Mission Type",
    th_last_apid: "Last APID",
    th_received_frames: "Received Frames",
    th_last_activity: "Last Activity",
    th_status: "Status",
    th_payload: "Payload (Hex)",
    th_crc: "CRC",
    th_signal_quality: "Signal Quality (RSSI / SNR)",
    trackers_empty: "No transmitter detected yet. Connect the LoRa receiver to intercept signals.",
    telemetry_title: "📡 Live received frames (NectarMC)",
    telemetry_btn_export: "Export CSV",
    btn_clear: "Clear",
    th_index: "Index",
    th_timestamp: "Timestamp",
    th_apid: "APID",
    th_size: "Size",
    th_rssi: "RSSI",
    th_snr: "SNR",
    telemetry_empty: "No frames received yet. Connect the serial port and power on your trackers.",
    terminal_title: "📟 Console & Terminal",
    terminal_placeholder: "Type an AT command (e.g. AT, AT+FREQ?, AT+CFG)...",
    btn_send: "Send",
    footer_credit: "Designed and developed by",
    
    // Dialogues and logs
    alert_browser_unsupported: "Your browser does not support the Web Serial API. Please use Google Chrome, Microsoft Edge, or Opera.",
    confirm_factory_reset: "Do you want to restore factory settings? The board will reboot.",
    alert_no_frames_export: "No frames in memory to export.",
    alert_monitor_active_disconnect: "The serial monitor link is active. Please click 'Disconnect' before starting the firmware flash.",
    log_flash_port_select: "Selecting the serial port for flash (choose your board's port)...",
    log_port_opening: "Opening serial port at {baud} baud...",
    log_conn_success: "Connection established successfully.",
    log_conn_error: "Connection error: {message}",
    log_disconnected: "Serial link disconnected.",
    log_read_error: "Read error: {message}",
    log_send_error: "Send error: {message}",
    log_physical_disconnect: "The serial port was physically disconnected.",
    log_crc_error: "[CRC ERROR] Frame discarded: received CRC = {rec}, calculated = {calc}",
    log_write_flash_start: "Starting application write at 0x10000...",
    log_update_complete_reboot: "Update complete! Rebooting board...",
    log_flash_error: "Error during flash: {message}",
    flash_status_connecting: "Connecting to ESP32...",
    flash_status_syncing: "Synchronizing board...",
    flash_status_chip: "Chip detected: {chip}",
    log_download_bin: "Downloading firmware from {url}...",
    log_download_bin_failed: "Could not fetch the binary ({status})",
    flash_status_writing: "Writing in progress (flash)...",
    flash_status_success: "Flash Success!",
    flash_status_failed: "FAILED!",
    
    // Dynamic telemetry
    mission_rocket: "Rocket (FX)",
    mission_minirocket: "Mini-rocket (MF)",
    mission_balloon: "Balloon (BALLOON)",
    mission_other: "Other (OTHER)",
    unit_bytes: "bytes",
    status_active: "ACTIVE",
    status_lost: "LOST",
    
    // Vocal alerts
    voice_new_tracker: "New tracker detected, {name}",
    voice_tracker_back: "Tracker {name} back online",
    voice_tracker_lost: "Alert, tracker {name} lost"
  }
};

/**
 * Traduit une clé en lui injectant des variables dynamiques.
 * @param {string} key Clé de traduction.
 * @param {Object} replacements Remplacements (ex: { name: "FX3" }).
 * @param {string} lang Langue cible ('fr' ou 'en').
 */
export function getTranslation(key, replacements = {}, lang = localStorage.getItem('nectar_lang') || 'fr') {
  let text = translations[lang]?.[key] || translations['fr']?.[key] || key;
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(`{${placeholder}}`, value);
  }
  return text;
}

/**
 * Met à jour dynamiquement le DOM avec la langue fournie et dispatche un événement global.
 * @param {string} lang Langue à appliquer ('fr' ou 'en').
 */
export function updateLanguage(lang) {
  if (lang !== 'fr' && lang !== 'en') {
    lang = 'fr';
  }
  localStorage.setItem('nectar_lang', lang);
  
  // 1. Remplacer les textes des balises avec data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      if (translations[lang][key].includes('<') && translations[lang][key].includes('>')) {
        el.innerHTML = translations[lang][key];
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });

  // 2. Remplacer les placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // 3. Remplacer les attributs title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (translations[lang] && translations[lang][key]) {
      el.title = translations[lang][key];
    }
  });

  // 4. Mettre à jour l'apparence des boutons de langue
  const btnFr = document.getElementById('btn-lang-fr');
  const btnEn = document.getElementById('btn-lang-en');
  if (btnFr && btnEn) {
    if (lang === 'fr') {
      btnFr.classList.add('active');
      btnEn.classList.remove('active');
    } else {
      btnEn.classList.add('active');
      btnFr.classList.remove('active');
    }
  }

  // 5. Envoyer l'événement personnalisé pour notifier les autres modules
  window.dispatchEvent(new CustomEvent('lang-changed', { detail: lang }));
}

// Auto-liaison des événements de langues au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  const btnLangFr = document.getElementById('btn-lang-fr');
  const btnLangEn = document.getElementById('btn-lang-en');
  if (btnLangFr) btnLangFr.addEventListener('click', () => updateLanguage('fr'));
  if (btnLangEn) btnLangEn.addEventListener('click', () => updateLanguage('en'));

  // Langue initiale
  const savedLang = localStorage.getItem('nectar_lang');
  if (savedLang) {
    updateLanguage(savedLang);
  } else {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang && browserLang.startsWith('en')) {
      updateLanguage('en');
    } else {
      updateLanguage('fr');
    }
  }
});

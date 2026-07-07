/**
 * @file map.js
 * @brief Composant de gestion de la cartographie Leaflet.js pour RocketStation.
 */

export class NectarMap {
  constructor(mapId) {
    this.mapId = mapId;
    this.map = null;
    this.markers = {};       // { trackerName: L.marker }
    this.trajectories = {};  // { trackerName: [[lat, lon], ...] }
    this.polylines = {};     // { trackerName: L.polyline }
    this.lastPos = null;
  }

  /**
   * Initialise la carte Leaflet sur l'identifiant HTML fourni.
   */
  init() {
    if (this.map) return; // Déjà initialisée
    
    // Coordonnées par défaut (centre de la France)
    const defaultLat = 46.2276;
    const defaultLon = 2.2137;
    
    // Initialisation
    this.map = L.map(this.mapId).setView([defaultLat, defaultLon], 5);
    
    // Style sombre CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(this.map);
  }

  /**
   * Recalcule la taille de la carte (requis après affichage d'un conteneur masqué).
   */
  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  /**
   * Centre la carte sur une coordonnée.
   */
  setView(lat, lon, zoom = 13) {
    if (this.map) {
      this.map.setView([lat, lon], zoom);
    }
  }

  /**
   * Ajoute ou met à jour la position géographique d'un tracker sur la carte.
   * @param {string} trackerName Nom de l'émetteur (ex: FX3).
   * @param {Object} data Données GPS (lat, lon, alt, spd, cog, gpsFix, utc, apid).
   * @param {string} activeTrackerName Nom de l'émetteur actuellement suivi par l'IHM.
   */
  updateTrackerPosition(trackerName, data, activeTrackerName) {
    const { lat, lon, alt, spd, cog, gpsFix, utc, apid } = data;
    if (lat === 0 && lon === 0 || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

    this.lastPos = { lat, lon };
    const pos = [lat, lon];

    // Initialiser l'historique de trajectoire si nécessaire
    if (!this.trajectories[trackerName]) {
      this.trajectories[trackerName] = [];
    }

    this.trajectories[trackerName].push(pos);
    if (this.trajectories[trackerName].length > 50) {
      this.trajectories[trackerName].shift(); // Limite aux 50 derniers points
    }

    const timeStr = utc > 0 ? new Date(utc * 1000).toLocaleTimeString() : 'Inconnue';
    const popupText = `
      <b>Tracker WASP: ${trackerName} (APID: ${apid})</b><br>
      Altitude: ${alt.toFixed(1)} m<br>
      Vitesse: ${spd.toFixed(1)} km/h<br>
      Cap (COG): ${cog.toFixed(1)}°<br>
      GPS Fix: ${gpsFix ? 'Fix valide' : 'Pas de fix'}<br>
      Heure GPS: ${timeStr}
    `;

    if (this.map) {
      // 1. Dessin de la ligne de tracé (Polyline)
      if (!this.polylines[trackerName]) {
        const colors = ['#06b6d4', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#3b82f6'];
        const colorIdx = Object.keys(this.trajectories).length % colors.length;
        this.polylines[trackerName] = L.polyline(this.trajectories[trackerName], {
          color: colors[colorIdx],
          weight: 3,
          opacity: 0.8
        }).addTo(this.map);
      } else {
        this.polylines[trackerName].setLatLngs(this.trajectories[trackerName]);
      }

      // 2. Positionnement du marqueur
      if (!this.markers[trackerName]) {
        this.markers[trackerName] = L.marker(pos).addTo(this.map);
        this.markers[trackerName].bindPopup(popupText);
        if (trackerName === activeTrackerName) {
          this.markers[trackerName].openPopup();
        }
      } else {
        this.markers[trackerName].setLatLng(pos);
        this.markers[trackerName].setPopupContent(popupText);
      }

      // Micro-animation CSS de pulsation
      const marker = this.markers[trackerName];
      if (marker && marker._icon) {
        const iconEl = marker._icon;
        iconEl.classList.remove('wasp-pulse');
        void iconEl.offsetWidth; // Force reflow DOM
        iconEl.classList.add('wasp-pulse');
      }

      // Recentrage automatique lors de la première acquisition
      if (trackerName === activeTrackerName && this.trajectories[trackerName].length === 1) {
        this.map.setView(pos, this.map.getZoom() < 10 ? 14 : this.map.getZoom());
      }
    }
  }

  /**
   * Supprime un émetteur de la carte.
   */
  removeTracker(trackerName) {
    if (this.map) {
      if (this.markers[trackerName]) {
        this.map.removeLayer(this.markers[trackerName]);
        delete this.markers[trackerName];
      }
      if (this.polylines[trackerName]) {
        this.map.removeLayer(this.polylines[trackerName]);
        delete this.polylines[trackerName];
      }
    }
    delete this.trajectories[trackerName];
  }

  /**
   * Réinitialise complètement la carte (supprime tous les marqueurs et lignes).
   */
  clear() {
    Object.keys(this.markers).forEach(name => {
      if (this.map && this.markers[name]) {
        this.map.removeLayer(this.markers[name]);
      }
    });
    this.markers = {};

    Object.keys(this.polylines).forEach(name => {
      if (this.map && this.polylines[name]) {
        this.map.removeLayer(this.polylines[name]);
      }
    });
    this.polylines = {};
    this.trajectories = {};
    this.lastPos = null;
  }
}

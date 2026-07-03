import sys
import time
import random
import struct
import math

try:
    import serial
except ImportError:
    print("Erreur: Le module 'pyserial' est requis pour exécuter ce script.")
    print("Veuillez l'installer avec : pip install pyserial")
    sys.exit(1)

NECTAR_MAGIC = 0xEB

# Structure WASP de 29 octets (les 3 premiers octets id/apid/type sont déjà consommés dans l'entête NectarMC)
# UTC (4B, uint32) + Lat (4B, float) + Lon (4B, float) + Alt (4B, float) + Spd (4B, float) + Cog (4B, float) + Vbat (2B, uint16) + Temp (2B, int16) + Status (1B, uint8)
WASP_STRUCT_FORMAT = "<IfffffHhB"

class WaspTrackerSimulator:
    """
    Simulateur individuel d'un tracker WASP avec trajectoire continue et réaliste.
    """
    def __init__(self, ssid_type: int, ssid_num: int, apid: int, start_lat: float, start_lon: float):
        self.ssid_type = ssid_type  # 0=FX, 1=MF, 2=BALLOON
        self.ssid_num = ssid_num
        self.apid = apid
        self.lat = start_lat
        self.lon = start_lon
        
        # Etats internes
        self.alt = 120.0             # Altitude initiale (m)
        self.spd = 0.0               # Vitesse initiale (km/h)
        self.cog = 0.0               # Cap (degrés)
        self.vbat = 4200             # Tension accu de démarrage (mV)
        self.temp = 2200             # Température de démarrage (centièmes de °C, soit 22.00 °C)
        self.time_offset = 0
        self.step = 0
        self.phase = "LAUNCH"        # LAUNCH, DESCENT, LANDED (pour les fusées)
        
        # Préfixe pour affichage
        prefixes = {0: "FX", 1: "MF", 2: "BALLOON", 3: "OTHER"}
        self.name = f"{prefixes.get(self.ssid_type, 'OTHER')}{self.ssid_num}"

    def update(self):
        """
        Met à jour les paramètres physiques en fonction du type de mission.
        """
        self.step += 1
        
        # Température et batterie descendent lentement
        self.vbat = max(3300, self.vbat - random.randint(0, 3))
        self.temp += random.randint(-15, 10)
        
        if self.ssid_type == 0:  # 🚀 FUSÉE (Vol balistique rapide)
            if self.phase == "LAUNCH":
                self.alt += random.uniform(80, 150)
                self.spd = random.uniform(300, 600)
                self.cog = (self.cog + random.uniform(-5, 5)) % 360
                # Légère dérive géographique
                self.lat += 0.0003 * math.cos(math.radians(self.cog))
                self.lon += 0.0003 * math.sin(math.radians(self.cog))
                if self.alt >= 2500:
                    self.phase = "DESCENT"
            elif self.phase == "DESCENT":
                self.alt = max(120.0, self.alt - random.uniform(15, 30))
                self.spd = random.uniform(40, 80)
                self.cog = (self.cog + random.uniform(-10, 10)) % 360
                self.lat += 0.0001 * math.cos(math.radians(self.cog))
                self.lon += 0.0001 * math.sin(math.radians(self.cog))
                if self.alt <= 125.0:
                    self.phase = "LANDED"
            else: # LANDED
                self.alt = 120.0
                self.spd = 0.0
                if random.random() < 0.02: # Possibilité de re-décollage pour la simulation
                    self.phase = "LAUNCH"
                    
        elif self.ssid_type == 1:  # ✈️ MINI-FUSÉE (Vol court et bas)
            if self.phase == "LAUNCH":
                self.alt += random.uniform(20, 45)
                self.spd = random.uniform(120, 240)
                self.cog = (self.cog + random.uniform(-10, 10)) % 360
                self.lat += 0.0001 * math.cos(math.radians(self.cog))
                self.lon += 0.0001 * math.sin(math.radians(self.cog))
                if self.alt >= 450:
                    self.phase = "DESCENT"
            elif self.phase == "DESCENT":
                self.alt = max(120.0, self.alt - random.uniform(5, 12))
                self.spd = random.uniform(20, 40)
                self.cog = (self.cog + random.uniform(-15, 15)) % 360
                self.lat += 0.00005 * math.cos(math.radians(self.cog))
                self.lon += 0.00005 * math.sin(math.radians(self.cog))
                if self.alt <= 125.0:
                    self.phase = "LANDED"
            else: # LANDED
                self.alt = 120.0
                self.spd = 0.0
                if random.random() < 0.05:
                    self.phase = "LAUNCH"

        elif self.ssid_type == 2:  # 🎈 BALLON (Montée lente, dérive au vent)
            # Le ballon monte continuellement puis éclate vers 16000m
            if self.alt < 15000:
                self.alt += random.uniform(2, 6)
                # Température descend en altitude
                self.temp = max(-4500, self.temp - random.randint(5, 15))
            else: # Éclatement et descente sous parachute
                self.alt = max(120.0, self.alt - random.uniform(10, 25))
                self.temp = min(2000, self.temp + random.randint(10, 25))
                if self.alt <= 125.0:
                    self.alt = 120.0
            
            self.spd = random.uniform(15, 45)
            # Dérive constante vers l'Est-Nord-Est (vent)
            self.cog = 65.0 + random.uniform(-10, 10)
            self.lat += 0.00008 * math.cos(math.radians(self.cog))
            self.lon += 0.00008 * math.sin(math.radians(self.cog))

    def generate_payload(self) -> bytes:
        """
        Génère la charge utile binaire de 29 octets.
        """
        utc_now = int(time.time())
        
        # Bit 7 du status : GPS Fix (1 = Valide), bits 0-4: Sats (12 à 24)
        num_sats = random.randint(12, 19)
        status_byte = 0x80 | (num_sats & 0x1F) 
        
        payload_bytes = struct.pack(
            WASP_STRUCT_FORMAT,
            utc_now,
            self.lat,
            self.lon,
            self.alt,
            self.spd,
            self.cog,
            self.vbat,
            self.temp,
            status_byte
        )
        return payload_bytes

def calculate_crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc

def create_nectar_frame(ssid_type: int, ssid_num: int, apid: int, payload: bytes, rssi: int, snr: float, corrupt_crc: bool = False) -> bytes:
    ssid = ((ssid_type & 0x03) << 8) | (ssid_num & 0xFF)
    id_mission = ((ssid & 0x03FF) << 6) | (apid & 0x3F)
    
    payload_len = len(payload)
    header = struct.pack("<BHB", NECTAR_MAGIC, id_mission, payload_len)
    
    rssi_byte = struct.pack("<b", rssi)
    snr_byte = struct.pack("<b", int(snr * 4.0))
    
    current_time = int(time.time())
    time_bytes = struct.pack("<I", current_time)
    
    data_to_protect = header + payload + rssi_byte + snr_byte + time_bytes
    crc = calculate_crc16_ccitt(data_to_protect)
    
    if corrupt_crc:
        crc = (crc ^ 0x5555) & 0xFFFF
        
    crc_bytes = struct.pack("<H", crc)
    return data_to_protect + crc_bytes + b'\n'

def main():
    port = sys.argv[1] if len(sys.argv) > 1 else 'COM12'
    baud = 115200
    
    print("==========================================================")
    print("      Simulateur de Trames WASP (v1.6.1 Multi-Tracker)")
    print("==========================================================")
    print(f"Connexion au port série : {port} à {baud} baud...")
    
    try:
        ser = serial.Serial(port, baud, timeout=1)
        print("Connexion RÉUSSIE. Début de la simulation des trackers...")
    except Exception as e:
        print(f"Erreur d'ouverture du port série: {e}")
        print("Assurez-vous d'avoir créé une paire de ports COM virtuels (ex: COM11 <-> COM12).")
        sys.exit(1)
        
    # Création de 3 simulateurs de trackers WASP sur des zones géographiques distinctes
    # Centre de la France, Lyon, et Paris pour de jolis tracés sur la carte
    trackers = [
        WaspTrackerSimulator(ssid_type=0, ssid_num=3, apid=5, start_lat=46.2276, start_lon=2.2137),       # FX3 (Centre)
        WaspTrackerSimulator(ssid_type=1, ssid_num=12, apid=10, start_lat=45.7597, start_lon=4.8422),    # MF12 (Lyon)
        WaspTrackerSimulator(ssid_type=2, ssid_num=1, apid=2, start_lat=48.8566, start_lon=2.3522)       # BALLOON1 (Paris)
    ]
    
    print("\nSimulateurs démarrés :")
    for t in trackers:
        print(f" - {t.name} (APID: {t.apid}) - Position Init: {t.lat}, {t.lon}")
        
    print("\nSimulation en cours. Appuyez sur Ctrl+C pour quitter.")
    print("----------------------------------------------------------")
    
    packet_index = 0
    try:
        while True:
            for tracker in trackers:
                packet_index += 1
                
                # Mise à jour de la physique du tracker
                tracker.update()
                payload = tracker.generate_payload()
                
                # Aléatoire physique de transmission LoRa
                rssi = random.randint(-105, -60)
                snr = round(random.uniform(-8.0, 11.0), 2)
                
                # 5% de trames corrompues pour tester le statut CRC sur l'interface
                corrupt = (random.random() < 0.05)
                
                # Génération et envoi de la trame
                frame = create_nectar_frame(
                    tracker.ssid_type,
                    tracker.ssid_num,
                    tracker.apid,
                    payload,
                    rssi,
                    snr,
                    corrupt_crc=corrupt
                )
                
                ser.write(frame)
                
                status_str = "❌ CRC ERROR" if corrupt else "✅ OK"
                print(f"[{time.strftime('%H:%M:%S')}] Envoyé #{packet_index} | Tracker: {tracker.name} | APID: {tracker.apid} | Alt: {tracker.alt:.1f}m | Temp: {tracker.temp/100:.2f}°C | Status: {status_str}")
                
                # Délai d'1 seconde entre chaque émetteur pour une télémétrie continue
                time.sleep(1.0)
                
    except KeyboardInterrupt:
        print("\nSimulation arrêtée.")
    finally:
        ser.close()
        print("Port série fermé.")

if __name__ == '__main__':
    main()


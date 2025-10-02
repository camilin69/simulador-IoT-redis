import redis
import requests
import json
import time
REDIS_HOST = "localhost"
REDIS_PORT = 6379
INTERVALO_PUBLICACION = 10
SENSORES = {
    "bogota":    {"lat": 4.6097, "lon": -74.0817, "canal_redis": "clima:co:bogota"},
    "madrid":    {"lat": 40.4165, "lon": -3.7026, "canal_redis": "clima:es:madrid"},
    "tokio":     {"lat": 35.6895, "lon": 139.6917, "canal_redis": "clima:jp:tokio"},
    "sydney":    {"lat": -33.8688, "lon": 151.2093, "canal_redis": "clima:au:sydney"}
}
API_BASE_URL = "https://api.open-meteo.com/v1/forecast"
API_PARAMS = "current=temperature_2m,relative_humidity_2m,wind_speed_10m"
def conectar_a_redis(host, port):
    try:
        r = redis.Redis(host=host, port=port, db=0, decode_responses=True)
        r.ping()
        print(f"✅ Conexión exitosa a Redis en {host}:{port}")
        return r
    except redis.exceptions.ConnectionError as e:
        print(f"❌ Error fatal: No se pudo conectar con Redis en {host}:{port}.")
        print(f"   Asegúrate de que Redis esté corriendo. Error: {e}")
        exit() 
def obtener_datos_climaticos(lat, lon):
    url = f"{API_BASE_URL}?latitude={lat}&longitude={lon}&{API_PARAMS}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()  
        data = response.json().get("current", {})
        datos_procesados = {
            "temperatura_c": data.get("temperature_2m"),
            "humedad_porc": data.get("relative_humidity_2m"),
            "viento_kmh": data.get("wind_speed_10m"),
            "timestamp_utc": int(time.time()) 
        }
        return datos_procesados
    except requests.exceptions.RequestException as e:
        print(f"   -> Advertencia: No se pudieron obtener datos para ({lat}, {lon}). Error: {e}")
        return None
def publicar_en_redis(redis_client, canal, datos):
    mensaje_json = json.dumps(datos)
    redis_client.publish(canal, mensaje_json)
    print(f"   -> Publicado en canal '{canal}': {mensaje_json}")
def main():
    print("🚀 Iniciando el publicador de datos de sensores IoT...")
    redis_client = conectar_a_redis(REDIS_HOST, REDIS_PORT)
    while True:
        print(f"\n--- {time.strftime('%Y-%m-%d %H:%M:%S')} | Iniciando ciclo de actualización ---")
        for nombre_sensor, info in SENSORES.items():
            print(f"Consultando sensor: {nombre_sensor.capitalize()}")
            datos_climaticos = obtener_datos_climaticos(info["lat"], info["lon"])
            if datos_climaticos:
                publicar_en_redis(redis_client, info["canal_redis"], datos_climaticos)
        print(f"\n--- Ciclo completado. Esperando {INTERVALO_PUBLICACION} segundos... ---")
        time.sleep(INTERVALO_PUBLICACION)
if __name__ == "__main__":
    main()
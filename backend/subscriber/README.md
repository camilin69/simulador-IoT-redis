# Subscriber (web)

Este servicio se conecta a Redis (patrón `clima:*`) y retransmite los mensajes a clientes web vía Socket.IO.

Requisitos:
- Node.js 16+ y npm
- Redis corriendo (local o remoto)

Instalación y ejecución:

1. Abrir terminal en `backend/subscriber`
2. Instalar dependencias:

   npm install

3. Ejecutar:

   # Usar variables opcionales REDIS_HOST y REDIS_PORT
   REDIS_HOST=127.0.0.1 REDIS_PORT=6379 npm start

Luego abrir http://localhost:3000 en el navegador para ver las gráficas.

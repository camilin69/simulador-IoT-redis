import { io, Socket } from 'socket.io-client';

export interface SensorData {
  temperatura_c: number;
  humedad_porc: number;
  viento_kmh: number;
  timestamp_utc: number;
}

export interface WebSocketMessage {
  channel: string;
  data: SensorData;
}

export interface HistoricalDataPoint {
  name: string;
  temperatura: number;
  humedad: number;
  viento: number;
  time: string;
  timestamp: number;
}

export interface RedisHistoricalData {
  [sensorName: string]: SensorData[];
}

export interface ChartsProps {
  sensorData: { [key: string]: SensorData };
  historicalData: { [key: string]: HistoricalDataPoint[] };
}

class SensorService {
  private static instance: SensorService;
  private socket: Socket | null = null;
  private listeners: ((data: WebSocketMessage) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;

  private constructor() {}

  static getInstance(): SensorService {
    if (!SensorService.instance) {
      SensorService.instance = new SensorService();
    }
    return SensorService.instance;
  }

  // Método para obtener datos históricos de Redis
  async fetchHistoricalData(): Promise<RedisHistoricalData> {
    try {
      const baseUrl = this.getBaseUrl();
      console.log(`🔄 Intentando conectar a: ${baseUrl}/api/historical-data`);
      
      const response = await fetch(`${baseUrl}/api/historical-data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Datos históricos recuperados:', Object.keys(data).length, 'sensores');
      return data;
    } catch (error) {
      console.error('❌ Error obteniendo datos históricos:', error);
      return {};
    }
  }

  private getBaseUrl(): string {
    // Siempre usar localhost:3001 desde el navegador
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  connect(onMessage: (data: WebSocketMessage) => void): void {
    this.listeners.push(onMessage);
    
    if (this.socket?.connected) {
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    
    console.log(`🔗 Conectando a Socket.IO: ${wsUrl}`);
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('🚀 Conectado al servidor Socket.IO');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('sensor-data', (message: WebSocketMessage) => {
      try {
        console.log('📨 Datos recibidos:', message);
        this.listeners.forEach(listener => listener(message));
      } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Conexión Socket.IO cerrada:', reason);
      this.isConnected = false;
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('💥 Error de conexión Socket.IO:', error.message);
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('💥 Error Socket.IO:', error);
    });
  }

  private getWebSocketUrl(): string {
    // Siempre usar localhost:3001 desde el navegador
    return import.meta.env.VITE_WS_URL || 'http://localhost:3001';
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 10000);
      
      console.log(`🔄 Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.listeners.length > 0 && this.socket) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners = [];
    this.reconnectAttempts = 0;
    this.isConnected = false;
  }

  getSensorName(channel: string): string {
    return channel.split(':').pop() || 'unknown';
  }

  getSensorLocation(sensorName: string): string {
    const locations: { [key: string]: string } = {
      bogota: 'Bogotá, Colombia',
      madrid: 'Madrid, España',
      tokio: 'Tokio, Japón',
      sydney: 'Sídney, Australia'
    };
    return locations[sensorName] || 'Ubicación desconocida';
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleTimeString();
  }

  processHistoricalData(sensorData: { [key: string]: SensorData }, maxPoints: number = 50): { [key: string]: HistoricalDataPoint[] } {
    const historicalData: { [key: string]: HistoricalDataPoint[] } = {};

    Object.entries(sensorData).forEach(([sensorName, data]) => {
      if (!data || !data.timestamp_utc) return;

      const newDataPoint: HistoricalDataPoint = {
        name: sensorName,
        temperatura: data.temperatura_c,
        humedad: data.humedad_porc,
        viento: data.viento_kmh,
        time: this.formatTimestamp(data.timestamp_utc),
        timestamp: data.timestamp_utc
      };

      if (!historicalData[sensorName]) {
        historicalData[sensorName] = [];
      }

      const existingIndex = historicalData[sensorName].findIndex(
        point => point.timestamp === data.timestamp_utc
      );

      if (existingIndex >= 0) {
        historicalData[sensorName][existingIndex] = newDataPoint;
      } else {
        historicalData[sensorName] = [
          ...historicalData[sensorName],
          newDataPoint
        ].slice(-maxPoints);
      }
    });

    return historicalData;
  }

  convertRedisHistoricalData(redisData: RedisHistoricalData): { [key: string]: HistoricalDataPoint[] } {
    const historicalData: { [key: string]: HistoricalDataPoint[] } = {};

    Object.entries(redisData).forEach(([sensorName, dataArray]) => {
      historicalData[sensorName] = dataArray.map(data => ({
        name: sensorName,
        temperatura: data.temperatura_c,
        humedad: data.humedad_porc,
        viento: data.viento_kmh,
        time: this.formatTimestamp(data.timestamp_utc),
        timestamp: data.timestamp_utc
      }));
      // ✅ ELIMINA el .slice(-20) para mostrar todos los datos
      // .slice(-20) ← QUITAR ESTA LÍNEA
    });

    return historicalData;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const sensorService = SensorService.getInstance();
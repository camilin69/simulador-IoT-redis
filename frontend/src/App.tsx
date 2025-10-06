// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import Charts from './components/Charts';
import { type SensorData, sensorService, type WebSocketMessage, type RedisHistoricalData, type HistoricalDataPoint } from './services/sensor';
import { FiGlobe, FiWifi, FiWifiOff, FiRefreshCw, FiMapPin, FiAlertCircle, FiCheckCircle, FiThermometer, FiDroplet, FiWind, FiClock } from 'react-icons/fi';

function App() {
  const [sensorData, setSensorData] = useState<{ [key: string]: SensorData }>({});
  const [historicalData, setHistoricalData] = useState<{ [key: string]: HistoricalDataPoint[] }>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);
  const [historicalDataError, setHistoricalDataError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Inicializando aplicación...');
        
        // Cargar datos históricos de forma no bloqueante
        const loadHistoricalData = async () => {
          try {
            console.log('📊 Cargando datos históricos...');
            const redisHistoricalData: RedisHistoricalData = await sensorService.fetchHistoricalData();
            
            if (Object.keys(redisHistoricalData).length > 0) {
              console.log('✅ Datos históricos cargados:', redisHistoricalData);
              
              // 1. Convertir datos históricos al formato de historicalData para gráficas
              const convertedHistoricalData = sensorService.convertRedisHistoricalData(redisHistoricalData);
              setHistoricalData(convertedHistoricalData);
              
              // 2. Convertir datos históricos al formato de sensorData para mostrar en tarjetas
              const initialSensorData: { [key: string]: SensorData } = {};
              Object.entries(redisHistoricalData).forEach(([sensorName, dataArray]) => {
                if (dataArray.length > 0) {
                  // Tomar el dato más reciente para cada sensor
                  initialSensorData[sensorName] = dataArray[dataArray.length - 1];
                }
              });
              
              if (Object.keys(initialSensorData).length > 0) {
                setSensorData(initialSensorData);
              }
            } else {
              console.log('ℹ️ No hay datos históricos disponibles');
              setHistoricalDataError('No hay datos históricos disponibles');
            }
          } catch (error) {
            console.error('❌ Error cargando datos históricos:', error);
            setHistoricalDataError('No se pudieron cargar los datos históricos. Mostrando solo datos en tiempo real.');
          } finally {
            setHistoricalDataLoaded(true);
          }
        };

        // No esperar por los datos históricos - cargar en segundo plano
        setHistoricalDataLoaded(true);
        loadHistoricalData();
        
      } catch (error) {
        console.error('Error inicializando aplicación:', error);
        setHistoricalDataLoaded(true);
        setHistoricalDataError('Error inicializando la aplicación');
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!historicalDataLoaded) return;

    const handleSensorMessage = (message: WebSocketMessage) => {
      const sensorName = sensorService.getSensorName(message.channel);
      
      // Actualizar datos en tiempo real para las tarjetas
      setSensorData(prev => ({
        ...prev,
        [sensorName]: message.data
      }));

      // Actualizar datos históricos para las gráficas
      setHistoricalData(prev => {
        const newHistoricalData = { ...prev };
        
        if (!newHistoricalData[sensorName]) {
          newHistoricalData[sensorName] = [];
        }

        const newDataPoint: HistoricalDataPoint = {
          name: sensorName,
          temperatura: message.data.temperatura_c,
          humedad: message.data.humedad_porc,
          viento: message.data.viento_kmh,
          time: sensorService.formatTimestamp(message.data.timestamp_utc),
          timestamp: message.data.timestamp_utc
        };

        // Verificar si ya existe un punto con el mismo timestamp
        const existingIndex = newHistoricalData[sensorName].findIndex(
          point => point.timestamp === message.data.timestamp_utc
        );

        if (existingIndex >= 0) {
          newHistoricalData[sensorName][existingIndex] = newDataPoint;
        } else {
          newHistoricalData[sensorName] = [
            ...newHistoricalData[sensorName],
            newDataPoint
          ];
        }

        return newHistoricalData;
      });
    };

    // Conectar al servicio WebSocket
    sensorService.connect(handleSensorMessage);

    // Verificar estado de conexión periódicamente
    const interval = setInterval(() => {
      const isConnected = (sensorService as any).isConnected;
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 1000);

    return () => {
      sensorService.disconnect();
      clearInterval(interval);
    };
  }, [historicalDataLoaded]);

  const getConnectionStatus = () => {
    const statusConfig = {
      connected: { 
        text: 'Conectado', 
        style: 'bg-green-500 text-white',
        icon: FiWifi
      },
      disconnected: { 
        text: 'Desconectado', 
        style: 'bg-red-500 text-white',
        icon: FiWifiOff
      },
      connecting: { 
        text: 'Conectando...', 
        style: 'bg-yellow-500 text-white',
        icon: FiRefreshCw
      }
    };
    
    return statusConfig[connectionStatus];
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FiGlobe className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                Monitor Climático Global
              </h1>
            </div>
            <p className="text-slate-300 text-lg">
              Monitoreo en tiempo real de sensores IoT alrededor del mundo
            </p>
            
            {/* Mensaje de estado de datos históricos */}
            {historicalDataError && (
              <div className="flex items-center gap-2 mt-2 text-amber-300 text-sm">
                <FiAlertCircle className="w-4 h-4" />
                {historicalDataError}
              </div>
            )}
            
            {historicalDataLoaded && !historicalDataError && Object.keys(historicalData).length > 0 && (
              <div className="flex items-center gap-2 mt-2 text-green-300 text-sm">
                <FiCheckCircle className="w-4 h-4" />
                {Object.keys(historicalData).length} sensores históricos cargados + streaming en tiempo real
              </div>
            )}
          </div>
          
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm shadow-lg ${status.style} transition-all duration-300`}>
            <StatusIcon className="w-4 h-4" />
            {status.text}
          </div>
        </header>

        <main className="space-y-6">
          {/* Charts Component - Pasamos ambos: datos en tiempo real e históricos */}
          <Charts sensorData={sensorData} historicalData={historicalData} />
          
          {/* Sensor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Object.entries(sensorData).map(([sensorName, data]) => (
              <div 
                key={sensorName} 
                className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Sensor Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 capitalize">
                      {sensorName}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <FiMapPin className="w-3 h-3" />
                      {sensorService.getSensorLocation(sensorName)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 font-medium">En línea</span>
                  </div>
                </div>

                {/* Sensor Data */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-700 font-medium flex items-center gap-2">
                      <FiThermometer className="w-4 h-4 text-red-500" />
                      Temperatura
                    </span>
                    <span className="text-xl font-bold text-red-600">
                      {data.temperatura_c}°C
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700 font-medium flex items-center gap-2">
                      <FiDroplet className="w-4 h-4 text-blue-500" />
                      Humedad
                    </span>
                    <span className="text-xl font-bold text-blue-600">
                      {data.humedad_porc}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-700 font-medium flex items-center gap-2">
                      <FiWind className="w-4 h-4 text-green-500" />
                      Viento
                    </span>
                    <span className="text-xl font-bold text-green-600">
                      {data.viento_kmh} km/h
                    </span>
                  </div>
                </div>

                {/* Last Update */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-right flex items-center justify-end gap-1">
                    <FiClock className="w-3 h-3" />
                    Actualizado: {sensorService.formatTimestamp(data.timestamp_utc)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {Object.keys(sensorData).length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              {!historicalDataLoaded ? (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Cargando datos históricos...
                  </h3>
                  <p className="text-gray-500">
                    Recuperando información previa de los sensores
                  </p>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    {connectionStatus === 'connected' ? 'Esperando datos de sensores' : 'Conectando al servidor...'}
                  </h3>
                  <p className="text-gray-500">
                    {connectionStatus === 'connected' 
                      ? 'Los datos de los sensores aparecerán aquí cuando estén disponibles'
                      : 'Verificando conexión con el servidor WebSocket'}
                  </p>
                </>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center pt-6 border-t border-slate-700">
          <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
            <FiGlobe className="w-4 h-4" />
            Sistema de Monitoreo IoT • Tiempo Real + Histórico • {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
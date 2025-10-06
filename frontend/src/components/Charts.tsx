// frontend/src/components/Charts.tsx
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { type SensorData, sensorService, type HistoricalDataPoint } from '../services/sensor';
import { FiThermometer, FiDroplet, FiWind, FiActivity, FiClock, FiDatabase, FiBarChart2, FiList } from 'react-icons/fi';

interface ChartsProps {
  sensorData: { [key: string]: SensorData };
  historicalData: { [key: string]: HistoricalDataPoint[] };
}

type ChartTab = 'temperature' | 'humidity' | 'wind';

// Interface para datos combinados por timestamp
interface CombinedDataPoint {
  time: string;
  timestamp: number;
  [sensorName: string]: number | string | null;
}

const Charts: React.FC<ChartsProps> = ({ sensorData, historicalData }) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('temperature');
  const [showTable, setShowTable] = useState(false);

  // DEBUG: Verificar qué datos estamos recibiendo
  console.log('📊 Charts - historicalData recibido:', historicalData);
  console.log('📊 Charts - sensorData recibido:', sensorData);

  // Preparar datos para gráficas combinadas - VERSIÓN SIMPLIFICADA
  const getCombinedData = (): CombinedDataPoint[] => {
    const activeSensors = Object.keys(historicalData);
    
    if (activeSensors.length === 0) {
      console.log('❌ No hay sensores activos en historicalData');
      return [];
    }

    console.log('🔍 Sensores activos:', activeSensors);

    // Encontrar todos los timestamps únicos
    const allTimestamps = new Set<number>();
    
    activeSensors.forEach(sensorName => {
      historicalData[sensorName].forEach(point => {
        allTimestamps.add(point.timestamp);
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    console.log('🕒 Timestamps encontrados:', sortedTimestamps.length);

    // Crear puntos combinados
    const combinedData = sortedTimestamps.map(timestamp => {
      const dataPoint: CombinedDataPoint = {
        time: `${new Date(timestamp * 1000).getHours()}:${new Date(timestamp * 1000).getMinutes().toString().padStart(2, '0')}`,
        timestamp: timestamp
      };

      // Para cada sensor, buscar el dato en este timestamp
      activeSensors.forEach(sensorName => {
        const sensorPoint = historicalData[sensorName].find(point => point.timestamp === timestamp);
        if (sensorPoint) {
          const dataKey = getDataKeyForSensor(activeTab);
          dataPoint[sensorName] = sensorPoint[dataKey] as number;
        } else {
          dataPoint[sensorName] = null;
        }
      });

      return dataPoint;
    });

    console.log('📈 Datos combinados generados:', combinedData.length);
    console.log('📈 Muestra de datos:', combinedData.length);
    
    return combinedData;
  };

  // Función para obtener el dataKey correcto para cada sensor
  const getDataKeyForSensor = (tab: ChartTab): keyof HistoricalDataPoint => {
    switch (tab) {
      case 'temperature': return 'temperatura';
      case 'humidity': return 'humedad';
      case 'wind': return 'viento';
      default: return 'temperatura';
    }
  };

  // Preparar datos para la tabla
  const getTableData = () => {
    const allData: any[] = [];

    Object.entries(historicalData).forEach(([sensorName, dataPoints]) => {
      dataPoints.forEach(point => {
        allData.push({
          sensor: sensorName,
          time: sensorService.formatTimestamp(point.timestamp),
          temperatura: point.temperatura,
          humedad: point.humedad,
          viento: point.viento,
          timestamp: point.timestamp,
          type: 'histórico'
        });
      });
    });

    // Agregar datos en tiempo real si no existen ya
    Object.entries(sensorData).forEach(([sensorName, data]) => {
      if (data && data.timestamp_utc) {
        const exists = allData.some(item => 
          item.sensor === sensorName && item.timestamp === data.timestamp_utc
        );
        
        if (!exists) {
          allData.push({
            sensor: sensorName,
            time: sensorService.formatTimestamp(data.timestamp_utc),
            temperatura: data.temperatura_c,
            humedad: data.humedad_porc,
            viento: data.viento_kmh,
            timestamp: data.timestamp_utc,
            type: 'tiempo real'
          });
        }
      }
    });

    return allData.sort((a, b) => b.timestamp - a.timestamp);
  };

  const renderChart = () => {
    const combinedData = getCombinedData();
    const activeSensors = Object.keys(historicalData);
    
    console.log('🎨 Renderizando gráfica con:', { 
      combinedDataLength: combinedData.length, 
      activeSensors,
      activeTab 
    });

    if (combinedData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FiDatabase className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No hay datos para graficar</p>
          <p className="text-sm text-gray-400">
            Sensores históricos: {activeSensors.length}<br />
            Datos recibidos: {Object.values(historicalData).reduce((sum, arr) => sum + arr.length, 0)}
          </p>
        </div>
      );
    }

    const chartConfig = {
      temperature: {
        color: 'hsl(0, 70%, 50%)',
        label: '°C',
        title: 'Temperatura',
        icon: FiThermometer,
      },
      humidity: {
        color: 'hsl(240, 70%, 50%)',
        label: '%',
        title: 'Humedad',
        icon: FiDroplet,
      },
      wind: {
        color: 'hsl(120, 70%, 50%)',
        label: 'km/h',
        title: 'Velocidad del Viento',
        icon: FiWind,
      }
    };

    const config = chartConfig[activeTab];

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            formatter={(value: number) => {
              if (value === null || value === undefined) {
                return ['Sin dato', 'Valor'];
              }
              return [`${Number(value).toFixed(1)} ${config.label}`, 'Valor'];
            }}
            labelFormatter={(label) => `Hora: ${label}`}
          />
          <Legend />
          {activeSensors.map((sensorName, index) => (
            <Line
              key={sensorName}
              type="monotone"
              dataKey={sensorName}
              name={`${sensorName.toUpperCase()}`}
              stroke={`hsl(${index * 90}, 70%, 50%)`}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={true}
              isAnimationActive={true}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    const tableData = getTableData();
    
    if (tableData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FiDatabase className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos para mostrar</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sensor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Temp (°C)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hum (%)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Viento (km/h)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableData.map((row, index) => (
              <tr key={`${row.sensor}-${row.timestamp}-${row.type}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                  {row.sensor}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {row.time}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {row.temperatura?.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {row.humedad?.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {row.viento?.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    row.type === 'tiempo real' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {row.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tabButtons = [
    { key: 'temperature' as ChartTab, label: 'Temperatura', icon: FiThermometer, color: 'red' },
    { key: 'humidity' as ChartTab, label: 'Humedad', icon: FiDroplet, color: 'blue' },
    { key: 'wind' as ChartTab, label: 'Viento', icon: FiWind, color: 'green' }
  ];

  // Calcular estadísticas
  const combinedData = getCombinedData();
  const totalDataPoints = Object.values(historicalData).reduce((total, sensorData) => total + sensorData.length, 0);
  const tableData = getTableData();

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FiBarChart2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Gráficas de Datos
            </h2>
            <p className="text-sm text-gray-600">
              {Object.keys(historicalData).length} sensores • {totalDataPoints} puntos de datos
            </p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabButtons.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 border ${
                  activeTab === tab.key
                    ? `bg-${tab.color}-500 text-white border-${tab.color}-500 shadow-md`
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:shadow-sm'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Content */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        {renderChart()}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FiActivity className="w-4 h-4 text-blue-600" />
            <div className="font-semibold text-blue-700">Puntos en Gráfica</div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {combinedData.length}
          </div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FiDatabase className="w-4 h-4 text-green-600" />
            <div className="font-semibold text-green-700">Sensores</div>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {Object.keys(historicalData).length}
          </div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FiDatabase className="w-4 h-4 text-purple-600" />
            <div className="font-semibold text-purple-700">Total Datos</div>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {totalDataPoints}
          </div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FiClock className="w-4 h-4 text-orange-600" />
            <div className="font-semibold text-orange-700">Registros</div>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {tableData.length}
          </div>
        </div>
      </div>

      {/* Table Toggle Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => setShowTable(!showTable)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
        >
          <FiList className="w-4 h-4" />
          {showTable ? 'Ocultar Tabla' : 'Mostrar Tabla'}
        </button>
      </div>

      {/* Data Table */}
      {showTable && (
        <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FiDatabase className="w-5 h-5" />
              Datos Almacenados
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {tableData.length} registros • Más recientes primero
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {renderTable()}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <details className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <summary className="cursor-pointer font-medium text-gray-700">
          🔍 Información de Debug
        </summary>
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <div><strong>Sensores:</strong> {Object.keys(historicalData).join(', ')}</div>
          <div><strong>Puntos por sensor:</strong> {Object.entries(historicalData).map(([s, d]) => `${s}:${d.length}`).join(', ')}</div>
          <div><strong>Tab activa:</strong> {activeTab}</div>
          <div><strong>Datos combinados:</strong> {combinedData.length} puntos</div>
        </div>
      </details>
    </div>
  );
};

export default Charts;
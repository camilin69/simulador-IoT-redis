const socket = io();

// Keep up to N points per series
const MAX_POINTS = 50;

function makeChart(ctx, label, yLabel, color) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor: color,
          backgroundColor: color + '33',
          fill: true,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: { display: true, title: { display: false } },
        y: { display: true, title: { display: true, text: yLabel } },
      },
    },
  });
}

const tempChart = makeChart(document.getElementById('tempChart').getContext('2d'), 'Temperatura (°C)', '°C', 'rgb(255,99,132)');
const humChart = makeChart(document.getElementById('humChart').getContext('2d'), 'Humedad (%)', '%', 'rgb(54,162,235)');
const windChart = makeChart(document.getElementById('windChart').getContext('2d'), 'Viento (km/h)', 'km/h', 'rgb(75,192,192)');

const sensorList = document.getElementById('sensorList');
const latestBySensor = {}; // channel -> latest data

function pushPoint(chart, label, value) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

socket.on('sensor-data', (payload) => {
  const { channel, data } = payload;
  const sensorName = channel.split(':').pop();
  const ts = new Date(data.timestamp_utc * 1000);
  const label = ts.toLocaleTimeString();

  if (data.temperatura_c !== undefined && data.temperatura_c !== null) {
    pushPoint(tempChart, label, data.temperatura_c);
  }
  if (data.humedad_porc !== undefined && data.humedad_porc !== null) {
    pushPoint(humChart, label, data.humedad_porc);
  }
  if (data.viento_kmh !== undefined && data.viento_kmh !== null) {
    pushPoint(windChart, label, data.viento_kmh);
  }

  latestBySensor[sensorName] = { ts: label, ...data };
  renderSensorList();
});

function renderSensorList() {
  sensorList.innerHTML = '';
  Object.keys(latestBySensor).forEach((name) => {
    const item = latestBySensor[name];
    const li = document.createElement('li');
    li.innerHTML = `<strong>${name}</strong>: T=${item.temperatura_c ?? 'N/A'}°C, H=${item.humedad_porc ?? 'N/A'}%, V=${item.viento_kmh ?? 'N/A'} km/h <span class="ts">${item.ts}</span>`;
    sensorList.appendChild(li);
  });
}

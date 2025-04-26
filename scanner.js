// scanner.js

feather.replace();

let filter = 'all';
let cacheTimeMinutes = 10;
const localStorageKey = 'aktien_scanner_data';
const jsonURL = 'https://raw.githubusercontent.com/andreasmuthig/aktien-dashboard/main/beobachten_verwalten_liste.json';
let daten = [];

document.addEventListener('DOMContentLoaded', init);

function init() {
  // 1) Buttons binden
  document.querySelectorAll('.filter-buttons button[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
  document.querySelectorAll('.cache-buttons button[data-cache]').forEach(btn => {
    btn.addEventListener('click', () => setCacheTime(parseInt(btn.dataset.cache, 10)));
  });
  document.getElementById('loadButton').addEventListener('click', () => ladeDaten(true));

  // 2) Initiale Button-Stati
  updateButtonStates();

  // 3) Cache anzeigen (falls vorhanden)
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  if (cache.data && cache.data.length) {
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
  }

  // 4) Erste Abfrage
  ladeDaten(false);
}

function updateButtonStates() {
  document.querySelectorAll('.filter-buttons button[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('.cache-buttons button[data-cache]').forEach(btn => {
    btn.classList.toggle('active',
      parseInt(btn.dataset.cache, 10) === cacheTimeMinutes
    );
  });
}

function setFilter(neu) {
  filter = neu;
  updateButtonStates();
  render();
}

function setCacheTime(min) {
  cacheTimeMinutes = min;
  updateButtonStates();
}

async function ladeDaten(force = false) {
  console.log(`ladeDaten(force=${force}) – CacheTime=${cacheTimeMinutes}min`);
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  const now = Date.now();
  const age = cache.timestamp ? (now - cache.timestamp) / 60000 : Infinity;

  // Cache nur verwenden, wenn vollständig gültig und nicht ge-forced
  const cacheValid = Array.isArray(cache.data) &&
    cache.data.every(d => typeof d.kurs === 'number');

  if (!force && cacheValid && age < cacheTimeMinutes) {
    console.log(`Nutze Cache (Alter ${age.toFixed(1)}min)`);
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
    return;
  }

  try {
    console.log('Hole Aktie-Liste von GitHub…');
    const res = await fetch(jsonURL);
    if (!res.ok) throw new Error(`Liste HTTP ${res.status}`);
    const liste = await res.json();

    // Parallel alle Anfragen, mit URL-Encoding
    daten = await Promise.all(liste.map(async aktie => {
      try {
        const symbolEncoded = encodeURIComponent(aktie.symbol);
        const apiUrl = `https://api.twelvedata.com/quote?symbol=${symbolEncoded}&apikey=${API_KEY}`;
        const r = await fetch(apiUrl);
        const j = await r.json();
        if (j.status === 'error' || !j.price) {
          console.warn(`Keine Daten für ${aktie.symbol}`);
          return { ...aktie, kurs: null, veraenderung: null };
        }
        return {
          name: aktie.name,
          symbol: aktie.symbol,
          besitz: aktie.besitz,
          kurs: parseFloat(j.price),
          veraenderung: parseFloat(j.percent_change)
        };
      } catch (e) {
        console.error(`Fehler bei ${aktie.symbol}`, e);
        return { ...aktie, kurs: null, veraenderung: null };
      }
    }));

    // Cache aktualisieren
    localStorage.setItem(localStorageKey, JSON.stringify({
      timestamp: now,
      data: daten
    }));
    console.log('API-Daten geholt und gecached');
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung: ${new Date(now).toLocaleTimeString()}`;
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    document.getElementById('scannerContent').innerHTML =
      '<p style="text-align:center; color:#ff5252;">Fehler beim Laden der Liste.</p>';
  }
}

function render() {
  const c = document.getElementById('scannerContent');
  if (!daten.length) {
    c.innerHTML = '<p style="text-align:center;">Keine Daten verfügbar.</p>';
    return;
  }
  c.innerHTML = daten
    .filter(d => filter === 'all'
      || (filter === 'besitz' && d.besitz)
      || (filter === 'beobachtung' && !d.besitz)
    )
    .map(d => `
      <div class="tile ${d.besitz ? 'green' : 'blue'}">
        <div class="status">${d.besitz ? 'Besitz' : 'Beobachtung'}</div>
        <h3>${d.name}</h3>
        ${d.kurs !== null
          ? `<div class="kurs">Kurs: ${d.kurs.toFixed(2)} USD</div>
             <div class="change ${d.veraenderung < 0 ? 'neg' : ''}">
               Veränderung: ${d.veraenderung.toFixed(2)}%
             </div>`
          : `<div class="kurs">❗ Kursdaten nicht verfügbar</div>`
        }
      </div>`
    ).join('');
}
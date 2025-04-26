// scanner.js

// Ersetze alle Feather-Icons
feather.replace();

let filter = 'all';
let cacheTimeMinutes = 10;
const localStorageKey = 'aktien_scanner_data';
const jsonURL = 'https://raw.githubusercontent.com/andreasmuthig/aktien-dashboard/main/beobachten_verwalten_liste.json';
let daten = [];

// Diese Funktion wird nach DOM ready einmal aufgerufen
function init() {
  // Filter-Buttons binden
  document.querySelectorAll('.filter-buttons button').forEach(btn => {
    const f = btn.dataset.filter;
    if (!f) return;
    btn.addEventListener('click', () => setFilter(f));
  });

  // Cache-Zeit-Buttons binden
  document.querySelectorAll('.cache-buttons button').forEach(btn => {
    const c = btn.dataset.cache;
    if (!c) return;
    btn.addEventListener('click', () => setCacheTime(parseInt(c, 10)));
  });

  // Manuelle Nachladung
  document.getElementById('loadButton').addEventListener('click', ladeDaten);

  // Initiale Button-Marker
  updateButtonStates();

  // Wenn Cache da ist, direkt rendern
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  if (cache.data) {
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
  }

  // Und sofort Daten nachladen
  ladeDaten();
}

// Markiert die aktiven Buttons visuell
function updateButtonStates() {
  document.querySelectorAll('.filter-buttons button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('.cache-buttons button').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.cache,10) === cacheTimeMinutes);
  });
}

// Wechselt den Filter und aktualisiert Kacheln
function setFilter(neu) {
  filter = neu;
  updateButtonStates();
  render();
}

// Setzt die neue Cache-Zeit (in Minuten)
function setCacheTime(min) {
  cacheTimeMinutes = min;
  updateButtonStates();
}

// Lädt Daten mit Cache-Logik
async function ladeDaten() {
  console.log(`ladeDaten(): Cache-Zeit ${cacheTimeMinutes} Minuten`);
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  const jetzt = Date.now();
  const cacheAlter = cache.timestamp ? (jetzt - cache.timestamp) / 60000 : Infinity;

  if (cache.data && cacheAlter < cacheTimeMinutes) {
    console.log(`Verwende Cache (Alter: ${cacheAlter.toFixed(1)} Min)`);
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
    return;
  }

  try {
    console.log('Hole Beobachtungs-Liste von GitHub…');
    const res = await fetch(jsonURL);
    if (!res.ok) throw new Error(`Liste HTTP ${res.status}`);
    const beobachteteAktien = await res.json();

    // Parallel alle Kurse abfragen
    daten = await Promise.all(beobachteteAktien.map(async aktie => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${aktie.symbol}&apikey=${API_KEY}`;
        const r = await fetch(url);
        const json = await r.json();
        if (json.status === 'error' || !json.price) {
          console.warn(`Keine Daten für ${aktie.symbol}`);
          return { ...aktie, kurs: null, veraenderung: null };
        }
        return {
          name: aktie.name,
          symbol: aktie.symbol,
          besitz: aktie.besitz,
          kurs: parseFloat(json.price),
          veraenderung: parseFloat(json.percent_change)
        };
      } catch(err) {
        console.error(`Fehler bei ${aktie.symbol}:`, err);
        return { ...aktie, kurs: null, veraenderung: null };
      }
    }));

    // In Cache speichern
    localStorage.setItem(localStorageKey, JSON.stringify({
      timestamp: jetzt,
      data: daten
    }));

    console.log('API-Daten geladen und gecached.');
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung: ${new Date(jetzt).toLocaleTimeString()}`;

  } catch (err) {
    console.error('Fehler beim Laden der Liste:', err);
    document.getElementById('scannerContent').innerHTML =
      '<p style="text-align:center;">Fehler beim Laden der Aktienliste.</p>';
  }
}

// Rendert die Kacheln basierend auf Filter und Daten
function render() {
  const container = document.getElementById('scannerContent');
  if (!daten.length) {
    container.innerHTML = '<p style="text-align:center;">Keine Daten verfügbar.</p>';
    return;
  }
  container.innerHTML = daten
    .filter(d => filter === 'all' || (filter === 'besitz' && d.besitz) || (filter === 'beobachtung' && !d.besitz))
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

// Starte das Ganze, sobald DOM bereit ist
document.addEventListener('DOMContentLoaded', init);
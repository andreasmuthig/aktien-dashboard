// scanner.js

feather.replace();

let filter = 'all';
let cacheTimeMinutes = 10; // Standard auf 10 Minuten
const localStorageKey = 'aktien_scanner_data';
const apiKey = 'DEIN_API_KEY'; // <-- Deinen TwelveData API Key hier einsetzen
const jsonURL = 'https://raw.githubusercontent.com/andreasmuthig/aktien-dashboard/main/beobachten_verwalten_liste.json';
let daten = [];

document.getElementById('loadButton').addEventListener('click', ladeDaten);

function setFilter(neu) {
  filter = neu;
  document.querySelectorAll('.filter-buttons button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.filter-buttons button[onclick*="${neu}"]`).classList.add('active');
  render();
}

function setCacheTime(min) {
  cacheTimeMinutes = min;
  document.querySelectorAll('.cache-buttons button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.cache-buttons button[onclick*="${min}"]`).classList.add('active');
}

// Daten laden mit Cache-Check
async function ladeDaten() {
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};

  const jetzt = Date.now();
  const cacheAlter = cache.timestamp ? (jetzt - cache.timestamp) / 60000 : Infinity;

  if (cache.data && cacheAlter < cacheTimeMinutes) {
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent = 'Letzte Aktualisierung (Cache): ' + new Date(cache.timestamp).toLocaleTimeString();
    return;
  }

  try {
    const res = await fetch(jsonURL);
    const beobachteteAktien = await res.json();

    daten = await Promise.all(beobachteteAktien.map(async aktie => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${aktie.symbol}&apikey=${apiKey}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.status === 'error' || !json.price) throw new Error('Ungültige Daten');

        return {
          name: aktie.name,
          symbol: aktie.symbol,
          besitz: aktie.besitz,
          kurs: parseFloat(json.price),
          veraenderung: parseFloat(json.percent_change)
        };
      } catch (error) {
        console.error('Fehler bei', aktie.symbol, error);
        return null;
      }
    }));

    daten = daten.filter(d => d !== null);

    // Daten und Zeitstempel speichern
    localStorage.setItem(localStorageKey, JSON.stringify({
      timestamp: jetzt,
      data: daten
    }));

    render();
    document.getElementById('lastUpdate').textContent = 'Letzte Aktualisierung: ' + new Date(jetzt).toLocaleTimeString();

  } catch (error) {
    console.error('Fehler beim Laden der Aktienliste:', error);
    document.getElementById('scannerContent').innerHTML = '<p style="text-align:center;">Fehler beim Laden der Aktienliste.</p>';
  }
}

// Anzeige aufbauen
function render() {
  const container = document.getElementById('scannerContent');
  if (daten.length === 0) {
    container.innerHTML = '<p style="text-align:center;">Keine Daten verfügbar.</p>';
    return;
  }

  container.innerHTML = daten
    .filter(d => filter === 'all' || (filter === 'besitz' && d.besitz) || (filter === 'beobachtung' && !d.besitz))
    .map(d => `
      <div class="tile ${d.besitz ? 'green' : 'blue'}">
        <div class="status">${d.besitz ? 'Besitz' : 'Beobachtung'}</div>
        <h3>${d.name}</h3>
        <div class="kurs">Kurs: ${d.kurs.toFixed(2)} USD</div>
        <div class="change ${d.veraenderung < 0 ? 'neg' : ''}">Veränderung: ${d.veraenderung.toFixed(2)}%</div>
      </div>
    `)
    .join('');
}

// Beim ersten Laden schauen, ob Cache da ist
window.onload = () => {
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  if (cache.data) {
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent = 'Letzte Aktualisierung (Cache): ' + new Date(cache.timestamp).toLocaleTimeString();
  }
};
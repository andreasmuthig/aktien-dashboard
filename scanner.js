// scanner.js

feather.replace();

let filter = 'all';
let cacheTimeMinutes = 10;
const localStorageKey = 'aktien_scanner_data';
const jsonURL = 'https://raw.githubusercontent.com/andreasmuthig/aktien-dashboard/main/beobachten_verwalten_liste.json';
let daten = [];

// Event-Bindings erst nach DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Filter-Buttons
  document.querySelectorAll('.filter-buttons button[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.filter);
    });
  });
  // Cache-Zeit-Buttons
  document.querySelectorAll('.cache-buttons button[data-cache]').forEach(btn => {
    btn.addEventListener('click', () => {
      setCacheTime(parseInt(btn.dataset.cache, 10));
    });
  });
  // Manueller Refresh
  document.getElementById('loadButton').addEventListener('click', () => ladeDaten(true));
  // Initiale Button-Markierung
  updateButtonStates();
  // Wenn schon Cache da ist, sofort anzeigen
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  if (cache.data && cache.data.length) {
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
  }
  // und direkt loslegen (ohne Force liefert evtl. Cache, falls sauber)
  ladeDaten(false);
});

function updateButtonStates() {
  document.querySelectorAll('.filter-buttons button[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('.cache-buttons button[data-cache]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.cache,10) === cacheTimeMinutes);
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

// Lade Daten, force=true um Cache zu umgehen
async function ladeDaten(force = false) {
  console.log(`ladeDaten(force=${force}) – Cache-Zeit: ${cacheTimeMinutes} Min`);
  const cache = JSON.parse(localStorage.getItem(localStorageKey)) || {};
  const jetzt = Date.now();
  const cacheAlter = cache.timestamp ? (jetzt - cache.timestamp) / 60000 : Infinity;

  // Prüfe, ob Cache vollständig gültig ist
  const cacheVollstaendig = Array.isArray(cache.data) &&
    cache.data.length > 0 &&
    cache.data.every(d => typeof d.kurs === 'number' && !isNaN(d.kurs));

  if (!force && cacheVollstaendig && cacheAlter < cacheTimeMinutes) {
    console.log(`Verwende gültigen Cache (Alter: ${cacheAlter.toFixed(1)} Min)`);
    daten = cache.data;
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung (Cache): ${new Date(cache.timestamp).toLocaleTimeString()}`;
    return;
  }

  try {
    console.log('Hole Beobachtungs-Liste…');
    const res = await fetch(jsonURL);
    if (!res.ok) throw new Error(`Liste HTTP ${res.status}`);
    const liste = await res.json();

    daten = await Promise.all(liste.map(async aktie => {
      try {
        const r = await fetch(
          `https://api.twelvedata.com/quote?symbol=${aktie.symbol}&apikey=${API_KEY}`
        );
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
        console.error(`Fehler bei ${aktie.symbol}:`, e);
        return { ...aktie, kurs: null, veraenderung: null };
      }
    }));

    // Cache aktualisieren
    localStorage.setItem(localStorageKey, JSON.stringify({
      timestamp: jetzt,
      data: daten
    }));
    console.log('API-Daten geholt und gecached');
    render();
    document.getElementById('lastUpdate').textContent =
      `Letzte Aktualisierung: ${new Date(jetzt).toLocaleTimeString()}`;
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    document.getElementById('scannerContent').innerHTML =
      '<p style="text-align:center; color:#ff5252;">Fehler beim Laden der Aktienliste.</p>';
  }
}

function render() {
  const container = document.getElementById('scannerContent');
  if (!daten.length) {
    container.innerHTML = '<p style="text-align:center;">Keine Daten verfügbar.</p>';
    return;
  }
  container.innerHTML = daten
    .filter(d => filter === 'all' ||
      (filter === 'besitz' && d.besitz) ||
      (filter === 'beobachtung' && !d.besitz)
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
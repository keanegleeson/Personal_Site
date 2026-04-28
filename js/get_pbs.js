// PBs are refreshed daily by .github/workflows/update-pbs.yml, which runs
// scripts/fetch_pbs.py and commits data/pbs.json. The frontend just reads
// that static file — no runtime Garmin auth, no Vercel function, no rate limits.

const PB_DATA_URL = 'data/pbs.json';
const PB_CACHE_KEY = 'running_pbs_cache';

function renderPBs(data) {
  const fields = [
    { id: 'milePB',     key: 'mile',     label: 'Mile' },
    { id: 'fiveKPB',    key: '5k',       label: '5K' },
    { id: 'tenKPB',     key: '10k',      label: '10K' },
    { id: 'halfPB',     key: 'half',     label: 'Half' },
    { id: 'marathonPB', key: 'marathon', label: 'Marathon' },
  ];

  fields.forEach(({ id, key, label }) => {
    const el = document.getElementById(id);
    if (el && data[key]) el.innerText = `${label}: ${data[key]}`;
  });
}

function getCachedPBs() {
  try {
    const raw = localStorage.getItem(PB_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cachePBs(data) {
  try {
    localStorage.setItem(PB_CACHE_KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

// Cache-bust so a new commit is picked up immediately instead of stale CDN cache.
fetch(`${PB_DATA_URL}?t=${Date.now()}`, { cache: 'no-cache' })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(data => {
    cachePBs(data);
    renderPBs(data);
  })
  .catch(() => {
    const cached = getCachedPBs();
    if (cached) renderPBs(cached);
  });

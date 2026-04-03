const PB_API_URL = 'https://personal-site-api-woad.vercel.app/api/running-pbs';
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

fetch(PB_API_URL)
  .then(response => response.json())
  .then(data => {
    if (!data.cached) {
      cachePBs(data);
    }

    const hasRealValues = ['mile', '5k', '10k', 'half', 'marathon']
      .some(k => data[k] && data[k] !== '--:--');

    if (hasRealValues) {
      renderPBs(data);
    } else {
      const cached = getCachedPBs();
      if (cached) renderPBs(cached);
      else        renderPBs(data);
    }
  })
  .catch(() => {
    const cached = getCachedPBs();
    if (cached) {
      renderPBs(cached);
    }
  });

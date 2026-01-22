// Fetch Running Personal Bests from Vercel serverless function
// Note: Update this URL after deploying to Vercel
const PB_API_URL = '/api/running-pbs';

fetch(PB_API_URL)
  .then(response => response.json())
  .then(data => {
    // Populate the spans with PB data
    if (data.mile) {
      document.getElementById('milePB').innerText = `Mile: ${data.mile}`;
    }
    if (data['5k']) {
      document.getElementById('fiveKPB').innerText = `5K: ${data['5k']}`;
    }
    if (data['10k']) {
      document.getElementById('tenKPB').innerText = `10K: ${data['10k']}`;
    }
    if (data.half) {
      document.getElementById('halfPB').innerText = `Half: ${data.half}`;
    }
    if (data.marathon) {
      document.getElementById('marathonPB').innerText = `Marathon: ${data.marathon}`;
    }
  })
  .catch(error => {
    console.error('Error fetching running PBs:', error);
    // Set fallback text on error
    const fallback = '--:--';
    const elements = ['milePB', 'fiveKPB', 'tenKPB', 'halfPB', 'marathonPB'];
    const labels = ['Mile', '5K', '10K', 'Half', 'Marathon'];
    elements.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.innerText = `${labels[i]}: ${fallback}`;
    });
  });

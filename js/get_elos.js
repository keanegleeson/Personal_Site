    // Fetch Rapid ELO
    fetch('https://lichess.org/api/account', {
      headers: {
        'Authorization': 'Bearer lip_NRPAb8yYMWPFjgst8u6m'
      }
    })
    .then(response => response.json())
    .then(data => {
      const rapidElo = data.perfs.rapid.rating;
      document.getElementById('rapidElo').innerText = `Rapid ELO: ${rapidElo}`;
    })
    .catch(error => console.error(error));

    // Fetch Blitz ELO
    fetch('https://lichess.org/api/account', {
      headers: {
        'Authorization': 'Bearer lip_NRPAb8yYMWPFjgst8u6m'
      }
    })
    .then(response => response.json())
    .then(data => {
      const blitzElo = data.perfs.blitz.rating;
      document.getElementById('blitzElo').innerText = `Blitz ELO: ${blitzElo}`;
    })
    .catch(error => console.error(error));
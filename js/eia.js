// EIA API v2 – Electricity RTO Region Demand Data
// Docs: https://www.eia.gov/opendata/documentation.php

const API_KEY = "9efbf856649057f0dc4c8269b27d938c";

const REGIONS = [
    { code: "CAL",  name: "California (CAL)" },
    { code: "CAR",  name: "Carolinas (CAR)" },
    { code: "CENT", name: "Central (CENT)" },
    { code: "FLA",  name: "Florida (FLA)" },
    { code: "MIDA", name: "Mid-Atlantic (MIDA)" },
    { code: "MIDW", name: "Midwest (MIDW)" },
    { code: "NE",   name: "New England (NE)" },
    { code: "NY",   name: "New York (NY)" },
    { code: "NW",   name: "Northwest (NW)" },
    { code: "SE",   name: "Southeast (SE)" },
    { code: "SW",   name: "Southwest (SW)" },
    { code: "TEN",  name: "Tennessee (TEN)" },
    { code: "TEX",  name: "Texas (TEX)" }
];

// Build a v2 API URL for a given region code.
// Always fetches hourly data; aggregation to monthly/annual is done client-side.
function buildApiUrl(regionCode) {
    return "https://api.eia.gov/v2/electricity/rto/region-data/data/"
        + "?api_key=" + API_KEY
        + "&frequency=hourly"
        + "&data[0]=value"
        + "&facets[respondent][]=" + regionCode
        + "&facets[type][]=D"
        + "&sort[0][column]=period"
        + "&sort[0][direction]=desc"
        + "&offset=0"
        + "&length=5000";
}

function getTimeUnit() {
    var time = document.getElementById("time");
    return time.value; // "Hourly", "Monthly", or "Annual"
}

// Returns the selected region code and updates the page heading.
function getRegion() {
    var region = document.getElementById("region");
    var regionCode = region.value;
    var regionText = region.options[region.selectedIndex].text;
    var timeText = getTimeUnit();

    // Strip the parenthetical code suffix, e.g. "California (CAL)" → "California"
    var displayName = regionText.replace(/\s*\([^)]*\)\s*$/, "");

    var h1 = document.getElementsByTagName("h1")[0];
    h1.innerHTML = displayName + " Generation (MWh) - " + timeText;

    return regionCode;
}

function showError(msg) {
    var el = document.getElementById("api-error");
    if (el) {
        el.innerHTML = "<strong>Data Unavailable:</strong> " + msg;
        el.style.display = "block";
    }
}

function hideError() {
    var el = document.getElementById("api-error");
    if (el) el.style.display = "none";
}

let getEIA = async () => {
    const regionCode = getRegion();
    const timeUnit = getTimeUnit();
    const url = buildApiUrl(regionCode);
    console.log("EIA v2 request:", url);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("The server responded with status " + response.status);
    }

    const apiData = await response.json();
    const series = apiData.response && apiData.response.data;

    if (!series || series.length === 0) {
        throw new Error("No data returned from the EIA API.");
    }

    console.log("Received", series.length, "data points");

    const xlabelsTemp = [];
    const yValuesTemp = [];

    for (let i = 0; i < series.length; i++) {
        const period = series[i].period;       // e.g. "2024-01-15T05"
        const rawValue = series[i].value;       // v2 may return strings or nulls
        const value = parseFloat(rawValue);

        if (isNaN(value)) continue; // skip null / missing values

        // Parse period components
        const year  = period.slice(0, 4);
        const month = period.slice(5, 7);
        const day   = period.slice(8, 10);
        const hour  = period.length > 10 ? period.slice(11, 13) : "00";

        if (timeUnit === "Annual") {
            xlabelsTemp.push(year);
            yValuesTemp.push(value);
        } else if (timeUnit === "Monthly") {
            xlabelsTemp.push(year + "-" + month);
            yValuesTemp.push(value);
        } else {
            // Hourly (default)
            xlabelsTemp.push(year + "-" + month + "-" + day + " " + hour + ":00");
            yValuesTemp.push(value);
        }
    }

    // API returns newest-first; reverse so time flows left → right on the chart
    xlabelsTemp.reverse();
    yValuesTemp.reverse();

    // Aggregate duplicate labels (collapses hourly data into monthly/annual sums)
    var object = { date: xlabelsTemp, value: yValuesTemp };

    const condensedObject = {};
    condensedObject.date = [...new Set(object.date)];
    condensedObject.value = [];

    var counts = {};
    object.date.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });

    const sumValues = (acc, cur) => acc + cur;

    for (const [key, count] of Object.entries(counts)) {
        const aggr = object.value.splice(0, count).reduce(sumValues);
        condensedObject.value.push(aggr);
    }

    return { xlabels: condensedObject.date, yValues: condensedObject.value };
};

// Keep a reference so we can destroy the old chart before creating a new one
let currentChart = null;

async function chartIt() {
    hideError();
    var loadingEl = document.getElementById("chart-loading");
    var canvasEl = document.getElementById("chart");

    // Show spinner, hide canvas while loading
    if (loadingEl) loadingEl.style.display = "block";
    canvasEl.style.display = "none";

    try {
        const data = await getEIA();
        const ctx = canvasEl.getContext("2d");

        if (currentChart) {
            currentChart.destroy();
        }

        currentChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: data.xlabels,
                datasets: [{
                    label: "Demand (MWh)",
                    data: data.yValues,
                    backgroundColor: "rgba(255, 99, 132, 0.2)",
                    borderColor: "rgba(255, 99, 132, 1)",
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: { beginAtZero: true }
                    }]
                }
            },
            plugins: {
                zoom: {
                    pan:  { enabled: true, mode: "xy" },
                    zoom: { enabled: true, mode: "xy" }
                }
            }
        });

        // Data loaded — hide spinner, show chart
        if (loadingEl) loadingEl.style.display = "none";
        canvasEl.style.display = "block";
    } catch (err) {
        console.error("EIA API error:", err);
        if (loadingEl) loadingEl.style.display = "none";
        showError(
            "Unable to load EIA electricity data at this time. "
            + "The page is under maintenance &mdash; please check back later."
        );
    }
}

// Populate the region dropdown and load the initial chart
window.onload = function () {
    var select = document.getElementById("region");
    var optionsHtml = [];

    for (var i = 0; i < REGIONS.length; i++) {
        var r = REGIONS[i];
        optionsHtml.push('<option value="' + r.code + '">' + r.name + '</option>');
    }

    select.insertAdjacentHTML("beforeEnd", optionsHtml.join("\n"));
    chartIt();
};

function handleOnChange() {
    chartIt();
}

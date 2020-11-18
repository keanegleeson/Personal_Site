// this script populates the regions dropdown (I should probably get even more clever with this and have it scrape the region names at the url and populate it that way) code to scrape region names from the console is somewhere in the eia.js file
function getTimeUnit() {
    var time = document.getElementById("time");
    var timeValue = time.value;
    // console.log(timeValue);
    return timeValue;
}

function getRegion() {
    var region = document.getElementById("region");
    var regionValue = region.value;
    var regionText = region.options[region.selectedIndex].text;
    var timeText = getTimeUnit();
    // console.log(regionText);
    // console.log(regionValue);
    var h1String = document.getElementsByTagName("h1")[0];
    h1String.innerHTML = `${regionText.slice(0, -5)} Generation (MWh) - ${timeText}`;
    return regionValue;
}

let getEIA = async () => {
    const xlabelsTemp = [];
    const yValuesTemp = [];
    const url = await getRegion();
    const timeUnit = await getTimeUnit();
    console.log(url);
    const response = await fetch(url);
    const api_data = await response.json();
    const series = api_data.series[0].data;
    // console.log(series);
    const rows = series?.length; //? optional chaining - checks if series exists
    // series ? series.length: null; 
    // const table = [];
    for (i = 0; i < rows; i++) {
        //Getting date field into a better date format
        const rawDate = series[i][0];
        const year = rawDate.slice(0, 4);
        // console.log(year);
        const month = rawDate.slice(5, 6);
        const day = rawDate.slice(7, 8);
        const hour = rawDate.slice(10, 11);
        const formattedDate = year.concat('-', month, '-', day, ' ', hour, ':00');
        // console.log(formattedDate);
        // xlabels.push(series[i][0]);
        // xlabelsTemp.push(formattedDate);
        // yValues.push(series[i][1]);

        if (timeUnit === 'Annual') {
            yValuesTemp.push(series[i][1]);
            xlabelsTemp.push(year);
        } else if (timeUnit === 'Monthly') {
            yValuesTemp.push(series[i][1]);
            xlabelsTemp.push(year.concat('-', month));
        } else {
            xlabelsTemp.push(formattedDate);
            yValuesTemp.push(series[i][1]);
        }

    }
    // Arrays were sorted in order of newest observations to oldest, for the purpose of the chart, I want to reverse and show time progressing left to right
    const xlabelsTemp2 = xlabelsTemp.reverse();
    const yValuesTemp2 = yValuesTemp.reverse();

    var object = {};
    object.date = xlabelsTemp2;
    object.value = yValuesTemp2;

    // console.log(object);

    //The code from here to ~ line 112 aggrtegates the data into monthly and annual values 

    //get object of arrays

    //slice out distinct number

    //reduce


    //Setting object with array of unique dates
    const condensedObject = {};
    condensedObject.date = [... new Set(object.date)];
    condensedObject.value = [];
    // console.log(condensedObject);

    //counts gets the number of observations for each yea
    //x is the key (counts[x] is value)
    var counts = {};
    object.date.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });

    // console.log(counts);


    // console.log(object.value.splice(0,counts["2015"]));

    const sumValues = (accumulator, currentValue) => accumulator + currentValue;

    //test sum - COMMENT OUT WHEN RUNNING LOOP BELOW
    // const testSum = object.value.splice(0,counts["2016"]).reduce(sumValues);

    // console.log(testSum);

    //get all values from counts
        //do sumValues and splice operation
        //add to condensedObject.values

    
    // console.log(object.value.length);

    for (const [key, value] of Object.entries(counts)) {
        const aggr = object.value.splice(0,value).reduce(sumValues);
        // console.log(aggr);
        condensedObject.value.push(aggr);
    }

    // console.log(condensedObject.date,condensedObject.value);

    let xlabels = condensedObject.date;
    let yValues = condensedObject.value;
    // console.log(testSum);


    //get first n out of yValues and sum
        //e.g. pull 4000 for 2015 and sum as first value 

    






    // console.log(xlabels, yValues);
    // console.log(object);
    return { xlabels, yValues };

}

async function chartIt() {
    const ctx = document.getElementById('chart').getContext('2d');
    const data = await getEIA();


    const myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.xlabels,
            datasets: [{
                label: 'Net Interchange (MWh)',
                data: data.yValues,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }

        },
        //plugins for zoom feature not working right now 10.25
        plugins: {
            zoom: {
                // Container for pan options
                pan: {
                    // Boolean to enable panning
                    enabled: true,

                    // Panning directions. Remove the appropriate direction to disable
                    // Eg. 'y' would only allow panning in the y direction
                    mode: "xy"
                },

                // Container for zoom options
                zoom: {
                    // Boolean to enable zooming
                    enabled: true,

                    // Zooming directions. Remove the appropriate direction to disable
                    // Eg. 'y' would only allow zooming in the y direction
                    mode: "xy"
                }
            }
        }
    });
}

//everything above might be deleted, trying to see how this works if everythin is in the same js file
window.onload = function () {
    const regions = ["California (CAL)", "Carolinas (CAR)", "Central (CENT)", "Florida (FLA)", "Mid-Atlantic (MIDA)", "Midwest (MIDW)", "New England (NE)", "New York (NY)", "Northwest (NW)", "Southeast (SE)", "Southwest (SW)", "Tennessee (TEN)", "Texas (TEX)"];
    //just pasting urls here for now, might make a function pass through to generate this array, but I'm worried it'll slow down my app
    const urls = ["https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.CAL-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.CAR-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.CENT-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.FLA-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.MIDA-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.MIDW-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.NE-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.NY-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.NW-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.SE-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.SW-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.TEN-ALL.D.H", "https://api.eia.gov/series/?api_key=9efbf856649057f0dc4c8269b27d938c&series_id=EBA.TEX-ALL.D.H"];
    var select = document.getElementById("region");
    var options = [];
    var option = document.createElement('option');
    // chartIt();
    const datasets = urls?.length;
    // console.log(datasets);
    for (i = 0; i < datasets; i++) {
        // option.text = option.value = i;
        option.text = regions[i];
        option.value = urls[i];
        options.push(option.outerHTML);
    };
    select.insertAdjacentHTML('beforeEnd', options.join('\n'));
    chartIt();
}

function handleOnChange() {
    chartIt();
}

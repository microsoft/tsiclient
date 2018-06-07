/******* MAP  */
var environmentFqdn = '01a94e6c-6d32-4f8c-8511-1058fe2b1dbd.env.timeseries.azure.com';
var tsiClient = new window.TsiClient();
var subscriptionKey = "hAhPQr70Ez7LsuM4O8EVODL9OKnQms-o_dm1s740Qus";
var map = new atlas.Map("windmillMap", {
    "subscription-key": subscriptionKey,
    center: [-113.449080, 49.548559],
    zoom: 4
});

var looper;
var rpmspeed = 0;
var degrees = 0;
rotateAnimation("img1");

function choose(lat, lon, zoomlevel){
    user = lat;
    map.setCamera({zoom: zoomlevel, center: [lon, lat]});
}

// Real time values for process graphic
var currentValuesInterval;
function getCurrentValues(windmillName, plantName){    
    clearInterval(currentValuesInterval);

    var getValues = function(){
        var aggregateExpressions = [];
        var endDate = new Date((new Date()).valueOf() - 1000*60*5);
        var startDate = new Date(endDate.valueOf() - 1000*60);
        aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND [UNIT].String = '" + windmillName + "' AND 'CNC01-CS001'"}, {property: 'VALUE', type: "Double"}, ['last'],
            { from: startDate, to: endDate, bucketSize: '10m' }, null, 'red', 'AmbientWindSpeed'));
        aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND [UNIT].String = '" + windmillName + "' AND 'MDA01-CS001'"}, {property: 'VALUE', type: "Double"}, ['last'],
            { from: startDate, to: endDate, bucketSize: '10m' }, null, 'red', 'RotorRpm'));    
        aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND [UNIT].String = '" + windmillName + "' AND ('BAT01-CE300' OR 'MKA01-CE302')"}, {property: 'VALUE', type: "Double"}, ['last'],
            { from: startDate, to: endDate, bucketSize: '10m' }, null, 'red', 'GridPower'));    
        authContext.getTsiToken().then(function(token){
            tsiClient.server.getAggregates(token, environmentFqdn, aggregateExpressions.map(function(ae){return ae.toTsx()})).then(function(result){
                var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, aggregateExpressions);
                transformedResult.forEach(function(tr, i) {
                    var ae = tr[Object.keys(tr)[0]];
                    var sb = ae[Object.keys(ae)[0]];
                    var last = sb[Object.keys(sb)[0]] ? sb[Object.keys(sb)[0]].last : 'N/A';
                    var className = (i == 0 ? 'wsv' : (i == 1 ? 'rsv' : 'gpv'));
                    document.getElementsByClassName(className)[0].classList.toggle('new');
                    document.getElementsByClassName(className)[0].innerText = last;
                    setTimeout(function(){
                    document.getElementsByClassName(className)[0].classList.toggle('new');
                    }, 500);
                })
            });    
            rpmspeed = document.getElementsByClassName("measurementValue rsv")[0].innerHTML;
        });
    }
    getValues();
    currentValuesInterval = setInterval(getValues, 5000);
}

// Bar chart for overall production
function getOverallBarChart(){
    var contextMenuActions = [{
        name: 'Explore windmill', 
        action: function(ae, splitBy, timestamp) {
            explore(splitBy);
        }        
    }]    
    var endDate = new Date(Math.floor((new Date()).valueOf()/(1000*60*60*24))*(1000*60*60*24));
    var startDate = new Date(endDate.valueOf() - 1000*60*60*24*7);
    var aggregateExpressions = [];
    aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "DSCR HAS 'Grid Power'"}, {property: 'VALUE', type: "Double"}, ['sum'],
        { from: startDate, to: endDate, bucketSize: '1d' }, {property: 'UNIT', type: 'String'}, 'teal', 'GridPower', contextMenuActions));
    authContext.getTsiToken().then(function(token){
        tsiClient.server.getAggregates(token, environmentFqdn, aggregateExpressions.map(function(ae){return ae.toTsx()})).then(function(result){
            var barChart = new tsiClient.ux.BarChart(document.getElementById('chart0'));
            var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, aggregateExpressions);
            barChart.render(transformedResult, {legend: 'hidden', zeroYAxis: true, keepSplitByColor: true, tooltip: true}, aggregateExpressions);
        });    
    });
}
getOverallBarChart();

// Ambient values and output line charts
var lineChart1 = new tsiClient.ux.LineChart(document.getElementById('chart2'));
var lineChart2 = new tsiClient.ux.LineChart(document.getElementById('chart3'));
function getAmbientAndOutput(windmillName, plantName){    
    var endDate = new Date((new Date()).valueOf());
    var startDate = new Date(endDate.valueOf() - 1000*60*60*24);
    var aggregateExpressions = [];
    aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND [UNIT].String = '" + windmillName + "' AND ('CNC01-CG001' OR 'MDL01-CG001')"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'pink', 'WindDirection'));
    aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND [UNIT].String = '" + windmillName + "' AND 'CNC01-CS001'"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'teal', 'WindSpeed'));
    aggregateExpressions.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND '" + windmillName + "' AND 'CNC01-CT001'"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'orange', 'Temperature'));
    authContext.getTsiToken().then(function(token){
        tsiClient.server.getAggregates(token, environmentFqdn, aggregateExpressions.map(function(ae){return ae.toTsx()})).then(function(result){
            var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, aggregateExpressions);
            lineChart1.render(transformedResult, {legend: 'compact', yAxisState: 'overlap'}, aggregateExpressions);
        });    
    });

    var aggregateExpressions2 = [];
    aggregateExpressions2.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND '" + windmillName + "GridFrequency' OR 'MKA01-CE500'"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'pink', 'GridFrequency'));
    aggregateExpressions2.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND '" + windmillName + "BAT01-CE300' OR 'MKA01-CE302'"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'teal', 'GridPower'));
    aggregateExpressions2.push(new tsiClient.ux.AggregateExpression({predicateString: "[PLANT].String = '" + plantName + "' AND '" + windmillName + "BAT01-CE901' OR 'CE310'"}, {property: 'VALUE', type: "Double"}, ['avg'],
        { from: startDate, to: endDate, bucketSize: '20m' }, null, 'orange', 'GridPossiblePower'));
    authContext.getTsiToken().then(function(token){
        tsiClient.server.getAggregates(token, environmentFqdn, aggregateExpressions2.map(function(ae){return ae.toTsx()})).then(function(result){
            var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, aggregateExpressions2);
            var lineChart = new tsiClient.ux.LineChart(document.getElementById('chart3'));
            lineChart2.render(transformedResult, {legend: 'compact'}, aggregateExpressions2);
        });    
    });
}

var windmillLayer = "windmill-pins";
var windmillPins = [];
var windmillPopup = new atlas.Popup();


function buildPins (windmills) {
    var windmillPins = [];
    windmills.forEach(function (windmill) {
        var feature = new atlas.data.Feature(new atlas.data.Point([windmill.Long, windmill.Lat]), {
            "name": windmill.UNIT,
            "plant": windmill.PLANT,
            "predicateLabel": "show me stats for this windmill",
            "predicateAction" : ""
        });
        windmillPins.push(feature);
    });
    return windmillPins;
}

// draw pins
map.addEventListener("load", function () {
    var img = new Image(40,40)
    img.src = "data:image/png;base64,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";
    img.onload = function(){
        authContext.getTsiToken().then(function(token){
            this.tsiClient.server.getReferenceDatasetRows(token, environmentFqdn, 'WindmillLocations').then(function(rows){
                var latLongRows = itemsToRows(rows);
                var windmillPins = buildPins(latLongRows);
                map.addIcon("myIcon", img);
                map.addPins(windmillPins, {
                    name: windmillLayer,
                    cluster: false,
                    icon: "myIcon"
                });
            });
        });
    }
})

function explore(windmillName, plantName){
    document.getElementById("windmillCharts1").style.display = "block"
    document.getElementById("windmillCharts2").style.display = "block"
    getCurrentValues(windmillName, plantName);
    getAmbientAndOutput(windmillName, plantName);
    document.getElementById("windmillTitle").innerHTML = "Turbine: " + plantName + " / " + windmillName;  
    windmillPopup.close();
    var url = 'https://insights.timeseries.azure.com/?environmentId=01a94e6c-6d32-4f8c-8511-1058fe2b1dbd&relativeMillis=86400000&timeBucketUnit=Minutes&timeBucketSize=20&multiChartStack=false&multiChartSameScale=true&timeSeriesDefinitions=[{%20%22name%22%20:%20%22GridFrequency%22,%20%22measureName%22%20:%20%22Value.Value%22,%20%22predicate%22%20:%20%22%27Ardenville.'+windmillName+'.Grid.Frequency%27%22%20},%20{%20%22name%22%20:%20%22GridPower%22,%20%22measureName%22%20:%20%22Value.Value%22,%20%22predicate%22%20:%20%22%27Ardenville.'+windmillName+'.Grid.Power%27%22%20},%20{%20%22name%22%20:%20%22GridPossiblePower%22,%20%22measureName%22%20:%20%22Value.Value%22,%20%22predicate%22%20:%20%22%27Ardenville.'+windmillName+'.Grid.PossiblePower%27%22%20}%20]'
    document.getElementById('tsilink').href = url;
}

function buildPopupContent(properties) {
    var poiTitleBox = document.createElement("div");
    poiTitleBox.classList.add("poi-title-box", "font-segoeui-b");
    poiTitleBox.innerText = "Explore " + properties.name;
    
    poiTitleBox.addEventListener("click", function (event) {
        explore(properties.name, properties.plant);
    });

    var poiContentBox = document.createElement("div");
    poiContentBox.classList.add("poi-content-box");
    poiContentBox.appendChild(poiTitleBox);
    return poiContentBox;
}

map.addEventListener("click", windmillLayer, function (event) {
    var pin = event.features[0];

    $.ajax({
        url: 'https://api.openweathermap.org/data/2.5/weather?APPID=8469ec6ccdf666e7ae677274cfdd57bc',
        jsonp: 'callback',
        dataType: 'jsonp',
        cache: false,
        data: {
          lat: pin.geometry.coordinates[1],
          lon: pin.geometry.coordinates[0],
          units: 'metric'
        },
        // work with the response
        success: function (response) {
          document.getElementById("windmillWeather").innerHTML = "<div>Current conditions</div>" + '<img class="icon" src="https://openweathermap.org/img/w/' + response.weather[0].icon + '.png' + '"><span>' + response.weather[0].main + ", Temp: " + response.main.temp + "'c, Wind: " + response.wind.speed + " (m/s)</span>";
        },
      });

      $.ajax({
        url: 'https://api.openweathermap.org/data/2.5/forecast?APPID=8469ec6ccdf666e7ae677274cfdd57bc&cnt=1',
        jsonp: 'callback',
        dataType: 'jsonp',
        cache: false,
        data: {
          lat: pin.geometry.coordinates[1],
          lon: pin.geometry.coordinates[0],
          units: 'metric'
        },
        // work with the response
        success: function (response) {
          document.getElementById("windmillWeatherForecast").innerHTML = "<div>Weather in 3 hours</div>" + '<img class="icon" src="https://openweathermap.org/img/w/' + response.list[0].weather[0].icon + '.png' + '"><span>' + response.list[0].weather[0].main + ", Temp: " + response.list[0].main.temp + "'c, Wind: " + response.list[0].wind.speed + " (m/s)</span>";
        },
      });

    windmillPopup.setPopupOptions({
        position: pin.geometry.coordinates,
        content: buildPopupContent({
            name: pin.properties.name,
            plant: pin.properties.plant,
            predicateLabel: pin.properties.predicateLabel,
            predicateAction: pin.properties.predicateAction
        })
    });

    windmillPopup.open(map);
});

// Logic For Zoom In Button
var plusZoomElement = document.createElement("div");
plusZoomElement.classList.add("zoom", "font-segoeui-b");
plusZoomElement.id = "zoom-plus";
plusZoomElement.innerText = "+";
document.getElementById("windmillMap").appendChild(plusZoomElement);
plusZoomElement.addEventListener("click", function (event) {
    var currZoom = map.getCamera().zoom;
    map.setCamera({
        zoom: currZoom + 1
    });
});

// Logic For Zoom Out Button
var minusZoomElement = document.createElement("div");
minusZoomElement.classList.add("zoom", "font-segoeui-b");
minusZoomElement.id = "zoom-minus";
minusZoomElement.innerText = "-";
document.getElementById("windmillMap").appendChild(minusZoomElement);
minusZoomElement.addEventListener("click", function (event) {
    var currZoom = map.getCamera().zoom;
    map.setCamera({
        zoom: currZoom - 1
    });
});
/******* MAP   end*/

function itemsToRows(itemsObject){
    var rows = [];
    var schemas = {};
    itemsObject.forEach(function(item){ 
        var schema;
        if (item.hasOwnProperty('schema') && item.schema && item.schema.rid != undefined && item.schema.properties) {
            schema = item.schema.properties;
            schemas[item.schema.rid] = schema;
        } else 
            schema = schemas[item.schemaRid];

        if (schema != undefined) {
            var row = item.values.reduce(function(itemObject, val, i){
                var propName = schema[i].name;
                itemObject[propName] = val;
                return itemObject;
            }, {});
            rows.push(row);
        }
    });
    return rows;
}

function rotateAnimation(el){
    var speed;
	var elem = document.getElementById(el);
    if(rpmspeed == 0){
        speed = 10000;
    } else if (rpmspeed < 10000) {
        speed = 100 - (rpmspeed * 5);
    } else { 
        speed = 10000;
    };

	if(navigator.userAgent.match("Chrome")){
		elem.style.WebkitTransform = "rotate("+degrees+"deg)";
	} else if(navigator.userAgent.match("Firefox")){
		elem.style.MozTransform = "rotate("+degrees+"deg)";
	} else if(navigator.userAgent.match("MSIE")){
		elem.style.msTransform = "rotate("+degrees+"deg)";
	} else if(navigator.userAgent.match("Opera")){
		elem.style.OTransform = "rotate("+degrees+"deg)";
	} else {
		elem.style.transform = "rotate("+degrees+"deg)";
	}
	looper = setTimeout('rotateAnimation(\''+el+'\','+speed+')',speed);
	degrees++;
	if(degrees > 359){
		degrees = 1;
	}
}
var tsiClient = new TsiClient();
var tsqExpressions = [];
var startDate = new Date('2019-02-25T08:00:00Z');
var endDate = new Date(startDate.valueOf() + 1000*60*60);

tsqExpressions.push(new tsiClient.ux.TsqExpression(
    {timeSeriesId: ['Sensor_0']}, // instance json
    {AvgValue: {
        kind: 'numeric',
        value: {tsx: '$event.Value.Double'},
        filter: null,
        aggregation: {tsx: 'avg($value)'}
    }}, // variable json
    { from: startDate, to: endDate, bucketSize: '30s' }, // search span
    '#60B9AE', // color
    'AvgValue')); // alias

authContext.getTsiToken().then(function(token){
    var tsqArray = tsqExpressions.map(function(ae){return ae.toTsq(true, true)});
    tsqArray.forEach(tsq => {tsq.getEvents.searchSpan.from = startDate.toISOString(); tsq.getEvents.searchSpan.to = endDate.toISOString()});
    tsiClient.server.getTsqResults(token, '52a8c27b-657a-47f8-8e27-07fcf5c708ed.env.crystal-dev.windows-int.net', tsqArray).then(function(result){
        var transformedEvents = tsiClient.ux.transformTsqResultsForVisualization(result, tsqExpressions);
        var lineChart = new tsiClient.ux.LineChart(document.getElementById('chart1'));
        lineChart.render(transformedEvents, {theme: 'light'}, []);
    });
});
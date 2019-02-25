var tsiClient = new TsiClient();
var tsqExpressions = [];
var startDate = new Date('2019-02-24T08:00:00Z');
var endDate = new Date(startDate.valueOf() + 1000*60*60*24);

tsqExpressions.push(new tsiClient.ux.TsqExpression(
    {timeSeriesId: ['Sensor_0']}, // instance json
    {AvgValue: {
        kind: 'numeric',
        value: {tsx: '$event.value.Double'},
        filter: null,
        aggregation: {tsx: 'avg($value)'}
    }}, // variable json
    { from: startDate, to: endDate, bucketSize: '6h' }, // search span
    '#60B9AE', // color
    'AvgValue')); // alias

authContext.getTsiToken().then(function(token){
    tsiClient.server.getTsqResults(token, '52a8c27b-657a-47f8-8e27-07fcf5c708ed.env.crystal-dev.windows-int.net', tsqExpressions.map(function(ae){return ae.toTsq(true, true)})).then(function(result){
        var transformedEvents = tsiClient.ux.transformTsqResultsToEventsArray(result);
        var eventsTable = tsiClient.ux.EventsTable(document.getElementById('chart1'));
        eventsTable.render(transformedEvents, {theme: 'light'}, true);
    });
});
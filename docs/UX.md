# TsiClient.ux Reference

## Components

### Line Chart

The line chart is used for rendering groups of time series.  A line chart can be created as follows...

```js
var tsiClient = new TsiClient();
var lineChart = new tsiClient.ux.LineChart(document.getElementById('chart'));
lineChart.render(data, chartOptions, chartDataOptionsArray);
```

where the parameter **data** follows the shape definied in [Chart Data Shape](#chartdatashape), chartOptions contain some subset of the properties defined in [Chart Options](#chartoptions), and chartDataOptionsArray is an array of objects that contain a subset of properties definied in [Chart Data Options](#chartdataoptions)

## Classes

## Functions

## Additional References

### Chart Data Shape

### Chart Options

### Chart Data Options
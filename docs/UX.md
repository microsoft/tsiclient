# TsiClient.ux Reference

## Components

### Line Chart

The line chart is used for rendering groups of time series.  A line chart can be created as follows...

```js
var tsiClient = new TsiClient();
var lineChart = new tsiClient.ux.LineChart(document.getElementById('chart'));
lineChart.render(data, chartOptions, chartDataOptionsArray);
```

where the parameter ``data`` follows the shape definied in [Chart Data Shape](#chart-data-shape), ``chartOptions`` contain some subset of the properties defined in [Chart Options](#chart-options), and ``chartDataOptionsArray`` is an array of objects that contain a subset of properties definied in [Chart Data Options](#chart-data-options).

## Classes

## Functions

## Additional References

### Chart Data Shape

Data for the Line, Pie, Bar, and Heatmap charts follows the following shape convention

```js
[
    {
        'Factory1': // a name for this group of lines
        {
            'Station1':  // a name for this particular line
            {
                '2019-02-07T21:00:00.000Z': {'temperature': 26.5}, // an object with keys representing ISO strings for time
                '2019-02-07T21:00:01.000Z': {'temperature': 24.3}, // with a value of a javascript object, whose keys represent value names
                ... 
            },
            'Station2': {...},
            ...
        }
    },
    {
        'Factory2':
        {
            'Station1': {...},
            ...
        }
    },
    ...
]
```

The above structure is shown in the [Basic Charts Example](https://tsiclientsample.azurewebsites.net/examples/noauth/basiccharts.html), and the associated [Code](../pages/samples/examples/noauth/basiccharts.html).

### Chart Options

### Chart Data Options
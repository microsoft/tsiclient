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

Chart options are generally the second parameter to a component ``render`` method.  They allow users to change view properties for the chart, like theme, legend layout, etc.  The available parameters for chart options are as follows (bold options represent default values if the option is not provided)...

|Property Name|Value Options|Description|
|-|-|-|
|theme|**'dark'**, 'light'|Component color scheme|
|legend| **'shown'**,'compact','hidden'|Legend layout|
|grid| **false**|true|if true, an accessible grid is available in the ellipsis menu|
|tooltip| **false**|true|if true, a tooltip is visible on hover|
|timestamp| **null**|'2017-04-19T13:00:00Z'|if an ISO string, sets the slider in the bar or pie chart to the specified timestamp|
|arcWidthRatio| **0**|a number between 0 and 1 that is the ratio between the outer and inner circle in a pie chart to create a donut|
|noAnimate| **false**|true|suppresses animated chart transitions|
|brushContextMenuActions| **null**|Array<Object>|an array of objects defining brush actions, for object shape see [Brush Context Menu Actions](#brush-context-menu-actions)|

### Chart Data Options

### Brush Context Menu Actions
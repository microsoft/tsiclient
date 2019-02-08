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

Chart data is generally represented as a set of **groups** that each contain **time series**. Data for the Line, Pie, Bar, and Heatmap charts follows the following shape convention

```js
[
    {
        Factory1: // a name for this group
        {
            Station1:  // a name for this particular time series
            {
                '2019-02-07T21:00:00.000Z': {'temperature': 26.5}, // an object with keys representing ISO strings for time
                '2019-02-07T21:00:01.000Z': {'temperature': 24.3}, // with a value of a javascript object, whose keys represent value names
                ... 
            },
            Station2: {...},
            ...
        }
    },
    {
        Factory2:
        {
            Station1: {...},
            ...
        }
    },
    ...
]
```

The above structure is shown in the [Basic Charts Example](https://tsiclientsample.azurewebsites.net/examples/noauth/basiccharts.html), and the associated [Code](../pages/samples/examples/noauth/basiccharts.html).

### Chart Options

Chart options are generally the second parameter to a component ``render`` method.  They allow users to change view properties for the chart, like theme, legend layout, etc.  

```js
lineChart.render(data, {theme: 'light', tooltip: true});
//                     ^this parameter is chartOptions
```

The available parameters for chart options are as follows (bold options represent default values if the option is not provided)...

|Property Name|Value Options|Description|
|-|-|-|
|theme|**'dark'**, 'light'|Component color scheme|
|legend| **'shown'**,'compact','hidden'|Legend layout|
|grid| **false**,true|If true, an accessible grid is available in the ellipsis menu|
|tooltip| **false**,true|If true, a tooltip is visible on hover|
|timestamp| **null**,'2017-04-19T13:00:00Z'|If an ISO string, sets the slider in the bar or pie chart to the specified timestamp|
|arcWidthRatio| **0**|A number between 0 and 1 that is the ratio between the outer and inner circle in a pie chart to create a donut|
|noAnimate| **false**,true|Suppresses animated chart transitions|
|brushContextMenuActions| **null**,Array&lt;brushContextMenuAction&gt;|An array of objects defining brush actions, for brushContextMenuActions object shape see [Brush Context Menu Actions](#brush-context-menu-actions)|
|autoTriggerBrushContextMenu|**false**, true|When true, opens a menu defined by brushContextMenuActions on brush mouseup|

### Chart Data Options

Chart data options are generally the third parameter to a component ``render`` method.  They are an array that allows users to define specific properties of the **groups** of data in the chart, like alias, color, etc.

```js
lineChart.render(data, chartOptions, [{alias: 'myFaveLines', color: 'red'}, {alias: 'worseLines', color: 'green'}]);
//               ^data is length 2   ^chart data options is also length 2
```

The available parameters for chart options are as follows (bold options represent default values if the option is not provided)...

|Property Name|Example Value|Description|
|-|-|-|
|color|'#4286f4'|The color of this group in a component|
|alias|'Factory1'|The display name for this group|
|contextMenu|Array[&lt;groupContextMenuAction>](#group-context-menu-actions)|Actions to take on context menu click on a group, or time series|
|searchSpan|[searchSpanObject](#search-span-object)|Specifies search span for this group|
|measureTypes|['min', 'avg', max']|The measure properties specified in the time series of this group|

### Brush Context Menu Actions

To take action on a line chart brush action (like in the [Explore events example]('https://tsiclientsample.azurewebsites.net/examples/withplatform/exploreevents.html')), brushContextMenuActions are added in chartOptions, with the following shape...

```js
var brushContextMenuActions = [
    {
        name: "Log From and To Times",
        action: function(fromTime, toTime){
            console.log(fromTime, toTime);
        }
    }, 
    {
        name: "Explore Events",
        action: function(fromTime, toTime){
            // an implementation is in explore events example
        }
    }
]

// later, when you render a line chart, use it like this
lineChart.render(data, {brushContextMenuActions: brushContextMenuActions});
```

### Group Context Menu Actions

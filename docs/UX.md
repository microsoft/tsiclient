# TsiClient.ux Reference

**TsiClient.ux** is a standalone module for data visualization and analytics. It can be used to build graphs and charts using generic JSON as well as JSON returned from the Azure Time Series Insights APIs directly.

**TsiClient.ux** is formally composed of the following items:

* [Components](#components) for visualizing data and building a variety of charts

* [Classes](#classes) for abstracting common operations, queries, and common objects

* [Functions](#functions) for transforming data into a suitable chartable shape

## Components

Components are used to build a variety of charts and define visualizations using JSON data.

### Line Chart

The **Line Chart** is used for rendering groups of time series.  A line chart can be created in the following way:

```JavaScript
var tsiClient = new TsiClient();
var lineChart = new tsiClient.ux.LineChart(document.getElementById('chart'));
lineChart.render(data, chartOptions, chartDataOptionsArray);
```

Above:

| Parameter name | Description |
|--- | --- |
| `data` | conforms to the shape definition in [Chart Data Shape](#chart-data-shape) |
| `chartOptions` | contains some subset of the properties defined in [Chart Options](#chart-options) 
|  `chartDataOptionsArray` | is an array of objects that contain a subset of properties defined in [Chart Data Options](#chart-data-options) |

A line chart can hold three different types of plots:

1. A line plot
1. An event plot
1. A categorical plot

***Note**: hosted examples of all three are provided at [https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html](https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html)*.

The type of plot for each data group is specified with the `dataType` [Chart Data Option](#chart-data-options). Multiple types are concurrently possible within one line chart.

Specific chart options are used when `dataType` is non-numeric:

* `height`
* [valueMapping](#value-mapping)
* `onElementClick`

`rollupCategoricalValues` is unique to groups with the categorical `dataType`.

### Bar Chart

**Bar Charts** are created in the same way as [line charts](#line-chart), and they take the same options and data shapes.  
```JavaScript
var tsiClient = new TsiClient();
var barChart = new tsiClient.ux.BarChart(document.getElementById('chart'));
barChart.render(data, chartOptions, chartDataOptionsArray);
```

Bar charts have a slider to step through the timestamps of the supplied time series.

### Pie Chart

**Pie Charts** are created in the same way as [bar charts](#bar-chart), and also have a slider for stepping through time series.

```JavaScript
var tsiClient = new TsiClient();
var pieChart = new tsiClient.ux.PieChart(document.getElementById('chart'));
pieChart.render(data, chartOptions, chartDataOptionsArray);
```

### Heatmap

**Heatmaps** are created using the same pattern as [line charts](#line-chart). However, [searchSpan](#search-span-object) *must* be supplied for each element of the `chartDataOptionsArray` configuration array.

```JavaScript
var tsiClient = new TsiClient();
var heatmap = new tsiClient.ux.Heatmap(document.getElementById('chart'));
heatmap.render(data, chartOptions, chartDataOptionsArray);
```

### Scatter Plot

**Scatter Plots** are created in the same way as [line charts](#line-chart) and take the same options and data shapes.
 However, [spMeasures](#chart-options) **must** be specified as an array of strings in the `chartOptions` object for scatter plots.  

Scatter plots also have the following optional `chartOptions`:

* [isTemporal](#chart-options) toggles the temporal slider on or off
* [spAxisLabels](#chart-options) creates axis labels for X and Y axis.

```JavaScript
var tsiClient = new TsiClient();
var scatterPlot = new tsiClient.ux.ScatterPlot(document.getElementById('chart'))
scatterPlot.render(data, chartOptions, chartDataOptionsArray);
```

The following code snippet demonstrates scatter plot-specific chart options:

* [spMeasures](#chart-options) - the first string in the `spMeasures` array is the X axis measure, the second, is the Y axis measure, and the third (optional) string is the data point radius measure.
* [isTemporal](#chart-options) - defaults to **false** if not set, but can be set to **true** as shown belo
* [spAxisLabels](#chart-options) - takes an array where the first element is used as the X axis label and the second element is used as the Y axis label.

```JavaScript
scatterPlot.render(data, {
    spMeasures:['temp', 'press', 'vol'],
    //          ^ X     ^ Y      ^ R (optional)
    isTemporal: true,
    //          ^ Turn on temporal slider
    spAxisLabels:['Termperature', 'Pressure']
    //            ^ X axis label  ^ Y axis label
    });
```

**Note**: *scatter plots will not render if `spMeasures` is not specified or **any** of the measures are not found in the [data](#chart-data-shape) as value keys*

### Events Grid

A grid of events (**Events Grid**) can be used to show a generic array of JSON data in a scalable way:

```JavaScript
var tsiClient = new TsiClient();
var eventsTable = tsiClient.ux.EventsTable(document.getElementById('chart'));
eventsTable.render(events, chartOptions)
```

Above, `events` is an array of flat JSON objects with the following kind of shape:

```JavaScript
[
    {
        timestamp: '2017-04-14T13:00:00Z',
        temperature: 27.5
    },
    {
        timestamp: '2017-04-14T13:01:00Z',
        pressure: 27.5
    }
]
```

## Classes

Classes abstract common operations, queries, and common objects.

### AggregateExpression

**AggregateExpressions** are used to represent API queries made against **S SKU** environments.

**AggregateExpressions** include the `toTsx()` method for transforming supplied query objects into a format conforming to [the Query Syntax](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-syntax). Objects so-transformed after an API call become a data group as described in [Chart Data Shape](#chart-data-shape) and  can be used as [Chart Data Options](#chart-data-options).  

Additional [Chart Data Options](#chart-data-options) can be specified as the final parameters, with supported properties defined.

***Note**: hosted AggregateExpressions examples are provided at [https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html](https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html)*.

```JavaScript
var aggregateExpression = new tsiClient.ux.AggregateExpression(
    {predicateString: "Factory = 'Factory1'"}, // filtering expression for data
    {property: 'Pressure', type: "Double"}, // measure column
    ['avg', 'min', 'max'], // desired measure types
    { from: startDate, to: endDate, bucketSize: '2m' }, // search span object
    {property: 'Station', type: 'String'},  // split by column
    {color: '#FF8C00', alias: 'Factory1Pressure') // ChartDataOptions
    );

// later, to call the API and visualize the result
tsiClient.server.getAggregates(token, '10000000-0000-0000-0000-100000000108.env.timeseries.azure.com', [aggregateExpression.toTsx())
    .then(function(result){
        var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, [aggregateExpression]);
        lineChart.render(transformedResult, null, [aggregateExpression]);
    })
```

### TsqExpression

**TsqExpressions** are used to represent queries made against **PAYG SKU** environments.

**TsqExpressions** include the `toTsq()` method for transforming supplied query objects into a format suitable to query the APIs. Objects so-transformed after an API call become a data group as described in [Chart Data Shape](#chart-data-shape) and  can be used as [Chart Data Options](#chart-data-options).  

***Note**: hosted TsqExpressions examples are provided at [https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html](https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html)*.

```JavaScript
var tsqExpression = new tsiClient.ux.TsqExpression(
    {timeSeriesId: ['df4412c4-dba2-4a52-87af-780e78ff156b']}, // time series instance json
    {AvgTemp: {
        kind: 'numeric',
        value: {tsx: '$event.temp.Double'},
        filter: null,
        aggregation: {tsx: 'avg($value)'}
    }}, // variable json
    {from: startDate, to: endDate, bucketSize: '6h'}, // search span object
    {color: '#60B9AE', alias: 'AvgTemp'} // ChartDataOptions
    );

// later, to call the API and visualize the result
tsiClient.server.getTsqResults(token, '10000000-0000-0000-0000-100000000109.env.timeseries.azure.com', [tsqExpression.toTsq()])
    .then(function(result){
        var transformedResult = tsiClient.ux.transformTsqResultsForVisualization(result, [tsqExpression]);
        lineChart.render(transformedResult, null, [tsqExpression]);
    });
```

## Functions

### transformAggregatesForVisualization

The shape of results returned by the Time Series Insights do not generally match [Chart Data Shape](#chart-data-shape).  To transform API results from the aggregates API of an S SKU, we use transformAggregatesForVisualization as follows...

```JavaScript
tsiClient.server.getAggregates(token, '10000000-0000-0000-0000-100000000108.env.timeseries.azure.com', [aggregateExpression.toTsx())
    .then(function(result){
        var transformedResult = tsiClient.ux.transformAggregatesForVisualization(result, [aggregateExpression]);
        // transformedResult is an array of data groups with time series and is suitable for visualization
        lineChart.render(transformedResult, null, [aggregateExpression]);  
    })
```

### transformTsqResultsForVisualization

To transform API results from the timeseries API of a PAYG SKU, we use transformTsqResultsForVisualization as follows...

```JavaScript
tsiClient.server.getTsqResults(token, '10000000-0000-0000-0000-100000000109.env.timeseries.azure.com', [tsqExpression.toTsq()])
    .then(function(result){
        var transformedResult = tsiClient.ux.transformTsqResultsForVisualization(result, [tsqExpression]);
        // transformedResult is an array of data groups with time series and is suitable for visualization
        lineChart.render(transformedResult, null, [tsqExpression]);
    });
```

## Additional References

### Chart Data Shape

Chart data is generally represented as a set of **groups** that each contain **time series**. Data for the Line, Pie, Bar, and Heatmap charts follows the following shape convention

```JavaScript
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

The above structure is shown in the [Basic Charts Example](https://tsiclientsample.azurewebsites.net/noauth/basiccharts.html), and the associated [Code](../pages/examples/noauth/basiccharts.html).

### Chart Options

Chart options are generally the second parameter to a component ``render`` method.  They allow users to change view properties for the chart, like theme, legend layout, etc, and can be explored in the [Chart Options Example](https://tsiclientsample.azurewebsites.net/noauth/chartOptions.html).

```JavaScript
lineChart.render(data, {theme: 'light', tooltip: true});
//                     ^this parameter is chartOptions
```

The most common available parameters for chart options are as follows (bold options represent default values if the option is not provided)...

|Property Name|Type|Value Options|Description|
|-|-|-|-|
|brushContextMenuActions|Array<any>|**null**, Array&lt;[brushContextMenuAction](#brush-context-menu-actions)&gt;|An array of objects defining brush actions
|grid|boolean|**false**, true|If true, add accessible grid button to the ellipsis menu|
|includeDots|boolean|**false**, true|If true, the linechart plots dots for values|
|includeEnvelope|boolean|**false**, true|If true, include an area showing min/max boundaries in the line chart|
|interpolationFunction|string|**''**, 'curveLinear'|Name for interpolation function used for line chart lines|
|legend|string|**'shown'**,'compact','hidden'|Legend layout|
|noAnimate|boolean|**false**, true|If true, uppresses animated chart transitions|
|offset|any|**0**, -120, 'America/Los_Angeles'|Offset for all timestamps in minutes from UTC, or a timezone supported by moment.js|
|spMeasures| Array&lt;string&gt; | Array&lt;string&gt; | X, Y, and Radius (optional) measures passed into Scatter Plot. *(Note: this is a scatter plot specific chart option)* |
|isTemporal| boolean| **false**, true | **true**: scatter plot has temporal slider to slide through time slices **false**: scatter plot renders all timestamps. *(Note: this is a scatter plot specific chart option)*|
|spAxisLabels| Array&lt;string&gt; | **null**, Array&lt;string&gt; | If given array, first element of array is used as X axis label.  Second element of array is used as Y axis label. *(Note: this is a scatter plot specific chart option)*|
|stacked|boolean|**false**|If true, stack bars in barchart|
|theme|string|**'dark'**, 'light'|Component color scheme|
|timestamp|string|**null**,'2017-04-19T13:00:00Z'|If an ISO string, sets the slider in the bar or pie chart to the specified timestamp|
|tooltip|boolean|**false**,true|If true, display tooltip on hover over a value element|
|yAxisState|string|**'stacked'**, 'shared', 'overlap|State of the y axis in line chart|
|yExtent|[number, number]|**null**, [minValue, maxValue]|A minimum and maximum for the extent of the yAxis for this line chart, when the yAxisState is set to shared|

For very specific user interactions, check out [additional chart options](#additional-chart-options)

### Chart Data Options

Chart data options are generally the final parameter for an AggregateExpression(#aggregateexpression) or TsqExpression(#tsqexpression), or third parameter to a component ``render`` method.  In render, chartDataOptions is an array that allows users to define specific properties of the **groups** of data in the chart, like alias, color, etc.

```js
// data is an array of length 2
lineChart.render(data, chartOptions, [{alias: 'myFaveLines', color: 'red'}, {alias: 'worseLines', color: 'green'}]);
```

The available parameters for chart data options are as follows...

|Property Name|Type|Value Options|Description|
|-|-|-|-|
|color|string|'#4286f4'|The color of this group in a component|
|alias|string|'Factory1'|The display name for this group|
|dataType|string| **numeric**, categorical, events|specifies the visual representation of the data - numeric creates a line plot, categrocial a series of rectangles, and events a diamond or teardrop at each timestamp with data
|contextMenu|Array&lt;[groupContextMenuAction](#group-context-menu-actions)&gt;|[]|Actions to take on context menu click on a group, or time series|
|searchSpan|[searchSpanObject](#search-span-object)|null|Specifies search span for this group|
|measureTypes|Array&lt;string>|['min', 'avg', max']|The measure properties specified in the time series of this group|
|interpolationFunction|string|'curveStep'|If 'curveStep' is set, step interpolation is used|
|includeEnvelope|boolean|true|If true, and a data group has measure types ['min', 'avg', max'], a shadow will be drawn to show the range of values|
|includeDots|boolean|true|If true, draw circles for each value in the group|
|yExtent|[number, number]|[0,400]|A minimum and maximum for the extent of the yAxis for this group|
|visibilityState|[boolean, [string]?]|[true,['sb1', 'sb7']]|The first element specifies whether the data group is visible, the second is an optional array of visible time series names. If omitted, the data group reverts to default visibility state for each time series|
|height|number|**40**|For non-numeric dataTypes; the vertical space this group consumes in the chart|
|valueMapping|[valueMapping](#value-mapping)|{}|Defines the relationship between measures and their colors in non-numeric plots in the line chart|
|onElementClick|(dataGroupName: string, timeSeriesName: string, timestamp: string, measures: Array<any>) => void|**null**|handler for when an element in a non-numeric plot in the linechart is clicked. the paramters are: data group, series name, timestamp, and measures at that timestamp| 
|rollupCategoricalValues|boolean|**false**|for categorical plots in line charts, this specifies that adjacent measures with the same values should be rolled into the first with those values|
|eventElementType|string|**'diamond'**, teardrop|specifies the svg icon for an event in the line chart, either a diamond or a teardrop|

***Note**: Some parameters are present in both chart options and chart data options. For boolean values, the property will evaluate to true if either value is true. For other types of values, the chart data option value will take precendence over the chart option value.* 

### Brush Context Menu Actions

To take action on a line chart brush action (like in the [Explore events example]('https://tsiclientsample.azurewebsites.net/withplatform/exploreevents.html')), brushContextMenuActions are added in chartOptions, with the following shape...

```JavaScript
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
            // an implementation is in the explore events example
        }
    }
]

// later, when you render a line chart, use it like this
lineChart.render(data, {brushContextMenuActions: brushContextMenuActions});
```

### Group Context Menu Actions

To take action on a context menu click of a data group (like in the [Line chart generating bar and pie charts example]('https://tsiclientsample.azurewebsites.net/withplatform/exploreevents.html')), groupContextMenuActions are added to chart data options, with the following shape...

```JavaScript
var groupContextMenuActions = [{
        name: "Print parameters to console",
        action: function(dataGroupName, timeSeriesName, timestamp) {
            console.log(ae);
            console.log(splitBy);
            console.log(timestamp);
        }
    }, 
    {
        name: "Some other function",
        action: function(dataGroupName, timeSeriesName, timestamp) {
            // left as an exercise
        }
    }
    ];
```

### Search Span Object

Search span objects define the range and bucket size of the time series of a data group.  Search span objects are useful for showing sparse data in a line chart, like [this example]('https://tsiclientsample.azurewebsites.net/withplatform/basicCharts.html')They have the following shape...

```JavaScript
var searchSpanObject = {
    from: '2017-04-20T12:00:00Z', // a js date isostring
    to: '2017-05-20T12:00:00Z',
    bucketSize: '1h'  // an integer, followed by one of ms, s, m, h, d
}
```

### Value Mapping

Used for event and categorial data types in the line chart, this object specifies the relationship between measure values and
colors in the plot, with the following shape...

```JavaScript
var valueMapping = {
    state1: {
        color: '#F2C80F'
    }, 
    state2: {
        color: '#FD625E'
    },
    state3: {
        color:'#3599B8'
    }
}
```

## Appendix

### Additional Chart Options

Some less common chart options that can be used for very specific user interactions are...

|Property Name|Type|Value Options|Description|
|-|-|-|-|
|aggTopMargin|number|**12**|Margin on top of each aggregate line(s) in pixels|
|arcWidthRatio|number| **0**|Ratio of the outer and inner circle in a pie chart, from 0 to 1|
|autoTriggerBrushContextMenu|boolean|**false**, true|If true, opens a menu defined by brushContextMenuActions on brush mouseup|
|availabilityLeftMargin|number|**60**|Left margin of the availability chart in pixels|
|brushClearable|boolean|**true**|If true, maintain brush selected region upon clear and non-selection of a new region|
|brushHandlesVisible|boolean|**false**|If true, draw handles on the line chart brush|
|brushMoveAction|(from:DateTime, to:DateTime) => any |**() => {}**|Action fired when the brush moves|
|brushMoveEndAction|(from:DateTime, to:DateTime) => any|**() => {}**|Action fired at the end of a mouse movement involving the brush|
|canDownload|boolean|**true**|If true, chart's ellipsis menu contains a download button to download the chart's data|
|color|string|**null**, 'purple', '#404040'|Color of the time selection ghost in availability chart|
|dateLocale|string|**'en'**, 'de'|Date locale name for the formatting of dates as well as the language of days and months in the calendar picker|
|focusHidden|boolean|**false**|If true, hide focus element|
|fromChart|boolean|**false**|If true, a component is a subcomponent of another component|
|hideChartControlPanel|boolean|**false**|If true, hide panel with chart control buttons|
|includeTimezones|boolean|**true**|If true, include timezone dropdown in dateTimePicker|
|isArea|boolean|**false**|If true, lines in LineChart are also areas|
|isCompact|boolean|**false**|If true, availability chart is in compact mode (expanded mode if false)|
|is24HourTime|boolean|**true**|If true, display time in 24 hour format, (12 hour time with am/pm if false|
|keepBrush|boolean|**false**|If true, maintain brush selected region upon render|
|keepSplitByColor|boolean|**false**|If true, maintain split by colors when state updated|
|maxBuckets|number|**500**|Max number of buckets in availability chart|
|minBrushWidth|number|**0**|Minimum possible width of brush in a linechart in pixels|
|minutesForTimeLabels|boolean|**false**|If true, force time labels to minute granularity|
|onInstanceClick|(instance: any) => any|**() => {return {}}**|For model search: takes an instance and returns an object of context menu actions|
|onMouseout|() => void|**() => {}**|Action fired when the mouse leaves a chart value element (ex: line, bar, pie chart segment, etc.)|
|onMouseover|(aggKey: string, splitBy: string) => void|**() => {}**|Action fired when the mouse enters a chart value element|
|onSticky|(aggKey: string, splitBy: string) => void|**() => {}**|Action fired when a chart value element is stickied|
|onUnsticky|(aggKey: string, splitBy: string) => void|**() => {}**|Action fired when a chart value element is stickied|
|onKeydown|(d3Event: any, awesompleteObject: any) => void  |**() => {}**|Action fired when keydown action performed in ModelAutocomplete|
|onInput|(searchText: string) => void |**() => {}**|Action fired on input actions in ModelAutocomplete|
|preserveAvailabilityState|boolean|**false**|If true, save availability chart state on render|
|scaledToCurrentTime|boolean|**false**|If true,  base slider base component's scale on current time's values (all values if false)|
|singleLineXAxisLabel|boolean|**false**|If true, display x axis time labels on a single line (split into two lines if false)|
|snapBrush|boolean|**false**|If true, snap linechart brush to closest value|
|suppressResizeListener|boolean|**false**|If true, ignore components' resize function. This applies to components which draw an SVG|
|timeFrame|any|**null**|From and to to specify range of an event or state series
|withContextMenu|boolean|**false**|If true, the hierarchy uses a context menu when you click on a parent of leaf nodes
|xAxisHidden|boolean|**false**|If true, hide xAxis in chart
|xAxisTimeFormat|(dateString: string, i: number, isFirst: boolean, isLast: boolean) => string|**null**|A function called on each x axis tick which takes the tick's timestamp, index, and if it's the first or last string, and returns a [moment date format string](https://devhints.io/moment#formatting-1)
|yAxisHidden|boolean|**false**|If true, hide yAxis in chart
|zeroYAxis|boolean|**true**|If true, set bar chart's bar's bottom (or top if negative) to zero

## See also

* The [Azure Time Series Insights product documentation](https://docs.microsoft.com/azure/time-series-insights/)

* The Azure Time Series Insights [Query API reference documentation](https://docs.microsoft.com/rest/api/time-series-insights/ga-query)
# TSIClient: The Azure Time Series Insights JavaScript SDK

<a href="https://tsiclientsample.azurewebsites.net"><img src="https://insights.timeseries.azure.com/favicons/android-chrome-192x192.png" align="left" hspace="10" vspace="6" height="100px"></a>

The Azure Time Series Insights JavaScript SDK (aka **tsiclient**) is a JavaScript library for Microsoft Azure Time Series Insights, featuring components for data visualization and analytics, utilities for making calls directly to the TSI Platform API, and more.  **tsiclient** also ships with an associated CSS file (which you must include using your preferred css linking method), which makes the components look great out of the box.


[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT) [![npm version](https://badge.fury.io/js/tsiclient.svg)](https://badge.fury.io/js/tsiclient) 

## Resources

* [API Reference documentation](docs/API.md)
* [Product documentation](https://docs.microsoft.com/azure/time-series-insights/)
* [Authorization and authentication](https://docs.microsoft.com/azure/time-series-insights/time-series-insights-authentication-and-authorization)
* [Hosted tsiclient samples](https://tsiclientsample.azurewebsites.net)

## Installing

If you use npm, `npm install tsiclient`. You can also load directly from [unpkg](https://unpkg.com/tsiclient/). For example:

```html
<script src="https://unpkg.com/tsiclient@1.2.24/tsiclient.js"></script>
<link rel="stylesheet" type="text/css" href="https://unpkg.com/tsiclient@1.2.24/tsiclient.css"></link>
```

To import all of **tsiclient** into an ES2015 application, import everything into a namespace, like so...

```js
import TsiClient from "tsiclient";

// later, when you want a line chart
let tsiClient = new TsiClient();
let lineChart = new tsiClient.ux.LineChart(document.getElementById('chart'));
```

You can also import components directly.  If you only need LineChart for example, you can import it like so...

```js
import LineChart from 'tsiclient/LineChart'

// later when you want a line chart
let lineChart = new LineChart(document.getElementById('chart'));
```
Direct imports will significantly reduce your bundle size. This is the recommended approach.

## Release Notes

Starting with version 1.3.0, discrete events and state transitions will be represented just like numeric time series in the LineChart component.  This may be a breaking change for users representing non-numeric series in the line chart using the "events" and "states" Chart Options.  For usage instructions, consult [this example](https://tsiclientsample.azurewebsites.net/noauth/multipleseriestypes.html) and the associated [documentation](https://github.com/microsoft/tsiclient/blob/master/docs/UX.md#line-chart).


## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
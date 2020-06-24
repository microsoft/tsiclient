# TSIClient API Reference

**tsiclient** is a collection of components for data visualization and analytics.

It includes optional modules that may be used independently of [Azure Time Series Insights](https://docs.microsoft.com/azure/time-series-insights/) as well as tools for calling the [Azure Time Series Insights Query APIs](https://docs.microsoft.com/rest/api/time-series-insights/ga-query):

* [TsiClient.ux](UX.md) that works with generic JSON to render visual analytics using charts and graphs

* [TsiClient.server](Server.md) which comprises a set of utilities for querying the Azure Time Series Insights APIs directly from the browser

* Helper classes that simplify usage throughout

## TsiClient.ux

[TsiClient.ux](UX.md) is a standalone module for data visualization and analytics. It can be used to build graphs and charts using generic JSON as well as JSON returned from the Azure Time Series Insights APIs directly.

**TsiClient.ux** is formally composed of the following items:

* [Components](UX.md#components) for visualizing data and building a variety of charts

* [Classes](UX.md#classes) for abstracting common operations, queries, and common objects

* [Functions](UX.md#functions) for transforming data into a suitable chartable shape

## TsiClient.server

[TsiClient.server](Server.md) is a set of utilities for querying the Azure Time Series Insights APIs directly from a browser or web client.

**TsiClient.server** consists in several [Functions](Server.md#functions) to abstract common operations made to the Azure Time Series Insights Query APIs.

## See also

* The [Azure Time Series Insights product documentation](https://docs.microsoft.com/azure/time-series-insights/)

* The Azure Time Series Insights [Query API reference documentation](https://docs.microsoft.com/rest/api/time-series-insights/ga-query)

* Hosted **tsiclient** [client samples](https://tsiclientsample.azurewebsites.net)

* Backend C# code samples for [Azure Time Series Insights](https://github.com/Azure-Samples/Azure-Time-Series-Insights)
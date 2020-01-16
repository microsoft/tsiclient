# TsiClient.server Reference

**TsiClient.server** is a set of utilities for querying the Azure Time Series Insights APIs directly from a browser or web client.

**TsiClient.server** consists in several [Functions](#functions) to abstract common operations made to the Azure Time Series Insights Query APIs.

## Functions

**TsiClient.server Functions** are used for querying the [Azure Time Series Insights APIs](https://docs.microsoft.com/rest/api/time-series-insights/ga-query).

**Functions** are JSON in, JSON out by design; as specified in the [Azure Time Series Insights API reference documentation](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api).

Users can generate the necessary JSON for querying the APIs using classes in user interface such as `.toTsx()` for an [AggregateExpression](API.md#aggregateexpression). 

Alternatively, JSON can be generated programatically without using helper classes from **TsiClient.ux**.

### getAggregates

**getAggregates** is used for querying the [Get Environment Aggregates API](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-aggregates-api).

The following code block demonstrates how to perform a query:

```JavaScript
tsiClient.server.getAggregates(token, environmentFqdn, tsxArray)
    .then(function(result){
        console.log(result)
    })
```

| Parameter name | Example value | Description |
|-|-|-|
| `token` | An Azure Active Directory (AAD) [access token](https://docs.microsoft.com/azure/active-directory/develop/access-tokens) | A valid AAD access token |
| `environmentFqdn` | `10000000-0000-0000-0000-100000000108.env.timeseries.azure.com` | The environment FQDN |
| `tsxArray` | Array<[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-aggregates-api)> | The query in [proper shape](https://docs.microsoft.com/azure/time-series-insights/how-to-shape-query-json) |

### getEvents

**getEvents** is used for querying the [Get Environment Events API](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-events-api).

The following code block demonstrates how to perform a query:

```JavaScript
tsiClient.server.getEvents(token, environmentFqdn, tsxObject)
    .then(function(result){
        console.log(result)
    })
```

| Parameter name | Example value | Description |
|-|-|-|
| `token` | An Azure Active Directory (AAD) [access token](https://docs.microsoft.com/azure/active-directory/develop/access-tokens) | A valid AAD access token |
| `environmentFqdn` | `10000000-0000-0000-0000-100000000108.env.timeseries.azure.com` | The environment FQDN |
| `tsxObject`|[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-events-api)| The query in [proper shape](https://docs.microsoft.com/azure/time-series-insights/how-to-shape-query-json) |

### getTsqResults

**getTsqResults** is used for querying the [Azure TIme Series Insights Preview APIs](https://docs.microsoft.com/rest/api/time-series-insights/preview).

The following code block demonstrates how to perform a query:

```JavaScript
tsiClient.server.getTsqResults(token, environmentFqdn, tsqArray)
    .then(function(result){
        console.log(result)
    })
```

| Parameter name | Example value | Description |
|-|-|-|
| `token` | An Azure Active Directory (AAD) [access token](https://docs.microsoft.com/azure/active-directory/develop/access-tokens) | A valid AAD access token |
| `environmentFqdn` | `10000000-0000-0000-0000-100000000108.env.timeseries.azure.com` | The environment FQDN |
| `tsqArray` |Array<[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/preview#query-apis)>|The query in [proper shape](https://docs.microsoft.com/azure/time-series-insights/time-series-insights-update-how-to-shape-events) |

## See also

* The [Azure Time Series Insights product documentation](https://docs.microsoft.com/azure/time-series-insights/)

* The Azure Time Series Insights [Query API reference documentation](https://docs.microsoft.com/rest/api/time-series-insights/ga-query)
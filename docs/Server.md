# TsiClient.server Reference

## Functions

Functions in TsiClient.server are used for querying the Time Series Insights API.  By design, they are JSON in, JSON out, exactly as specified by the [API](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api).  Using classes in UX such as .toTsx() for an [AggregateExpression](API.md#aggregateexpression) users can generate the necessary JSON for querying the API, or the JSON can be generated programatically without helper classes from TsiClient.ux.

### getAggregates

getAggregates is used for querying Time Series Insights /aggregates API.  Example usage is as follows...

```JavaScript
tsiClient.server.getAggregates(token, environmentFqdn, tsxArray)
    .then(function(result){
        console.log(result)
    })
```

where the parameters are defined as follows...

|Parameter Name|Example Value|Description|
|-|-|-|
|token|TSI access token from [AAD](https://docs.microsoft.com/azure/active-directory/develop/access-tokens)|An access token for the TSI API
|environmentFqdn|`'10000000-0000-0000-0000-100000000108.env.timeseries.azure.com'`|The environment FQDN|
|tsxArray|Array<[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-aggregates-api)>|The query in proper TSI API shape|

### getEvents

getEvents is used for querying Time Series Insights /events API.  Example usage is as follows...

```JavaScript
tsiClient.server.getEvents(token, environmentFqdn, tsxObject)
    .then(function(result){
        console.log(result)
    })
```

where the parameters are defined as follows...

|Parameter Name|Example Value|Description|
|-|-|-|
|token|TSI access token from [AAD](https://docs.microsoft.com/azure/active-directory/develop/access-tokens)|An access token for the TSI API
|environmentFqdn|`'10000000-0000-0000-0000-100000000108.env.timeseries.azure.com'`|The environment FQDN|
|tsxObject|[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/ga-query-api#get-environment-events-api)|The query in proper TSI API shape|

### getTsqResults

getTsqResults is used for querying Time Series Insights preview API.  Example usage is as follows...

```JavaScript
tsiClient.server.getTsqResults(token, environmentFqdn, tsqArray)
    .then(function(result){
        console.log(result)
    })
```

where the parameters are defined as follows...

|Parameter Name|Example Value|Description|
|-|-|-|
|token|TSI access token from [AAD](https://docs.microsoft.com/azure/active-directory/develop/access-tokens)|An access token for the TSI API
|environmentFqdn|`'10000000-0000-0000-0000-100000000108.env.timeseries.azure.com'`|The environment FQDN|
|tsqArray|Array<[Request Body](https://docs.microsoft.com/rest/api/time-series-insights/preview-query#get-series-api)>|The query in proper TSI API shape|
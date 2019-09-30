import * as Promise from 'promise-polyfill';
import { Utils } from '../UXClient/Utils';

class ServerClient {
    private apiVersionUrlParam = "?api-version=2016-12-12";
    private tsmTsqApiVersion = "?api-version=2018-11-01-preview";
    public maxRetryCount = 3;

    Server () {
    }

    private createPromiseFromXhr (uri, httpMethod, payload, token, responseTextFormat, continuationToken = null) {
        return new Promise((resolve: any, reject: any) => {
            let sendRequest;
            let retryCount = 0;
            sendRequest = () => {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = () => {
                    if(xhr.readyState != 4) return;

                    if(xhr.status == 200){
                        if (xhr.responseText.length == 0)
                            resolve({});
                        else {
                            resolve(responseTextFormat(xhr.responseText));
                        }
                    }
                    else if(xhr.status == 503 && retryCount < this.maxRetryCount){
                        retryCount++;
                        this.retryWithDelay(retryCount, sendRequest);
                    }
                    else{
                        reject(xhr);
                    }
                }
                xhr.open(httpMethod, uri);
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                if (continuationToken)
                    xhr.setRequestHeader('x-ms-continuation', continuationToken);
                xhr.send(payload);
            }
            sendRequest();
        });
    }

    private mergeTsqEventsResults = (tsqEvents) => {
        let events = {properties: [], timestamps: []};
        tsqEvents.forEach(tsqe => {
            let currentPropertiesValueLength = events.timestamps.length;
            if(tsqe.properties && tsqe.properties.length){
                tsqe.properties.forEach(prop => {
                    let foundProperty = events.properties.filter(p => p.name===prop.name && p.type===prop.type);
                    let existingProperty;
                    if(foundProperty.length === 1){
                        let indexOfExistingProperty = events.properties.indexOf(foundProperty[0]);
                        existingProperty = events.properties[indexOfExistingProperty];
                    }
                    else{
                        existingProperty = {name: prop.name, type: prop.type, values: []};
                        events.properties.push(existingProperty);
                    }
                    while(existingProperty.values.length < currentPropertiesValueLength){
                        existingProperty.values.push(null);
                    }
                    existingProperty.values = existingProperty.values.concat(prop.values);
                });
            }
            events.timestamps = events.timestamps.concat(tsqe.timestamps);
        });
        return events;
    }

    private getQueryApiResult = (token, results, contentObject, index, uri, resolve, messageProperty, onProgressChange = (percentComplete) => {}, mergeAccumulatedResults = false, xhr = null) => {
        if (xhr === null) {
            xhr = new XMLHttpRequest();
        }

        var onreadystatechange;
        var retryCount = 0;
        var retryTimeout;
        var continuationToken;
        var accumulator = [];
        onreadystatechange = () => {
            if(xhr.readyState != 4) return;

            if(xhr.status == 200){
                var message = JSON.parse(xhr.responseText);
                if(!message.continuationToken){
                    if(mergeAccumulatedResults && accumulator.length){
                        accumulator.push(message);
                        results[index] = this.mergeTsqEventsResults(accumulator);
                    }
                    else{
                        results[index] = messageProperty(message);
                        delete results[index].progress;
                    }
                    if(results.map(ar => !('progress' in ar)).reduce((p,c) => { p = c && p; return p}, true))
                        resolve(results);
                }
                else{
                    accumulator.push(message);
                    let progressFromMessage = message && message.progress ? message.progress : 0;
                    results[index].progress = mergeAccumulatedResults ? Math.max(progressFromMessage, accumulator.reduce((p,c) => p + (c.timestamps && c.timestamps.length ? c.timestamps.length : 0),0) / contentObject.getEvents.take * 100) : progressFromMessage;
                    xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = onreadystatechange;
                    xhr.open('POST', uri);
                    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                    continuationToken = message.continuationToken;
                    xhr.setRequestHeader('x-ms-continuation', continuationToken);
                    xhr.send(JSON.stringify(contentObject));
                }
            }
            else if(xhr.status === 503 && retryCount < this.maxRetryCount){
                retryCount++;
                retryTimeout = this.retryWithDelay(retryCount, () => {
                    xhr.open('POST', uri);
                    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                    if(continuationToken)
                        xhr.setRequestHeader('x-ms-continuation', continuationToken);
                    xhr.send(JSON.stringify(contentObject));
                });
            }
            else if (xhr.status !== 0) {
                results[index] = {__tsiError__: JSON.parse(xhr.responseText)};
                if(results.map(ar => !('progress' in ar)).reduce((p,c) => { p = c && p; return p}, true))
                    resolve(results);
            }
            let percentComplete = Math.max(results.map(r => 'progress' in r ? r.progress : 100).reduce((p,c) => p+c, 0) / results.length, 1);
            onProgressChange(percentComplete);
        }

        xhr.onreadystatechange = onreadystatechange;
        xhr.onabort = () => {
            resolve('__CANCELLED__');
            clearTimeout(retryTimeout);
        }
        xhr.open('POST', uri);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(JSON.stringify(contentObject));
    }

    public getCancellableTsqResults (token: string, uri: string, tsqArray: Array<any>, onProgressChange = () => {}, mergeAccumulatedResults = false, storeType: string = null) {
        return this.getTsqResults(token, uri, tsqArray, onProgressChange, mergeAccumulatedResults, storeType, true);
    }

    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, onProgressChange = () => {}, mergeAccumulatedResults = false, storeType: string = null, hasCancelTrigger = false) {
        var tsqResults = [];
        tsqArray.forEach(tsq => {
            tsqResults.push({progress: 0});
        });

        let xhrs = tsqArray.map((tsq) => {
            return new XMLHttpRequest();
        });

        let storeTypeString = storeType ? '&storeType=' + storeType : '';

        let promise = new Promise((resolve: any, reject: any) => {
            tsqArray.map((tsq, i) => {
                return this.getQueryApiResult(token, tsqResults, tsq, i, `https://${uri}/timeseries/query${this.tsmTsqApiVersion}${storeTypeString}`, resolve, message => message, onProgressChange, mergeAccumulatedResults, xhrs[i]);
            });
        });
        let cancelTrigger = () => {
            xhrs.forEach((xhr) => {
                xhr.abort();
            });
        }

        if (hasCancelTrigger) {
            return [promise, cancelTrigger];
        }
        return promise;
    }

    public getAggregates(token: string, uri: string, tsxArray: Array<any>, onProgressChange = () => {}) {
        var aggregateResults = [];
        tsxArray.forEach(ae => {
            aggregateResults.push({progress: 0});
        });

        return new Promise((resolve: any, reject: any) => {
            tsxArray.forEach((tsx, i) => {
                this.getQueryApiResult(token, aggregateResults, tsx, i, `https://${uri}/aggregates${this.apiVersionUrlParam}`, resolve, message => message.aggregates[0], onProgressChange);
            })
        })
    }

    public getTimeseriesInstances(token: string, environmentFqdn: string, limit: number = 10000, timeSeriesIds: Array<any> = null) {
        if(!timeSeriesIds || timeSeriesIds.length === 0) {
            return new Promise((resolve: any, reject: any) => {
                this.getDataWithContinuationBatch(token, resolve, reject, [], 'https://' + environmentFqdn + '/timeseries/instances/' + this.tsmTsqApiVersion, 'GET', 'instances', null, limit);
            });
        }
        else {
            return this.createPromiseFromXhr('https://' + environmentFqdn + '/timeseries/instances/$batch' + this.tsmTsqApiVersion, "POST", JSON.stringify({get: timeSeriesIds}), token, (responseText) => {return JSON.parse(responseText);});
        }
    }

    public getTimeseriesTypes(token: string, environmentFqdn: string, typeIds: Array<any> = null) {
        if(!typeIds || typeIds.length === 0) {
            let uri = 'https://' + environmentFqdn + '/timeseries/types/' + this.tsmTsqApiVersion;
            return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
        } else {
            return this.createPromiseFromXhr('https://' + environmentFqdn + '/timeseries/types/$batch' + this.tsmTsqApiVersion, "POST", JSON.stringify({get: {typeIds: typeIds, names: null}}), token, (responseText) => {return JSON.parse(responseText);});
        }
    }

    public getTimeseriesHierarchies(token: string, environmentFqdn: string) {
        let uri = 'https://' + environmentFqdn + '/timeseries/hierarchies/' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getTimeseriesModel(token: string, environmentFqdn: string) {
        let uri = 'https://' + environmentFqdn + '/timeseries/modelSettings/' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getTimeseriesInstancesPathSearch(token: string, environmentFqdn: string, payload, instancesContinuationToken = null, hierarchiesContinuationToken = null) {
        let uri = 'https://' + environmentFqdn + '/timeseries/instances/search' + this.tsmTsqApiVersion;
        let requestPayload = {...payload};
        if (requestPayload.path.length == 0) {
            requestPayload.path = null;
        }
        return this.createPromiseFromXhr(uri, "POST", JSON.stringify(requestPayload), token, (responseText) => {return JSON.parse(responseText);}, instancesContinuationToken || hierarchiesContinuationToken);
    }

    public getTimeseriesInstancesSuggestions(token: string, environmentFqdn: string, searchString: string, take: number = 10) {
        let uri = 'https://' + environmentFqdn + '/timeseries/instances/suggest' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "POST", JSON.stringify({searchString: searchString, take: take}), token, (responseText) => {return JSON.parse(responseText);});
    }

    public getTimeseriesInstancesSearch(token: string, environmentFqdn: string, searchString: string, continuationToken = null) {
        let uri = 'https://' + environmentFqdn + '/timeseries/instances/search' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "POST", JSON.stringify({searchString: searchString}), token, (responseText) => {return JSON.parse(responseText);}, continuationToken);
    }

    public getReferenceDatasetRows(token: string, environmentFqdn: string, datasetId: string) {
        return new Promise((resolve: any, reject: any) => {
            this.getDataWithContinuationBatch(token, resolve, reject, [], "https://" + environmentFqdn + "/referencedatasets/" + datasetId + "/items" + this.apiVersionUrlParam + "&format=stream", 'POST', 'items');
        });
    }

    public getEnvironments(token: string, endpoint = 'https://api.timeseries.azure.com'){
        var uri = endpoint + '/environments' + this.apiVersionUrlParam;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getSampleEnvironments(token: string, endpoint = 'https://api.timeseries.azure.com'){
        var uri = endpoint + '/sampleenvironments' + this.apiVersionUrlParam;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getMetadata(token: string, environmentFqdn: string, minMillis: number, maxMillis: number) {
        var uri = 'https://' + environmentFqdn + '/metadata' + this.apiVersionUrlParam;
        var searchSpan = {searchSpan: { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() }};
        var payload = JSON.stringify(searchSpan);
        return this.createPromiseFromXhr(uri, "POST", payload, token, (responseText) => {return JSON.parse(responseText).properties;});
    }

    public getEventSchema(token: string, environmentFqdn: string, minMillis: number, maxMillis: number) {
        var uri = 'https://' + environmentFqdn + '/eventSchema' + this.tsmTsqApiVersion;
        var searchSpan = {searchSpan: { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() }};
        var payload = JSON.stringify(searchSpan);
        return this.createPromiseFromXhr(uri, "POST", payload, token, (responseText) => {return JSON.parse(responseText).properties;});
    }

    public getAvailability(token: string, environmentFqdn: string, apiVersion: string = this.apiVersionUrlParam, hasWarm: boolean = false) {
        let uriBase = 'https://' + environmentFqdn + '/availability';
        let coldUri = uriBase + apiVersion + (hasWarm ? '&storeType=ColdStore' : '');

        return new Promise((resolve: any, reject: any) => {
            this.createPromiseFromXhr(coldUri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);}).then((coldResponse) => {
                if (hasWarm) {
                    let warmUri = uriBase + apiVersion + '&storeType=WarmStore';
                    this.createPromiseFromXhr(warmUri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);}).then((warmResponse) => {
                        let availability = warmResponse ? warmResponse.availability : null ;
                        if (coldResponse.availability) {
                            // availability = Utils.mergeAvailabilities(warmResponse.availability, coldResponse.availability, warmResponse.retention);
                            availability = Utils.mergeAvailabilities(this.warmAvail.availability, this.coldAvail.availability, this.warmAvail.retention);
                        }
                        resolve({availability: availability});
                    })
                    // .catch(() => {resolve(coldResponse)});
                } else {
                    resolve(coldResponse);
                }
            });
        });
    }

    public coldAvail = {
        "availability": {
            "intervalSize": "PT10M",
            "distribution": {
                "2019-09-30T10:40:00Z": 59400,
                "2019-09-30T10:50:00Z": 59400,
                "2019-09-30T11:00:00Z": 59400,
                "2019-09-30T11:10:00Z": 59400,
                "2019-09-30T11:20:00Z": 58300,
                "2019-09-30T11:30:00Z": 59300,
                "2019-09-30T11:40:00Z": 58500,
                "2019-09-30T11:50:00Z": 59000,
                "2019-09-30T12:00:00Z": 57100,
                "2019-09-30T12:10:00Z": 58500,
                "2019-09-30T12:20:00Z": 59100,
                "2019-09-30T12:30:00Z": 59100,
                "2019-09-30T12:40:00Z": 59400,
                "2019-09-30T12:50:00Z": 59300,
                "2019-09-30T13:00:00Z": 59200,
                "2019-09-30T13:10:00Z": 59400,
                "2019-09-30T13:20:00Z": 59400,
                "2019-09-30T13:30:00Z": 59400,
                "2019-09-30T13:40:00Z": 59400,
                "2019-09-30T13:50:00Z": 59500,
                "2019-09-30T14:00:00Z": 58800,
                "2019-09-30T14:10:00Z": 59400,
                "2019-09-30T14:20:00Z": 59000,
                "2019-09-30T14:30:00Z": 59400,
                "2019-09-30T14:40:00Z": 59300,
                "2019-09-30T14:50:00Z": 59400,
                "2019-09-30T15:00:00Z": 59400,
                "2019-09-30T15:10:00Z": 59400,
                "2019-09-30T15:20:00Z": 59000,
                "2019-09-30T15:30:00Z": 59400,
                "2019-09-30T15:40:00Z": 59300,
                "2019-09-30T15:50:00Z": 59400,
                "2019-09-30T16:00:00Z": 59300,
                "2019-09-30T16:10:00Z": 59300,
                "2019-09-30T16:20:00Z": 59500,
                "2019-09-30T16:30:00Z": 59400,
                "2019-09-30T16:40:00Z": 59400,
                "2019-09-30T16:50:00Z": 59100,
                "2019-09-30T17:00:00Z": 59400,
                "2019-09-30T17:10:00Z": 59400,
                "2019-09-30T17:20:00Z": 43400,
                "2019-09-30T18:10:00Z": 29600,
                "2019-09-30T18:20:00Z": 29800,
                "2019-09-30T18:30:00Z": 29400,
                "2019-09-30T18:40:00Z": 29600,
                "2019-09-30T18:50:00Z": 29800,
                "2019-09-30T19:00:00Z": 29600,
                "2019-09-30T19:10:00Z": 29800,
                "2019-09-30T19:20:00Z": 29600,
                "2019-09-30T19:30:00Z": 29800,
                "2019-09-30T19:40:00Z": 29600,
                "2019-09-30T19:50:00Z": 29800,
                "2019-09-30T20:00:00Z": 29500,
                "2019-09-30T20:10:00Z": 29700,
                "2019-09-30T20:20:00Z": 29700,
                "2019-09-30T20:30:00Z": 29500,
                "2019-09-30T20:40:00Z": 15200,
                "2019-09-27T21:30:00Z": 6200,
                "2019-09-27T21:40:00Z": 59400,
                "2019-09-27T21:50:00Z": 59400,
                "2019-09-27T22:00:00Z": 59400,
                "2019-09-27T22:10:00Z": 59400,
                "2019-09-27T22:20:00Z": 59400,
                "2019-09-27T22:30:00Z": 59300,
                "2019-09-27T22:40:00Z": 59500,
                "2019-09-27T22:50:00Z": 59400,
                "2019-09-27T23:00:00Z": 59400,
                "2019-09-27T23:10:00Z": 59400,
                "2019-09-27T23:20:00Z": 59400,
                "2019-09-27T23:30:00Z": 59400,
                "2019-09-27T23:40:00Z": 59400,
                "2019-09-27T23:50:00Z": 59400,
                "2019-09-28T00:00:00Z": 59400,
                "2019-09-28T00:10:00Z": 59400,
                "2019-09-28T00:20:00Z": 59400,
                "2019-09-28T00:30:00Z": 59400,
                "2019-09-28T00:40:00Z": 59400,
                "2019-09-28T00:50:00Z": 59400,
                "2019-09-28T01:00:00Z": 59400,
                "2019-09-28T01:10:00Z": 59400,
                "2019-09-28T01:20:00Z": 59300,
                "2019-09-28T01:30:00Z": 59500,
                "2019-09-28T01:40:00Z": 59400,
                "2019-09-28T01:50:00Z": 58800,
                "2019-09-28T02:00:00Z": 58400,
                "2019-09-28T02:10:00Z": 59400,
                "2019-09-28T02:20:00Z": 59400,
                "2019-09-28T02:30:00Z": 59400,
                "2019-09-28T02:40:00Z": 59400,
                "2019-09-28T02:50:00Z": 59400,
                "2019-09-28T03:00:00Z": 59400,
                "2019-09-28T03:10:00Z": 59400,
                "2019-09-28T03:20:00Z": 59300,
                "2019-09-28T03:30:00Z": 59400,
                "2019-09-28T03:40:00Z": 59400,
                "2019-09-28T03:50:00Z": 58900,
                "2019-09-28T04:00:00Z": 59200,
                "2019-09-28T04:10:00Z": 59400,
                "2019-09-28T04:20:00Z": 59500,
                "2019-09-28T04:30:00Z": 59300,
                "2019-09-28T04:40:00Z": 59500,
                "2019-09-28T04:50:00Z": 59300,
                "2019-09-28T05:00:00Z": 59400,
                "2019-09-28T05:10:00Z": 59400,
                "2019-09-28T05:20:00Z": 59300,
                "2019-09-28T05:30:00Z": 58900,
                "2019-09-28T05:40:00Z": 59400,
                "2019-09-28T05:50:00Z": 59400,
                "2019-09-28T06:00:00Z": 59400,
                "2019-09-28T06:10:00Z": 59300,
                "2019-09-28T06:20:00Z": 59500,
                "2019-09-28T06:30:00Z": 59400,
                "2019-09-28T06:40:00Z": 59400,
                "2019-09-28T06:50:00Z": 59500,
                "2019-09-28T07:00:00Z": 59200,
                "2019-09-28T07:10:00Z": 59400,
                "2019-09-28T07:20:00Z": 59500,
                "2019-09-28T07:30:00Z": 59400,
                "2019-09-28T07:40:00Z": 59300,
                "2019-09-28T07:50:00Z": 59400,
                "2019-09-28T08:00:00Z": 59400,
                "2019-09-28T08:10:00Z": 59400,
                "2019-09-28T08:20:00Z": 59200,
                "2019-09-28T08:30:00Z": 58900,
                "2019-09-28T08:40:00Z": 59400,
                "2019-09-28T08:50:00Z": 59400,
                "2019-09-28T09:00:00Z": 59000,
                "2019-09-28T09:10:00Z": 59400,
                "2019-09-28T09:20:00Z": 59200,
                "2019-09-28T09:30:00Z": 59400,
                "2019-09-28T09:40:00Z": 59400,
                "2019-09-28T09:50:00Z": 59500,
                "2019-09-28T10:00:00Z": 59400,
                "2019-09-28T10:10:00Z": 59400,
                "2019-09-28T10:20:00Z": 59400,
                "2019-09-28T10:30:00Z": 59400,
                "2019-09-28T10:40:00Z": 59400,
                "2019-09-28T10:50:00Z": 59400,
                "2019-09-28T11:00:00Z": 59400,
                "2019-09-28T11:10:00Z": 59400,
                "2019-09-28T11:20:00Z": 59200,
                "2019-09-28T11:30:00Z": 59500,
                "2019-09-28T11:40:00Z": 59400,
                "2019-09-28T11:50:00Z": 59400,
                "2019-09-28T12:00:00Z": 59400,
                "2019-09-28T12:10:00Z": 59400,
                "2019-09-28T12:20:00Z": 59400,
                "2019-09-28T12:30:00Z": 59400,
                "2019-09-28T12:40:00Z": 59400,
                "2019-09-28T12:50:00Z": 59400,
                "2019-09-28T13:00:00Z": 59400,
                "2019-09-28T13:10:00Z": 59400,
                "2019-09-28T13:20:00Z": 59000,
                "2019-09-28T13:30:00Z": 59400,
                "2019-09-28T13:40:00Z": 59400,
                "2019-09-28T13:50:00Z": 59500,
                "2019-09-28T14:00:00Z": 59400,
                "2019-09-28T14:10:00Z": 59400,
                "2019-09-28T14:20:00Z": 59000,
                "2019-09-28T14:30:00Z": 59400,
                "2019-09-28T14:40:00Z": 59100,
                "2019-09-28T14:50:00Z": 59400,
                "2019-09-30T17:30:00Z": 29400,
                "2019-09-30T17:40:00Z": 29700,
                "2019-09-30T17:50:00Z": 29700,
                "2019-09-30T18:00:00Z": 29400,
                "2019-09-28T15:00:00Z": 59400,
                "2019-09-28T15:10:00Z": 59300,
                "2019-09-28T15:20:00Z": 59000,
                "2019-09-28T15:30:00Z": 59400,
                "2019-09-28T15:40:00Z": 59500,
                "2019-09-28T15:50:00Z": 59100,
                "2019-09-28T16:00:00Z": 59400,
                "2019-09-28T16:10:00Z": 59400,
                "2019-09-28T16:20:00Z": 59200,
                "2019-09-28T16:30:00Z": 59400,
                "2019-09-28T16:40:00Z": 59400,
                "2019-09-28T16:50:00Z": 59500,
                "2019-09-28T17:00:00Z": 59300,
                "2019-09-28T17:10:00Z": 59400,
                "2019-09-28T17:20:00Z": 59400,
                "2019-09-28T17:30:00Z": 59400,
                "2019-09-28T17:40:00Z": 59500,
                "2019-09-28T17:50:00Z": 58900,
                "2019-09-28T18:00:00Z": 59400,
                "2019-09-28T18:10:00Z": 59400,
                "2019-09-28T18:20:00Z": 59400,
                "2019-09-28T18:30:00Z": 59400,
                "2019-09-28T18:40:00Z": 59400,
                "2019-09-28T18:50:00Z": 59500,
                "2019-09-28T19:00:00Z": 59300,
                "2019-09-28T19:10:00Z": 59500,
                "2019-09-28T19:20:00Z": 59400,
                "2019-09-28T19:30:00Z": 59400,
                "2019-09-28T19:40:00Z": 59400,
                "2019-09-28T19:50:00Z": 59400,
                "2019-09-28T20:00:00Z": 59300,
                "2019-09-28T20:10:00Z": 59400,
                "2019-09-28T20:20:00Z": 59400,
                "2019-09-28T20:30:00Z": 59400,
                "2019-09-28T20:40:00Z": 59400,
                "2019-09-28T20:50:00Z": 59300,
                "2019-09-28T21:00:00Z": 59400,
                "2019-09-28T21:10:00Z": 59400,
                "2019-09-28T21:20:00Z": 58700,
                "2019-09-28T21:30:00Z": 58700,
                "2019-09-28T21:40:00Z": 59400,
                "2019-09-28T21:50:00Z": 59300,
                "2019-09-28T22:00:00Z": 59400,
                "2019-09-28T22:10:00Z": 58900,
                "2019-09-28T22:20:00Z": 59400,
                "2019-09-28T22:30:00Z": 59000,
                "2019-09-28T22:40:00Z": 59300,
                "2019-09-28T22:50:00Z": 59300,
                "2019-09-28T23:00:00Z": 58700,
                "2019-09-28T23:10:00Z": 59100,
                "2019-09-28T23:20:00Z": 59400,
                "2019-09-28T23:30:00Z": 59400,
                "2019-09-28T23:40:00Z": 59400,
                "2019-09-28T23:50:00Z": 59400,
                "2019-09-29T00:00:00Z": 59500,
                "2019-09-29T00:10:00Z": 59300,
                "2019-09-29T00:20:00Z": 59400,
                "2019-09-29T00:30:00Z": 59200,
                "2019-09-29T00:40:00Z": 59400,
                "2019-09-29T00:50:00Z": 59400,
                "2019-09-29T01:00:00Z": 59300,
                "2019-09-29T01:10:00Z": 59400,
                "2019-09-29T01:20:00Z": 59400,
                "2019-09-29T01:30:00Z": 59400,
                "2019-09-29T01:40:00Z": 59500,
                "2019-09-29T01:50:00Z": 59400,
                "2019-09-29T02:00:00Z": 59400,
                "2019-09-29T02:10:00Z": 59400,
                "2019-09-29T02:20:00Z": 58700,
                "2019-09-29T02:30:00Z": 59400,
                "2019-09-29T02:40:00Z": 59400,
                "2019-09-29T02:50:00Z": 59400,
                "2019-09-29T15:40:00Z": 59300,
                "2019-09-29T15:50:00Z": 59200,
                "2019-09-29T16:00:00Z": 59400,
                "2019-09-29T16:10:00Z": 59400,
                "2019-09-29T16:20:00Z": 59400,
                "2019-09-29T16:30:00Z": 59500,
                "2019-09-29T16:40:00Z": 59400,
                "2019-09-29T16:50:00Z": 59500,
                "2019-09-29T17:00:00Z": 59300,
                "2019-09-29T17:10:00Z": 59500,
                "2019-09-29T17:20:00Z": 59400,
                "2019-09-29T17:30:00Z": 59400,
                "2019-09-29T17:40:00Z": 59100,
                "2019-09-29T17:50:00Z": 59400,
                "2019-09-29T18:00:00Z": 58900,
                "2019-09-29T18:10:00Z": 59400,
                "2019-09-29T18:20:00Z": 59300,
                "2019-09-29T18:30:00Z": 59400,
                "2019-09-29T18:40:00Z": 59300,
                "2019-09-29T18:50:00Z": 59400,
                "2019-09-29T19:00:00Z": 59400,
                "2019-09-29T19:10:00Z": 59400,
                "2019-09-29T19:20:00Z": 59500,
                "2019-09-29T19:30:00Z": 59400,
                "2019-09-29T19:40:00Z": 59400,
                "2019-09-29T19:50:00Z": 59300,
                "2019-09-29T20:00:00Z": 59400,
                "2019-09-29T20:10:00Z": 59500,
                "2019-09-29T20:20:00Z": 59400,
                "2019-09-29T20:30:00Z": 59400,
                "2019-09-29T20:40:00Z": 59400,
                "2019-09-29T20:50:00Z": 59500,
                "2019-09-29T21:00:00Z": 59400,
                "2019-09-29T21:10:00Z": 59400,
                "2019-09-29T21:20:00Z": 59400,
                "2019-09-29T21:30:00Z": 59400,
                "2019-09-29T21:40:00Z": 59400,
                "2019-09-29T21:50:00Z": 59500,
                "2019-09-29T22:00:00Z": 59400,
                "2019-09-29T22:10:00Z": 59400,
                "2019-09-29T22:20:00Z": 59400,
                "2019-09-29T22:30:00Z": 59300,
                "2019-09-29T22:40:00Z": 59400,
                "2019-09-29T22:50:00Z": 59400,
                "2019-09-29T23:00:00Z": 59300,
                "2019-09-29T23:10:00Z": 59400,
                "2019-09-29T23:20:00Z": 59500,
                "2019-09-29T23:30:00Z": 58800,
                "2019-09-29T23:40:00Z": 59400,
                "2019-09-29T23:50:00Z": 59400,
                "2019-09-30T00:00:00Z": 58900,
                "2019-09-30T00:10:00Z": 59400,
                "2019-09-30T00:20:00Z": 59500,
                "2019-09-30T00:30:00Z": 59300,
                "2019-09-30T00:40:00Z": 59400,
                "2019-09-30T00:50:00Z": 59400,
                "2019-09-30T01:00:00Z": 59000,
                "2019-09-30T01:10:00Z": 59400,
                "2019-09-30T01:20:00Z": 59300,
                "2019-09-30T01:30:00Z": 59400,
                "2019-09-30T01:40:00Z": 58800,
                "2019-09-30T01:50:00Z": 59400,
                "2019-09-30T02:00:00Z": 55300,
                "2019-09-30T02:10:00Z": 59400,
                "2019-09-30T02:20:00Z": 59400,
                "2019-09-30T02:30:00Z": 56400,
                "2019-09-30T02:40:00Z": 59400,
                "2019-09-30T02:50:00Z": 59400,
                "2019-09-30T03:00:00Z": 59500,
                "2019-09-30T03:10:00Z": 59400,
                "2019-09-30T03:20:00Z": 59400,
                "2019-09-30T03:30:00Z": 59200,
                "2019-09-30T03:40:00Z": 59400,
                "2019-09-30T03:50:00Z": 59400,
                "2019-09-30T04:00:00Z": 59400,
                "2019-09-30T04:10:00Z": 59400,
                "2019-09-30T04:20:00Z": 59300,
                "2019-09-30T04:30:00Z": 59300,
                "2019-09-30T04:40:00Z": 58900,
                "2019-09-30T04:50:00Z": 59400,
                "2019-09-30T05:00:00Z": 59400,
                "2019-09-30T05:10:00Z": 59500,
                "2019-09-30T05:20:00Z": 59400,
                "2019-09-30T05:30:00Z": 59400,
                "2019-09-30T05:40:00Z": 59400,
                "2019-09-30T05:50:00Z": 59400,
                "2019-09-30T06:00:00Z": 59400,
                "2019-09-30T06:10:00Z": 59400,
                "2019-09-30T06:20:00Z": 58900,
                "2019-09-30T06:30:00Z": 59400,
                "2019-09-30T06:40:00Z": 59100,
                "2019-09-30T06:50:00Z": 59500,
                "2019-09-30T07:00:00Z": 59300,
                "2019-09-30T07:10:00Z": 59100,
                "2019-09-30T07:20:00Z": 59400,
                "2019-09-30T07:30:00Z": 59400,
                "2019-09-30T07:40:00Z": 59400,
                "2019-09-30T07:50:00Z": 59100,
                "2019-09-30T08:00:00Z": 59400,
                "2019-09-30T08:10:00Z": 59400,
                "2019-09-30T08:20:00Z": 59400,
                "2019-09-30T08:30:00Z": 56500,
                "2019-09-30T08:40:00Z": 59300,
                "2019-09-30T08:50:00Z": 57200,
                "2019-09-30T09:00:00Z": 59400,
                "2019-09-30T09:10:00Z": 59200,
                "2019-09-30T09:20:00Z": 59400,
                "2019-09-30T09:30:00Z": 59400,
                "2019-09-30T09:40:00Z": 59400,
                "2019-09-30T09:50:00Z": 59400,
                "2019-09-30T10:00:00Z": 59400,
                "2019-09-30T10:10:00Z": 58400,
                "2019-09-30T10:20:00Z": 59400,
                "2019-09-30T10:30:00Z": 59100,
                "2019-09-29T03:00:00Z": 59400,
                "2019-09-29T03:10:00Z": 59400,
                "2019-09-29T03:20:00Z": 59400,
                "2019-09-29T03:30:00Z": 59400,
                "2019-09-29T03:40:00Z": 59500,
                "2019-09-29T03:50:00Z": 59400,
                "2019-09-29T04:00:00Z": 58900,
                "2019-09-29T04:10:00Z": 59100,
                "2019-09-29T04:20:00Z": 59400,
                "2019-09-29T04:30:00Z": 59300,
                "2019-09-29T04:40:00Z": 59300,
                "2019-09-29T04:50:00Z": 59400,
                "2019-09-29T05:00:00Z": 59400,
                "2019-09-29T05:10:00Z": 59300,
                "2019-09-29T05:20:00Z": 59100,
                "2019-09-29T05:30:00Z": 59100,
                "2019-09-29T05:40:00Z": 59400,
                "2019-09-29T05:50:00Z": 59400,
                "2019-09-29T06:00:00Z": 59300,
                "2019-09-29T06:10:00Z": 59500,
                "2019-09-29T06:20:00Z": 59400,
                "2019-09-29T06:30:00Z": 59400,
                "2019-09-29T06:40:00Z": 59400,
                "2019-09-29T06:50:00Z": 58800,
                "2019-09-29T07:00:00Z": 59400,
                "2019-09-29T07:10:00Z": 59400,
                "2019-09-29T07:20:00Z": 59300,
                "2019-09-29T07:30:00Z": 59400,
                "2019-09-29T07:40:00Z": 59400,
                "2019-09-29T07:50:00Z": 59300,
                "2019-09-29T08:00:00Z": 59200,
                "2019-09-29T08:10:00Z": 59400,
                "2019-09-29T08:20:00Z": 59300,
                "2019-09-29T08:30:00Z": 59400,
                "2019-09-29T08:40:00Z": 59400,
                "2019-09-29T08:50:00Z": 59400,
                "2019-09-29T09:00:00Z": 59400,
                "2019-09-29T09:10:00Z": 59300,
                "2019-09-29T09:20:00Z": 59400,
                "2019-09-29T09:30:00Z": 59400,
                "2019-09-29T09:40:00Z": 59400,
                "2019-09-29T09:50:00Z": 59400,
                "2019-09-29T10:00:00Z": 59400,
                "2019-09-29T10:10:00Z": 59300,
                "2019-09-29T10:20:00Z": 59400,
                "2019-09-29T10:30:00Z": 59400,
                "2019-09-29T10:40:00Z": 58900,
                "2019-09-29T10:50:00Z": 59000,
                "2019-09-29T11:00:00Z": 59300,
                "2019-09-29T11:10:00Z": 59100,
                "2019-09-29T11:20:00Z": 59400,
                "2019-09-29T11:30:00Z": 59400,
                "2019-09-29T11:40:00Z": 59000,
                "2019-09-29T11:50:00Z": 59400,
                "2019-09-29T12:00:00Z": 59400,
                "2019-09-29T12:10:00Z": 59300,
                "2019-09-29T12:20:00Z": 59400,
                "2019-09-29T12:30:00Z": 59400,
                "2019-09-29T12:40:00Z": 59500,
                "2019-09-29T12:50:00Z": 59400,
                "2019-09-29T13:00:00Z": 59300,
                "2019-09-29T13:10:00Z": 59300,
                "2019-09-29T13:20:00Z": 59000,
                "2019-09-29T13:30:00Z": 59400,
                "2019-09-29T13:40:00Z": 59400,
                "2019-09-29T13:50:00Z": 59400,
                "2019-09-29T14:00:00Z": 59400,
                "2019-09-29T14:10:00Z": 59400,
                "2019-09-29T14:20:00Z": 59300,
                "2019-09-29T14:30:00Z": 59400,
                "2019-09-29T14:40:00Z": 59400,
                "2019-09-29T14:50:00Z": 59400,
                "2019-09-29T15:00:00Z": 59400,
                "2019-09-29T15:10:00Z": 59400,
                "2019-09-29T15:20:00Z": 59400,
                "2019-09-29T15:30:00Z": 58800,
                "2019-09-27T19:20:00Z": 29500,
                "2019-09-27T19:30:00Z": 19200
            },
            "range": {
                "from": "2019-09-27T19:25:03.227Z",
                "to": "2019-09-30T20:45:18.006Z"
            }
        }
    };

    public warmAvail = {
        "availability": {
            "intervalSize": "PT1M",
            "distribution": {
                "2019-09-30T11:42:00Z": 59400,
                "2019-09-30T11:43:00Z": 59400,
                "2019-09-30T11:44:00Z": 58300,
                "2019-09-30T11:45:00Z": 59300,
                "2019-09-30T11:46:00Z": 58500,
                "2019-09-30T11:47:00Z": 59000,
                "2019-09-30T12:48:00Z": 57100,
                "2019-09-30T12:49:00Z": 58500,
                "2019-09-30T12:50:00Z": 59100,
                "2019-09-30T12:51:00Z": 59100,
                "2019-09-30T12:52:00Z": 59400,
                "2019-09-30T12:53:00Z": 59300
            },
            "range": {
                "from": "2019-09-30T11:42:03.227Z",
                "to": "2019-09-30T12:54:18.006Z"
            }
        },
        "retention": "P7D"
    }

    public getEvents(token: string, environmentFqdn: string, predicateObject,  options: any, minMillis, maxMillis) {
        var uri = 'https://' + environmentFqdn + '/events' + this.apiVersionUrlParam;
        var take = 10000;
        var searchSpan = { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() };
        var topObject = { sort: [{ input: { builtInProperty: '$ts' }, order: 'Asc' }], count: take };
        var messageObject= { predicate: predicateObject, top: topObject, searchSpan: searchSpan };
        var payload = JSON.stringify(messageObject);
        return this.createPromiseFromXhr(uri, "POST", payload, token, (responseText) => {return JSON.parse(responseText).events;});
    }

    private getDataWithContinuationBatch(token, resolve, reject, rows, url, verb, propName, continuationToken = null, maxResults = Number.MAX_VALUE){
        var continuationToken, sendRequest, retryCount = 0;
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if(xhr.readyState != 4) return;

            if(xhr.status == 200){
                var message = JSON.parse(xhr.responseText);
                if(message[propName])
                    rows = rows.concat(message[propName]);

                // HACK because /instances doesn't match /items
                continuationToken = verb == 'GET' ? message.continuationToken : xhr.getResponseHeader('x-ms-continuation');

                if(!continuationToken || rows.length >= maxResults)
                    resolve(rows);
                else
                    this.getDataWithContinuationBatch(token, resolve, reject, rows, url, verb, propName, continuationToken, maxResults);
            }
            else if(xhr.status == 503 && retryCount < this.maxRetryCount){
                retryCount++;
                this.retryWithDelay(retryCount, sendRequest);
            }
            else{
                reject(xhr);
            }
        }
        sendRequest = () => {
            xhr.open(verb, url);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            if (continuationToken)
                xhr.setRequestHeader('x-ms-continuation', continuationToken);
            xhr.send(JSON.stringify({take: 100000}));
        }
        sendRequest();
    }

    private retryWithDelay(retryNumber, method) {
        let retryDelay = (Math.exp(retryNumber - 1) + Math.random()*2) * 1000;
        return setTimeout(method, retryDelay);
    }
}

export {ServerClient}
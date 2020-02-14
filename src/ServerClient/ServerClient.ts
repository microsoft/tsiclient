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
                if(httpMethod == 'POST')
                    xhr.setRequestHeader('Content-Type', 'application/json');
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

    private getQueryApiResult = (token, results, contentObject, index, uri, resolve, messageProperty, onProgressChange: (...args: any[]) => void = (percentComplete) => {}, mergeAccumulatedResults = false, xhr = null) => {
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
                    xhr.setRequestHeader('Content-Type', 'application/json');
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
                    xhr.setRequestHeader('Content-Type', 'application/json');
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
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(contentObject));
    }

    public getCancellableTsqResults (token: string, uri: string, tsqArray: Array<any>, onProgressChange: (...args: any[]) => void = () => {}, mergeAccumulatedResults = false, storeType: string = null): Array<any | Function> {
        // getTsqResults() returns either a promise or an array containing a promise + cancel trigger 
        // depending on whether we set the hasCancelTrigger flag. Here we need to set the type of what
        // we get back to 'unknown'. This lets TypeScript know that we have enough information to
        // confidently cast the return value as an Array<Promise<any> | Function>.
        let promiseAndTrigger: unknown = this.getTsqResults(token, uri, tsqArray, onProgressChange, mergeAccumulatedResults, storeType, true);
        return (promiseAndTrigger as Array<any | Function>);
    }

    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, onProgressChange: (...args: any[]) => void = () => {}, mergeAccumulatedResults = false, storeType: string = null, hasCancelTrigger = false) {
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

        if (hasCancelTrigger) {
            let cancelTrigger = () => {
                xhrs.forEach((xhr) => {
                    xhr.abort();
                });
            }
            
            return [promise, cancelTrigger];
        }
        return promise;
    }

    public getAggregates(token: string, uri: string, tsxArray: Array<any>, onProgressChange: (...args: any[]) => void = () => {}) {
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
                            availability = Utils.mergeAvailabilities(warmResponse.availability, coldResponse.availability, warmResponse.retention);
                        }
                        resolve({availability: availability});
                    })
                    .catch(() => {resolve(coldResponse)});
                } else {
                    resolve(coldResponse);
                }
            });
        });
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
            if(verb === 'POST')
                xhr.setRequestHeader('Content-Type', 'application/json');
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
import { ErrorCodes } from '../UXClient/Constants/Enums';
import Utils from '../UXClient/Utils';

type progressChange = (p: number) => void;

class ServerClient {
    private apiVersionUrlParam = "?api-version=2016-12-12";
    private oldTsmTsqApiVersion = "?api-version=2018-11-01-preview";
    private tsmTsqApiVersion = "?api-version=2020-07-31";
    private referenceDataAPIVersion = "?api-version=2017-11-15";
    public maxRetryCount = 3;
    public sessionId = Utils.guid();
    public retriableStatusCodes = [408, 429, 500, 503];
    public onAjaxError = (logObject) => {};
    public onAjaxRetry = (logObject) => {};
    public onFallbackToOldApiVersion = (logObject) => {};

    Server () {
    }

    private retryBasedOnStatus = xhr => this.retriableStatusCodes.indexOf(xhr.status) !== -1;
    private fallBackToOldApiVersion = xhr => xhr.status === 400 && xhr.response.indexOf('UnsupportedTSXVersionTSX01') !== -1;
    private setStandardHeaders = (xhr, token) => {
        let clientRequestId = Utils.guid();
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('x-ms-client-request-id', clientRequestId);
        xhr.setRequestHeader('x-ms-client-session-id', this.sessionId);
        return clientRequestId;
    }

    private createPromiseFromXhr (uri, httpMethod, payload, token, responseTextFormat, continuationToken = null) : Promise<any> {
        return new Promise((resolve: any, reject: any) => {
            let sendRequest;
            let retryCount = 0;
            let clientRequestId;
            sendRequest = () => {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = () => {
                    if(xhr.readyState != 4) return;

                    if(xhr.status >= 200 && xhr.status < 300){
                        if (xhr.responseText.length == 0)
                            resolve({});
                        else {
                            resolve(responseTextFormat(xhr.responseText));
                        }
                    }
                    else if(this.retryBasedOnStatus(xhr) && retryCount < this.maxRetryCount){
                        retryCount++;
                        this.retryWithDelay(retryCount, sendRequest);
                        this.onAjaxRetry({uri: uri, method: httpMethod, payload: JSON.stringify(payload), clientRequestId: clientRequestId, sessionId: this.sessionId, statusCode: xhr.status})
                    }
                    else{
                        reject(xhr);
                        this.onAjaxError({uri: uri, method: httpMethod, payload: JSON.stringify(payload), clientRequestId: clientRequestId, sessionId: this.sessionId})
                    }
                }
                xhr.open(httpMethod, uri);
                clientRequestId = this.setStandardHeaders(xhr, token);
                if(httpMethod == 'POST' || httpMethod == 'PUT')
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

    private getQueryApiResult = (token, results, contentObject, index, uri, resolve, messageProperty, onProgressChange : progressChange = (percentComplete) => {}, mergeAccumulatedResults = false, xhr = null) => {
        if (xhr === null) {
            xhr = new XMLHttpRequest();
        }

        var onreadystatechange;
        var retryCount = 0;
        var retryTimeout;
        var continuationToken;
        var accumulator = [];
        var clientRequestId;
        onreadystatechange = () => {
            if(xhr.readyState != 4) return;

            let fallBackToOldApiVersion = this.fallBackToOldApiVersion(xhr);
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
                    let eventCount = (results[index] && results[index].timestamps && results[index].timestamps.length) ? results[index].timestamps.length : 0;
                    let take = (contentObject && contentObject.getEvents && contentObject.getEvents.take) ? contentObject.getEvents.take : 0;
                    if(eventCount && take && eventCount === take){
                        results['moreEventsAvailable'] = true;
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
                    this.setStandardHeaders(xhr, token);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    continuationToken = message.continuationToken;
                    xhr.setRequestHeader('x-ms-continuation', continuationToken);
                    xhr.send(JSON.stringify(contentObject));
                }
            }
            else if((this.retryBasedOnStatus(xhr) && retryCount < this.maxRetryCount) || fallBackToOldApiVersion){
                retryCount += fallBackToOldApiVersion ? 0 : 1;
                retryTimeout = this.retryWithDelay(retryCount, () => {
                    if(fallBackToOldApiVersion) {
                        uri = uri.split(this.tsmTsqApiVersion).join(this.oldTsmTsqApiVersion);
                        this.onFallbackToOldApiVersion({uri: uri, payload: JSON.stringify(contentObject), clientRequestId: clientRequestId, sessionId: this.sessionId, statusCode: xhr.status});
                    }
                    xhr.open('POST', uri);
                    clientRequestId = this.setStandardHeaders(xhr, token);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    if(continuationToken)
                        xhr.setRequestHeader('x-ms-continuation', continuationToken);
                    xhr.send(JSON.stringify(contentObject));
                    this.onAjaxRetry({uri: uri, payload: JSON.stringify(contentObject), clientRequestId: clientRequestId, sessionId: this.sessionId, statusCode: xhr.status})
                });
            }
            else if (xhr.status !== 0) {
                results[index] = {__tsiError__: JSON.parse(xhr.responseText)};
                if(results.map(ar => !('progress' in ar)).reduce((p,c) => { p = c && p; return p}, true)){
                    resolve(results);
                    this.onAjaxError({uri: uri, payload: JSON.stringify(contentObject), clientRequestId: clientRequestId, sessionId: this.sessionId})
                }
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
        clientRequestId = this.setStandardHeaders(xhr, token)
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(contentObject));
    }

    public getCancellableTsqResults (token: string, uri: string, tsqArray: Array<any>, onProgressChange : progressChange = p => {}, mergeAccumulatedResults = false, storeType: string = null): Array<any | Function> {
        // getTsqResults() returns either a promise or an array containing a promise + cancel trigger 
        // depending on whether we set the hasCancelTrigger flag. Here we need to set the type of what
        // we get back to 'unknown'. This lets TypeScript know that we have enough information to
        // confidently cast the return value as an Array<Promise<any> | Function>.
        let promiseAndTrigger: unknown = this.getTsqResults(token, uri, tsqArray, onProgressChange, mergeAccumulatedResults, storeType, true);
        return (promiseAndTrigger as Array<any | Function>);
    }

    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, onProgressChange?: progressChange, mergeAccumulatedResults?: boolean, storeType?: string, hasCancelTrigger?: false): Promise<any>
    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, onProgressChange?: progressChange, mergeAccumulatedResults?: boolean, storeType?: string, hasCancelTrigger?: true): Array<any | Function>
    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, onProgressChange: progressChange = p => { }, mergeAccumulatedResults: boolean = false, storeType: string = null, hasCancelTrigger: boolean = false) {
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

    public getAggregates(token: string, uri: string, tsxArray: Array<any>, onProgressChange : progressChange = p => {}) {
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

    public postTimeSeriesTypes(token: string, environmentFqdn: string, payload: string, useOldApiVersion: boolean = false) {
        let uri = 'https://' + environmentFqdn + '/timeseries/types/$batch' + (useOldApiVersion ? this.oldTsmTsqApiVersion : this.tsmTsqApiVersion);
        return this.createPromiseFromXhr(uri, "POST", payload, token, (responseText) => {return JSON.parse(responseText);});
    }

    public updateSavedQuery(token: string, timeSeriesQuery: any, endpoint: string = 'https://api.timeseries.azure.com') {
        let uri = `${endpoint}/artifacts/${timeSeriesQuery.id}${this.tsmTsqApiVersion}`;
        let payload = JSON.stringify(timeSeriesQuery);
        return this.createPromiseFromXhr(uri, "MERGE", payload, token, (responseText) => {return JSON.parse(responseText);});
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

    public postReferenceDatasetRows(token: string, environmentFqdn: string, datasetName: string, rows: Array<any>, onProgressChange : progressChange = p => {}) {
        var uri = "https://" + environmentFqdn + "/referencedatasets/" + datasetName + "/$batch" + this.apiVersionUrlParam;
        return this.createPromiseFromXhrForBatchData(uri, JSON.stringify({put: rows}), token, (responseText) => {return JSON.parse(responseText);}, onProgressChange);
    }

    public getReferenceDatasets(token: string, resourceId: string, endpoint= "https://management.azure.com") {
        var uri = endpoint + resourceId + "/referencedatasets" + this.referenceDataAPIVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public deleteReferenceDataSet(token: string, resourceId: string, datasetName: string, endpoint= "https://management.azure.com") {
        var uri = endpoint + resourceId + "/referencedatasets/" + datasetName + this.referenceDataAPIVersion;
        return this.createPromiseFromXhr(uri, "DELETE", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public putReferenceDataSet(token: string, resourceId: string, datasetName: string, dataSet: any, endpoint= "https://management.azure.com") {
        var uri = endpoint + resourceId + "/referencedatasets/" + datasetName + this.referenceDataAPIVersion;
        return this.createPromiseFromXhr(uri, "PUT", JSON.stringify(dataSet), token, (responseText) => {return JSON.parse(responseText);});
    }

    public getGen1Environment(token: string, resourceId: string, endpoint= "https://management.azure.com"){
        var uri = endpoint + resourceId + this.referenceDataAPIVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
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
            })
            .catch(xhr => {
                reject(xhr);
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
        var continuationToken, sendRequest, clientRequestId, retryCount = 0;
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
            else if(this.retryBasedOnStatus(xhr) && retryCount < this.maxRetryCount){
                retryCount++;
                this.retryWithDelay(retryCount, sendRequest);
                this.onAjaxRetry({uri: url, method: verb, clientRequestId: clientRequestId, sessionId: this.sessionId, statusCode: xhr.status});
            }
            else{
                reject(xhr);
                this.onAjaxError({uri: url, method: verb, clientRequestId: clientRequestId, sessionId: this.sessionId});
            }
        }
        sendRequest = () => {
            xhr.open(verb, url);
            clientRequestId = this.setStandardHeaders(xhr, token);
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

    // this function returns a promise which resolve empty object after request is done and 
    // keeps track of the items and changes the values in the passed parameters 
    // based on the response if it is erroneous
    private sendBatchDataPostRequestPromise = (requestParams, batchParams) => {
        const {url, token, method, onProgressChange, batch} = requestParams;

        return new Promise((resolve) => {
            let batchObject = {};
            batchObject[method] = batch;
            
            let xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) { 
                    return;
                }

                if (xhr.status === 200 || xhr.status === 202) {
                    let result = JSON.parse(xhr.responseText);
                    if (result?.error) {
                        batchParams.erroneousDataCount += batch.length;
                        batchParams.resultErrorMessage += result.error.message ? ' Item ' + batchParams.dataIndex + "-" + (batchParams.dataIndex + batch.length) + ": " + result.error.message : '';
                        batchParams.dataIndex += batch.length;
                        return;
                    } else {
                        result[method].forEach((i) => {
                            batchParams.dataIndex++;
                            if (i?.error || i?.code === ErrorCodes.InvalidInput) {
                                batchParams.erroneousDataCount++;
                                batchParams.resultErrorMessage += `\n>Item-${batchParams.dataIndex}: ${i?.error?.message || i?.message}`;
                            }
                        });
                    }
                }
                else {
                    batchParams.erroneousDataCount += batch.length;
                    batchParams.resultErrorMessage += ' Item ' + batchParams.dataIndex + "-" + (batchParams.dataIndex + batch.length) + ": Server error!";
                    batchParams.dataIndex += batch.length;
                }
                batchParams.completedDataCount += batch.length;
                let percentComplete = batchParams.completedDataCount * 100 / batchParams.totalItemCount;
                onProgressChange(percentComplete);
                resolve({});
            };
            xhr.open('POST', url);
            this.setStandardHeaders(xhr, token);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(batchObject));
        });
    }

    private createPostBatchPromise = (url, data, token, method, responseTextFormat, onProgressChange, batchSize, maxByteSize) => {
        let batchParams = {
            dataIndex: 0,
            erroneousDataCount: 0,
            completedDataCount: 0,
            totalItemCount: data.length,
            resultErrorMessage: ''
        }

        let batches = [];
        while(data.length) {
            let batch = [];
            while (batch.length < batchSize && Utils.memorySizeOf(batch.concat(data[0])) < maxByteSize) {// create the batch of data to send based on limits provided
                batch = batch.concat(data.splice(0, 1));
                if (data.length === 0) {
                    break;
                }
            }
            
            if (batch.length) {
                batches.push(batch);
            }
        }

        //returns a promise with result object which waits for inner promises to make batch requests and resolve
        return batches.reduce((p, batch) => {
            return p.then(() => this.sendBatchDataPostRequestPromise({url, token, method, onProgressChange, batch}, batchParams)); // send batches in sequential order
         }, Promise.resolve())
         .then(() => {// construct the result of the main promise based on the batchParams variables updated through inner batch promises
            let result = {};
            if (batchParams.erroneousDataCount === 0) {
                result[method] = [{}];
            } else {
                result[method] = [{error: {code: ErrorCodes.PartialSuccess, message: "Error in " + batchParams.erroneousDataCount + "/" + batchParams.totalItemCount + ` items.  ${batchParams.resultErrorMessage}`}}];
            }
            return responseTextFormat(JSON.stringify(result));
        });
    }

    private createPromiseFromXhrForBatchData = (url, payload, token, responseTextFormat, onProgressChange = (percentComplete) => {}, batchSize = 1000, maxByteSize = 8000000) => {
        let payloadObj = JSON.parse(payload);
        if (payloadObj.put || payloadObj.update) {
            let method = payloadObj.put ? "put" : "update";
            let data = payloadObj[method];
            return this.createPostBatchPromise(url, data, token, method, responseTextFormat, onProgressChange, batchSize, maxByteSize);
        } else {
            return this.createPromiseFromXhr(url, 'POST', payload, token, (responseText) => {return JSON.parse(responseText);});
        }
    }
}

export default ServerClient
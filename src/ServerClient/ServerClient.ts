import * as Promise from 'promise-polyfill';

class ServerClient {
    private eventsWebsocket;
    private apiVersionUrlParam = "?api-version=2016-12-12";
    private tsmTsqApiVersion = "?api-version=2018-10-01-privatepreview"

    Server () {
    }

    private createPromiseFromXhr (uri, httpMethod, payload, token, responseTextFormat, continuationToken = null) {
        return new Promise((resolve: any, reject: any) => {
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
                else{
                    reject(xhr);
                }
            }
            xhr.open(httpMethod, uri);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            if (continuationToken)
                xhr.setRequestHeader('x-ms-continuation', continuationToken);
            xhr.send(payload);
        });
    }
    
    private getQueryApiResult = (token, results, contentObject, index, uri, resolve, messageProperty) => {
        var xhr = new XMLHttpRequest();
            
        xhr.onreadystatechange = () => {
            if(xhr.readyState != 4) return;
            
            if(xhr.status == 200){
                var message = JSON.parse(xhr.responseText);
                results[index] = messageProperty(message);
                if(results.map(ar => ar!=null).reduce((p,c) => { p = c && p; return p}, true))
                    resolve(results);
            }
            else{
                results[index] = {__tsiError__: JSON.parse(xhr.responseText)};
                if(results.map(ar => ar!=null).reduce((p,c) => { p = c && p; return p}, true))
                    resolve(results);
            }
        }

        xhr.open('POST', uri);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send(JSON.stringify(contentObject));
    }

    public getTsqResults(token: string, uri: string, tsqArray: Array<any>, options: any) {
        var tsqResults = [];
        tsqArray.forEach(tsq => {
            tsqResults.push(null);
        });
        
        return new Promise((resolve: any, reject: any) => {
            tsqArray.forEach((tsq, i) => {
                this.getQueryApiResult(token, tsqResults, tsq, i, `https://${uri}/timeseries/query${this.tsmTsqApiVersion}`, resolve, message => message);
            })
        });
    }
    
 
    public getAggregates(token: string, uri: string, tsxArray: Array<any>, options: any) {
        var aggregateResults = [];
        tsxArray.forEach(ae => {
            aggregateResults.push(null);
        });
        
        return new Promise((resolve: any, reject: any) => {
            tsxArray.forEach((tsx, i) => {
                this.getQueryApiResult(token, aggregateResults, tsx, i, `https://${uri}/aggregates${this.apiVersionUrlParam}`, resolve, message => message.aggregates[0]);
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
            return this.createPromiseFromXhr('https://' + environmentFqdn + '/timeseries/instances/$batch' + this.apiVersionUrlParam, "POST", JSON.stringify({get: timeSeriesIds}), token, (responseText) => {return JSON.parse(responseText);});
        }
    }
    
    public getTimeseriesTypes(token: string, environmentFqdn: string) {
        let uri = 'https://' + environmentFqdn + '/timeseries/types/' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getTimeseriesHierarchies(token: string, environmentFqdn: string) {
        let uri = 'https://' + environmentFqdn + '/timeseries/hierarchies/' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
    }

    public getTimeseriesModel(token: string, environmentFqdn: string) {
        let uri = 'https://' + environmentFqdn + '/timeseries/modelSettings/' + this.tsmTsqApiVersion;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
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

    public getMetadata(token: string, environmentFqdn: string, minMillis: number, maxMillis: number) {
        var uri = 'https://' + environmentFqdn + '/metadata' + this.apiVersionUrlParam;
        var searchSpan = {searchSpan: { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() }};
        var payload = JSON.stringify(searchSpan);
        return this.createPromiseFromXhr(uri, "POST", payload, token, (responseText) => {return JSON.parse(responseText).properties;});
    }

    public getAvailability(token: string, environmentFqdn: string) {
        var uri = 'https://' + environmentFqdn + '/availability' + this.apiVersionUrlParam;
        return this.createPromiseFromXhr(uri, "GET", {}, token, (responseText) => {return JSON.parse(responseText);});
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
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if(xhr.readyState != 4) return;
            
            if(xhr.status == 200){
                var message = JSON.parse(xhr.responseText);
                if(message[propName])
                    rows = rows.concat(message[propName]);
                
                // HACK because /instances doesn't match /items
                var continuationToken = verb == 'GET' ? message.continuationToken : xhr.getResponseHeader('x-ms-continuation');

                if(!continuationToken || rows.length >= maxResults)
                    resolve(rows);
                else
                    this.getDataWithContinuationBatch(token, resolve, reject, rows, url, verb, propName, continuationToken, maxResults);
            }
            else{
                reject(xhr);
            }
        }
        xhr.open(verb, url);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        if (continuationToken)
            xhr.setRequestHeader('x-ms-continuation', continuationToken);
        xhr.send(JSON.stringify({take: 100000}));
    }
}

export {ServerClient}
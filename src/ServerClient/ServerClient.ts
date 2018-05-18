import * as Promise from 'promise-polyfill';

class ServerClient {
    private eventsWebsocket;
    private apiVersionUrlParam = "?api-version=2016-12-12";
    
    Server () {
    }

    private createPromiseFromXhr (uri, httpMethod, payload, token, responseTextFormat) {
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
            }
            xhr.open(httpMethod, uri);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.send(payload);
        });
    }
 
    public getAggregates(token: string, uri: string, tsxArray: Array<any>, options: any) {

        var aggregateResults = [];
        tsxArray.forEach(ae => {
            aggregateResults.push(null);
        });
        
        var getAggregateResult = (contentObject, index, resolve) => {
            var xhr = new XMLHttpRequest();
            
            xhr.onreadystatechange = () => {
                if(xhr.readyState != 4) return;
                
                if(xhr.status == 200){
                    var message = JSON.parse(xhr.responseText);
                    aggregateResults[index] = message.aggregates[0];
                    if(aggregateResults.map(ar => ar!=null).reduce((p,c) => { p = c && p; return p}, true))
                        resolve(aggregateResults);
                }
            }

            xhr.open('POST', "https://" + uri + "/aggregates?api-version=2016-12-12");
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.send(JSON.stringify(contentObject));
        }
        
        return new Promise((resolve: any, reject: any) => {
            tsxArray.forEach((tsx, i) => {
                getAggregateResult(tsx, i, resolve);
            })
        })
    }

    public getReferenceDatasetRows(token: string, environmentFqdn: string, datasetId: string) {
        var rows = [];
        var getDatasetBatch = (resolve, continuationToken: string = null) => {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if(xhr.readyState != 4) return;
                
                if(xhr.status == 200){
                    var message = JSON.parse(xhr.responseText);
                    if(message.items)
                        rows = rows.concat(message.items);
                    var continuationToken = xhr.getResponseHeader('x-ms-continuation');
                    if(!continuationToken)
                        resolve(rows);
                    else
                        getDatasetBatch(resolve, continuationToken);
                }
            }

            xhr.open('POST', "https://" + environmentFqdn + "/referencedatasets/" + datasetId + "/items?api-version=2016-12-12&format=stream");
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            if (continuationToken)
                xhr.setRequestHeader('x-ms-continuation', continuationToken);
            xhr.send(JSON.stringify({take: 100000}));
        }

        return new Promise((resolve: any, reject: any) => {
            getDatasetBatch(resolve);
        });        
    }

    public getEnvironments(token: string){
        var uri = 'https://api.timeseries.azure.com/environments' + this.apiVersionUrlParam;
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

}

export {ServerClient}
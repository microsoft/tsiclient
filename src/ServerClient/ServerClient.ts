import * as Promise from 'promise-polyfill';

class ServerClient {
    private eventsWebsocket;
    private apiVersionUrlParam = "?api-version=2016-12-12";
    
    Server () {
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
        var receivedNoData = false;

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

    public getEvents(token: string, environmentFqdn: string, predicateObject,  options: any, minMillis, maxMillis) {
        var timezoneOffset = 0;
        var receivedNoData = false;

        return new Promise((resolve: any, reject: any) => {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if(xhr.readyState != 4) return;
                    
                if(xhr.status == 200){
                    if (xhr.responseText.length == 0)
                        resolve({}); 
                    else {
                        var message = JSON.parse(xhr.responseText);
                        resolve(message.events);
                    }
                }
            }

            var uri = 'https://' + environmentFqdn + '/events' + this.apiVersionUrlParam;
            xhr.open('POST', uri);
            var take = 10000;
            var searchSpan = { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() };

            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            var messageObject = {};
            var topObject = { sort: [{ input: { builtInProperty: '$ts' }, order: 'Asc' }], count: take };
            messageObject= { predicate: predicateObject, top: topObject, searchSpan: searchSpan };
            xhr.send(JSON.stringify(messageObject));
        });
    }

}

export {ServerClient}
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
    
    public destroyWebSocket (webSocket: WebSocket, shouldCancel: boolean): void {
        if (webSocket != null) {
            webSocket.onerror = null;
            webSocket.onmessage = null;
            if (webSocket.readyState === webSocket.OPEN && shouldCancel) {
                webSocket.send('{ "command" : "cancel" }');
            }
            webSocket.close();
            webSocket.onclose = null;
            console.log("WebSocket: cancelling and closing previous connection");
            webSocket = null;
        }
    }

    private nukeContent() {

    }

    private sortColumnNameAndType(t = null) {
        return 0;
    }

    public getEvents(token: string, environmentFqdn: string, predicateObject,  options: any, minMillis, maxMillis, callBack) {
        this.streamEvents(predicateObject, minMillis, maxMillis, 10000, environmentFqdn, token, callBack);
    }

    public stripForConcat(text) {
        var specialCharacters = ['"', "'", '?', '<', '>', ';'];
        specialCharacters.forEach(c => { text = text.split(c).join('') });
        return text;
    }

    // streams events to grid
    private streamEvents(predicateObject : any, minMillis: number, maxMillis: number, take: number, 
                         environmentFqdn: string, token, callBack): void {
        //TODO turn this into an option
        var timezoneOffset = 0;
        var progressPercentage = 0;
        var startStreamMs;
        var rows = [];

        this.destroyWebSocket(this.eventsWebsocket, true);
        var uri = 'wss://' + environmentFqdn + '/events' + this.apiVersionUrlParam;
        this.eventsWebsocket = new WebSocket(uri);
        this.nukeContent();
        this.sortColumnNameAndType('timestamp');
        var sortAscending = true;
        var isFirstPacket = true;

        this.eventsWebsocket.onclose = e => {
        }

        this.eventsWebsocket.onerror = e => {
            isFirstPacket = false;
            progressPercentage = 100;
        }

        // parses response for rows
        this.eventsWebsocket.onmessage = e => {

            var message = JSON.parse(e.data ? e.data : false);
            if (message && message.content) {
                if (isFirstPacket) {
                    isFirstPacket = false;
                }
                var events = message.content.events;
                progressPercentage = Math.max(1, Math.floor(1.0 * rows.length / take * 100));
                if (message.percentCompleted) {
                    progressPercentage = message.percentCompleted;
                }

                if (message.percentCompleted ? message.percentCompleted == 100 : false) {
                    var firstText = events.length == take ? 'First ' : '';
                    this.destroyWebSocket(this.eventsWebsocket, false);
                    callBack(events);
                }
            } else {
                progressPercentage = 100;
                this.destroyWebSocket(this.eventsWebsocket, false);
            }
        }

        // constructs selection and opens the websocket to stream events
        this.eventsWebsocket.onopen = () => {

            var smallerSearchSpan = { from: new Date(minMillis).toISOString(), to: new Date(maxMillis).toISOString() };

            // log this event
            startStreamMs = (new Date()).valueOf();
            isFirstPacket = true;
           
            var messageObject = {};
            var topObject = { sort: [{ input: { builtInProperty: '$ts' }, order: 'Asc' }], count: take };
            messageObject['headers'] = { 'Authorization': 'Bearer ' + token }; 
            messageObject['content'] = { predicate: predicateObject, top: topObject, searchSpan: smallerSearchSpan };
            this.eventsWebsocket.send(JSON.stringify(messageObject));
        }
    }

}

export {ServerClient}
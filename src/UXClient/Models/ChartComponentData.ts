import {Utils} from "./../Utils";

class ChartComponentData {
    public data: any = {};
    public displayState: any = {};
    public timeArrays: any = [];

    public visibleTSCount: number = 0;
    public visibleTAs: any = [];
    public allValues: any = [];
    public filteredAggregates: any;
    public usesSeconds: boolean = false;
    public usesMillis: boolean = false;
    public fromMillis: number = Infinity;
    public toMillis: number = 0;
    public stickiedKey: any = null;
    public allTimestampsArray: any;

	constructor(){
    }


    protected setAllTimestampsArray () {
        var allTimestamps = {};
        this.data.forEach(ae => {
            var aeObj = ae[Object.keys(ae)[0]];
            Object.keys(aeObj).forEach(timeseries => {
                Object.keys(aeObj[timeseries]).forEach(timestamp => {
                    allTimestamps[timestamp] = true;
                })
            })
        })
        this.allTimestampsArray = Object.keys(allTimestamps).sort();
    }

    //add colors if none present
    private fillColors (aggregateExpressionOptions) {
        if (aggregateExpressionOptions == null)
            aggregateExpressionOptions = [];
        // correct aEOs to add empty objects if the length doesn't match up with the data
        if (aggregateExpressionOptions.length < this.data.length) {
            for (var i = aggregateExpressionOptions.length; i < this.data.length; i++) {
                aggregateExpressionOptions.push({});
            }
        } 
        var colorlessCount = aggregateExpressionOptions.reduce((colorlessCount, aEO) => {
            if (aEO.color != null)
                return colorlessCount;
            return colorlessCount + 1;
        }, 0);
        var colorI = 0;
        var colors: any = Utils.generateColors(colorlessCount);
        aggregateExpressionOptions.forEach((aEO) => {
            if (aEO.color == null) {
                aEO.color = colors[colorI];
                colorI++;
            }  
        });
        return aggregateExpressionOptions;
    }

    public mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions = null, events = null, states = null ) {
        this.data = data;
        var newDisplayState = {};
        this.timeArrays = {};
        this.visibleTAs = {};
        this.allValues = [];
        this.visibleTSCount = 0;
        this.fromMillis = Infinity;
        this.toMillis = 0;
        var aggregateCounterMap = {};

        this.usesSeconds = false;
        this.usesMillis = false;
        aggregateExpressionOptions = this.fillColors(aggregateExpressionOptions);
        this.data.forEach((aggregate: any, i: number) => {
            var aggName: string = Object.keys(aggregate)[0];
            
            //construct the aggregate key based on the aggregate index and name
            var aggKey;
            if (aggregateCounterMap[aggName]) {
                aggKey = Utils.createEntityKey(aggName, aggregateCounterMap[aggName]);
                aggregateCounterMap[aggName] += 1;
            } else {
                aggKey = Utils.createEntityKey(aggName, 0);
                aggregateCounterMap[aggName] = 1;
            }

            aggregate.aggKey = aggKey;

            if (this.displayState[aggKey]) {
                newDisplayState[aggKey] = {
                    visible: this.displayState[aggKey].visible,
                    name: this.displayState[aggKey].name,
                    color: ((aggregateExpressionOptions[i] && aggregateExpressionOptions[i].color) ? 
                             aggregateExpressionOptions[i].color : this.displayState[aggKey].color),
                    splitBys: []
                }
            } else {
                newDisplayState[aggKey] = {
                    visible: true,
                    splitBys: [],
                    name: aggName,
                    color: ((aggregateExpressionOptions[i] && aggregateExpressionOptions[i].color) ? 
                             aggregateExpressionOptions[i].color : "teal")
                }                    
            } 
            if (aggregateExpressionOptions) {
                newDisplayState[aggKey].contextMenuActions = aggregateExpressionOptions[i] ? 
                                                aggregateExpressionOptions[i].contextMenu : [];
                newDisplayState[aggKey].aggregateExpression = aggregateExpressionOptions[i];
            } else {
                //revert to previous context menu actions if no new ones passed in and old ones exist
                var oldContextMenuActions = (this.displayState[aggKey] && this.displayState[aggKey].contextMenuActions) ? 
                                                this.displayState[aggKey].contextMenuActions : [];
                newDisplayState[aggKey].contextMenuActions = oldContextMenuActions;
                var oldAggregateExpression = (this.displayState[aggKey] && this.displayState[aggKey].aggregateExpression) ? 
                                                this.displayState[aggKey].aggregateExpression : {};
                newDisplayState[aggKey].aggregateExpression = oldAggregateExpression;
            }
            if (newDisplayState[aggKey].aggregateExpression && newDisplayState[aggKey].aggregateExpression.searchSpan) {
                newDisplayState[aggKey].from = new Date(newDisplayState[aggKey].aggregateExpression.searchSpan.from);
                newDisplayState[aggKey].to = new Date(newDisplayState[aggKey].aggregateExpression.searchSpan.to);
                newDisplayState[aggKey].bucketSize = newDisplayState[aggKey].aggregateExpression.searchSpan.bucketSize ?
                    Utils.parseTimeInput(newDisplayState[aggKey].aggregateExpression.searchSpan.bucketSize) : 
                    null;
            }

            var aggregateVisible = newDisplayState[aggKey].visible;
            this.timeArrays[aggKey] = [];
            this.visibleTAs[aggKey] = {};
            Object.keys(data[i][aggName]).forEach((splitBy: string) => {
                this.timeArrays[aggKey][splitBy] = 
                    this.convertAggregateToArray(data[i][aggName][splitBy], aggKey, aggName, splitBy, 
                                                 newDisplayState[aggKey].from, newDisplayState[aggKey].to, 
                                                 newDisplayState[aggKey].bucketSize);
                if (this.displayState[aggKey] && this.displayState[aggKey].splitBys[splitBy]) {
                    newDisplayState[aggKey].splitBys[splitBy] = this.displayState[aggKey].splitBys[splitBy];
                } else {
                    newDisplayState[aggKey].splitBys[splitBy] = {
                        visible: true,
                        visibleType : null,
                        types : []
                    }
                }
                if (this.timeArrays[aggKey][splitBy] && this.timeArrays[aggKey][splitBy].length && 
                    newDisplayState[aggKey].aggregateExpression && newDisplayState[aggKey].aggregateExpression.measureTypes) {
                    newDisplayState[aggKey].splitBys[splitBy].types = newDisplayState[aggKey].aggregateExpression.measureTypes
                } else {
                    newDisplayState[aggKey].splitBys[splitBy].types = this.determineMeasureTypes(this.timeArrays[aggKey][splitBy])
                }
                if (!newDisplayState[aggKey].splitBys[splitBy].visibleType || (newDisplayState[aggKey].splitBys[splitBy].types.indexOf(newDisplayState[aggKey].splitBys[splitBy].visibleType) === -1)){
                    var visibleMeasure = newDisplayState[aggKey].splitBys[splitBy].types.indexOf("avg") != -1 ? "avg" : 
                        newDisplayState[aggKey].splitBys[splitBy].types[0];
                    newDisplayState[aggKey].splitBys[splitBy].visibleType = visibleMeasure;
                }

                //add to visible display states if splitby is visible
                if (newDisplayState[aggKey]["splitBys"][splitBy]["visible"] && aggregateVisible) {
                    this.allValues = this.allValues.concat(this.timeArrays[aggKey][splitBy]);
                    this.usesSeconds = this.usesSeconds || this.doesTimeArrayUseSeconds(this.timeArrays[aggKey][splitBy]);
                    this.usesMillis = this.usesMillis || this.doesTimeArrayUseMillis(this.timeArrays[aggKey][splitBy]);
                    this.visibleTAs[aggKey][splitBy] = this.timeArrays[aggKey][splitBy];
                    this.visibleTSCount += 1;
                }
            });
        });

        //ensure that the stickied Key exists in the new data, otherwise revert to null
        if (this.stickiedKey) {
            var splitBy = this.stickiedKey.splitBy;
            var aggKey = this.stickiedKey.aggregateKey;
            if (!(newDisplayState[aggKey] && newDisplayState[aggKey].visible &&
                 newDisplayState[aggKey].splitBys[splitBy] && newDisplayState[aggKey].splitBys[splitBy].visible)) {
                this.stickiedKey = null;
            }
        }

        this.displayState = newDisplayState;
        this.setAllTimestampsArray();
    }

    private determineMeasureTypes (timeArray) {
        var measureTypes = timeArray.reduce((measureTypes, curr) => {
            if (curr && Object.keys(curr.measures).length) {
                Object.keys(curr.measures).forEach((measure) => {
                    measureTypes[measure] = true;
                });
            }
            return measureTypes;
        }, {});
        return Object.keys(measureTypes);
    }

    public doesTimeArrayUseSeconds (timeArray) {
        return timeArray.reduce((prev, curr) => {
            return curr.dateTime.getSeconds() != 0 || prev;
        }, false);
    }

    public doesTimeArrayUseMillis (timeArray) {
        return timeArray.reduce((prev, curr) => {
            return curr.dateTime.getMilliseconds() != 0 || prev;
        }, false);
    }

    //returns the from and to of all values
    public setAllValuesAndVisibleTAs () {
        var toMillis = 0;
        var fromMillis = Infinity;
        this.allValues = [];
        this.visibleTAs = [];
        this.visibleTSCount = 0;
        Object.keys(this.timeArrays).forEach((aggKey: string) => {
            if (this.getAggVisible(aggKey)) {
                this.visibleTAs[aggKey] = {};
                Object.keys(this.timeArrays[aggKey]).forEach((splitBy) => {
                    if (this.getSplitByVisible(aggKey, splitBy)) {
                        this.allValues = this.allValues.concat(this.timeArrays[aggKey][splitBy]);
                        this.visibleTAs[aggKey][splitBy] = this.timeArrays[aggKey][splitBy];
                        this.visibleTSCount += 1;

                        this.timeArrays[aggKey][splitBy].forEach((d) => {
                            var millis = d.dateTime.valueOf();
                            var bucketSize = this.displayState[aggKey].bucketSize;
                            if (millis < fromMillis)
                                fromMillis = millis;
                            var endValue = bucketSize ? millis + bucketSize : millis;
                            if (endValue > toMillis)
                                toMillis = endValue;
                        });
                        this.usesSeconds = this.usesSeconds || this.doesTimeArrayUseSeconds(this.timeArrays[aggKey][splitBy]);
                        this.usesMillis = this.usesMillis || this.doesTimeArrayUseMillis(this.timeArrays[aggKey][splitBy]);
                    }
                });
            }            
        });
        //set this.toMillis and this.fromMillis if new values are more extreme 
        this.toMillis = (toMillis > this.toMillis) ? toMillis : this.toMillis;
        this.fromMillis = (fromMillis < this.fromMillis) ? fromMillis : this.fromMillis;
        return [new Date(this.fromMillis), new Date(this.toMillis)];
    }

    private findFirstBucket (agg, fromMillis, bucketSize) {
        if (agg == null || Object.keys(agg).length == 0)
            return null;
        var firstKey = Object.keys(agg).filter((a) => {
            return ((new Date(a)).valueOf() + bucketSize) > fromMillis; 
        }).sort((a, b) => {
            if ((new Date(a)).valueOf() < (new Date(b)).valueOf())
                return -1;
            if ((new Date(a)).valueOf() > (new Date(b)).valueOf())
                return 1;
            return 0;
        })[0];

        var currMillis = firstKey.valueOf();
        if (currMillis <= fromMillis)
            return currMillis;
        while(currMillis > fromMillis) {
            currMillis += -bucketSize;
        }
        return currMillis;
    }

    //aggregates object => array of objects containing timestamp and values. Pad with 
    public convertAggregateToArray (agg: any, aggKey: string, aggName: string, splitBy: string, 
                                    from: Date = null, to: Date = null, bucketSize: number = null): Array<any> {
        var aggArray: Array<any> = [];
        var createTimeValueObject = () => {
            var timeValueObject: any = {};
            timeValueObject["aggregateKey"] = aggKey;
            timeValueObject["aggregateName"] = aggName;
            timeValueObject["splitBy"] = splitBy;
            timeValueObject["measures"] = {};
            timeValueObject["bucketSize"] = bucketSize;
            return timeValueObject;
        }

        if (from)
            this.fromMillis = Math.min(from.valueOf(), this.fromMillis);
        if (to)
            this.toMillis = Math.max(to.valueOf(), this.toMillis);
        if (from && to && bucketSize) {
            var firstBucketMillis = this.findFirstBucket(agg, from.valueOf(), bucketSize);
            if (firstBucketMillis != null) {
                for (var currTime = new Date(firstBucketMillis); (currTime.valueOf() < to.valueOf()); currTime = new Date(currTime.valueOf() + bucketSize)) {
                    var timeValueObject: any = createTimeValueObject();
                    timeValueObject["dateTime"] = currTime;
                    var currTimeString = currTime.toISOString();
                    var strippedTimeString = currTimeString.slice(0, -5) + "Z"; // without second decimals
                    if (agg[currTimeString] || agg[strippedTimeString]) {
                        var currMeasures = agg[currTimeString] ? agg[currTimeString] : agg[strippedTimeString];
                        Object.keys(currMeasures).forEach((measure: string) => {
                            timeValueObject["measures"][measure] = currMeasures[measure];
                        });
                    } else {
                        timeValueObject["measures"] = null;
                    }
                    aggArray.push(timeValueObject);
                    this.fromMillis = Math.min(from.valueOf(), currTime.valueOf());
                    this.toMillis = Math.max(to.valueOf(), currTime.valueOf() + bucketSize);
                }
            }
        } else {
            Object.keys(agg).sort().forEach((dateTime: string) => {
                var timeValueObject: any = createTimeValueObject();
                timeValueObject["dateTime"] = new Date(dateTime);
                Object.keys(agg[dateTime]).forEach((measure: string) => {
                    timeValueObject["measures"][measure] = agg[dateTime][measure];
                });
                aggArray.push(timeValueObject);
            });
        }

        return aggArray;
    }


    public isSplitByVisible(aggI: string, splitBy: string) {
        if (this.displayState[aggI] == undefined || !this.displayState[aggI].visible)
            return false;
        if (this.displayState[aggI].splitBys[splitBy] == undefined)
            return false;
        return this.displayState[aggI].splitBys[splitBy].visible;
    }

    public isPossibleEnvelope(aggKey: string, splitBy: string) {
        return (this.displayState[aggKey].splitBys[splitBy].visibleType == "avg") &&
            (this.displayState[aggKey].splitBys[splitBy].types.indexOf("min") != -1) &&
            (this.displayState[aggKey].splitBys[splitBy].types.indexOf("max") != -1);
    }

    public getVisibleMeasure(aggI: string, splitBy: string) {
        if (this.displayState[aggI] == undefined || this.displayState[aggI].splitBys[splitBy] == undefined)
            return null;
        return this.displayState[aggI].splitBys[splitBy].visibleType;
    }

    public getAggVisible (aggKey): boolean {
        return this.displayState[aggKey].visible;
    } 
    
    public getSplitByVisible(aggKey, splitBy) {
        return (this.getAggVisible(aggKey) && this.displayState[aggKey].splitBys[splitBy].visible); 
    }

    public aggHasVisibleSplitBys (aggKey) {
        if (!this.getAggVisible(aggKey))
            return false;
        var hasVisibleSplitBy = false;
        Object.keys(this.displayState[aggKey].splitBys).forEach((splitBy) => {
            if (this.isSplitByVisible(aggKey, splitBy))
                hasVisibleSplitBy = true;
        });
        return hasVisibleSplitBy;
    }

    public valueAtTS (aggKey, splitByName, ts) {
        var splitBy = this.displayState[aggKey].splitBys[splitByName];
        return this.data[aggKey][this.displayState[aggKey].name][splitByName][ts][splitBy.visibleType];
    }

    public setFilteredAggregates () {
        this.filteredAggregates = Object.keys(this.displayState).filter((aggKey) => {
            return this.displayState[aggKey].visible;
        });
    }
    

    public generateCSVString (offset: number = 0): string {

        //replace comma at end of line with end line character
        var endLine = (s: string): string => {
            return s.slice(0, s.length - 1) + "\n";
        }

        var csvString = "";
        var headerString = "Interval,";

        var rowMap = {};
        var rowOrder = [];
        this.data.forEach(aggObj => {
            var aggKey = aggObj.aggKey;
            var splitByObject = this.displayState[aggKey].aggregateExpression.splitByObject;
            Object.keys(this.timeArrays[aggKey]).forEach((splitBy) => {
                
                var splitByString = this.displayState[aggKey].name;
                if (splitByObject != null) {
                    splitByString += "/" + splitByObject.property + "/" + splitBy;
                }
                this.displayState[aggKey].splitBys[splitBy].types.forEach((type) => {
                    var rowKey = aggKey + "_" + splitBy + "_" + type; 
                    rowMap[rowKey] = { };
                    rowOrder.push(rowKey);
                    headerString += splitByString + "." + type + ",";
                });
            });
        });

        csvString = endLine(headerString);

        this.allValues.forEach((value) => {
            if (value.measures && Object.keys(value.measures).length != 0) {
                Object.keys(value.measures).forEach((type) => {
                    var rowKey = value.aggregateKey + "_" + value.splitBy + "_" + type;
                    rowMap[rowKey][value.dateTime.valueOf()] = 
                        (value.measures[type] == null || value.measures[type] == undefined) ? 
                        "" : value.measures[type];
                });
            }
        });
        

        this.allTimestampsArray.forEach((timeString: string) => {
            var millis = (new Date(timeString)).valueOf();
            csvString += Utils.timeFormat(this.usesSeconds, this.usesMillis, offset)(new Date(millis)) + ",";
            rowOrder.forEach((rowKey) => {
                csvString += (rowMap[rowKey][millis] != undefined ? rowMap[rowKey][millis] : "")  + ",";
            });
            csvString = endLine(csvString);
        });
        
        return csvString;
    }
}
export {ChartComponentData}

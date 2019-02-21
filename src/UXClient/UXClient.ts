import {LineChart} from "./Components/LineChart/LineChart";
import {AvailabilityChart} from "./Components/AvailabilityChart/AvailabilityChart";
import {PieChart} from "./Components/PieChart/PieChart";
import {GroupedBarChart} from "./Components/GroupedBarChart/GroupedBarChart";
import {Grid} from "./Components/Grid/Grid";
import {Slider} from "./Components/Slider/Slider";
import {EventSeries} from "./Components/EventSeries/EventSeries";
import {StateSeries} from "./Components/StateSeries/StateSeries";
import {Hierarchy} from "./Components/Hierarchy/Hierarchy";
import {AggregateExpression} from "./Models/AggregateExpression";
import {Heatmap} from "./Components/Heatmap/Heatmap";
import {EventsTable} from "./Components/EventsTable/EventsTable";
import {ModelSearch} from "./Components/ModelSearch/ModelSearch"; 
import {DateTimePicker} from "./Components/DateTimePicker/DateTimePicker";
import {TimezonePicker} from "./Components/TimezonePicker/TimezonePicker";

import {Utils} from "./Utils";
import './styles.scss'
import { EllipsisMenu } from "./Components/EllipsisMenu/EllipsisMenu";
import { TsqExpression } from "./Models/TsqExpression";
import { ModelAutocomplete } from "./Components/ModelAutocomplete/ModelAutocomplete";

class UXClient {
    UXClient () {
    }

    public DateTimePicker(renderTarget) {
        return new DateTimePicker(renderTarget);
    }

    public PieChart(renderTarget) {
        return new PieChart(renderTarget);
    }
    
    public BarChart(renderTarget){
        return new GroupedBarChart(renderTarget);
    }

    public LineChart(renderTarget){
        return new LineChart(renderTarget);
    }

    public AvailabilityChart(renderTarget){
        return new AvailabilityChart(renderTarget);
    }
    
    public Grid(renderTarget){
        return new Grid(renderTarget);
    }
    
    public Slider(renderTarget){
        return new Slider(renderTarget);
    }

    public EventSeries(renderTarget) {
        return new EventSeries(renderTarget);
    }

    public StateSeries(renderTarget) {
        return new StateSeries(renderTarget);
    }

    public Hierarchy(renderTarget) {
        return new Hierarchy(renderTarget);
    }

    public AggregateExpression(predicateObject: any, measureObject: any, measureTypes: Array<string>, searchSpan: any, 
                                        splitByObject: any = null, color: string = null, alias: string = '', 
                                        contextMenu: Array<any> = [], visibilityState: Array<any> = null, interpolationFunction: string = '', includeEnvelope: boolean = false): any {
        return new AggregateExpression(predicateObject, measureObject, measureTypes, searchSpan, splitByObject, color, 
                                        alias, contextMenu, visibilityState, interpolationFunction, includeEnvelope);
    }

    public TsqExpression(instanceObject: any, variableObject: any, searchSpan: any, 
        color: string = Utils.generateColors(1)[0], alias: string = 'Expression1', contextMenu: Array<any> = [], interpolationFunction: string = '', includeEnvelope: boolean = false){
            return new TsqExpression(instanceObject, variableObject, searchSpan, color, alias, contextMenu);
    }

    public Heatmap(renderTarget) {
        return new Heatmap(renderTarget);
    }

    public EventsTable(renderTarget) {
        return new EventsTable(renderTarget);
    }

    public ModelSearch(renderTarget) {
        return new ModelSearch(renderTarget);
    }

    public ModelAutocomplete(renderTarget) {
        return new ModelAutocomplete(renderTarget);
    }

    public TimezonePicker(renderTarget) {
        return new TimezonePicker(renderTarget);
    }

    public EllipsisMenu(renderTarget) {
        return new EllipsisMenu(renderTarget);
    }

    public transformTsxToEventsArray (events, options) {
        var timezoneOffset = options.timezoneOffset ? options.timezoneOffset : 0;
        var rows = [];
        var eventSourceProperties = {};
        var nameToStrippedPropName = {};
        var valueToStrippedValueMap = {};
        for (var eventIdx in events) {
            var eventSourceId;
            if (events[eventIdx].hasOwnProperty('schema')) {
                eventSourceProperties[events[eventIdx].schema.rid] = {};
                eventSourceProperties[events[eventIdx].schema.rid].propertyNames = events[eventIdx].schema.properties.reduce(function(prev, curr) {
                    prev.push({ name: curr.name, type: curr.type });
                    return prev;
                }, []);
                eventSourceProperties[events[eventIdx].schema.rid].eventSourceName = events[eventIdx].schema['$esn'];
                eventSourceId = events[eventIdx].schema.rid;
            } else {
                eventSourceId = events[eventIdx].schemaRid;
            }

            var timeStamp = (new Date((new Date(events[eventIdx]['$ts'])).valueOf() - timezoneOffset)).toISOString().slice(0,-1).replace('T', ' ');
            var event = { 'timestamp ($ts)': timeStamp };

            // lts logic
            var lts = events[eventIdx]['$lts'] ? events[eventIdx]['$lts'] : null;
            if (lts) {
                event['LocalTimestamp_DateTime'] = {
                    value: lts.replace('T', ' '),
                    name: 'LocalTimestamp',
                    type: 'DateTime'
                }
            }

            event["EventSourceName_String"] = {
                value: eventSourceProperties[eventSourceId].eventSourceName,
                name: 'EventSourceName',
                type: 'String'
            };
            for (var propIdx in eventSourceProperties[eventSourceId].propertyNames) {
                var name = eventSourceProperties[eventSourceId].propertyNames[propIdx].name;
                if (!nameToStrippedPropName.hasOwnProperty(name))
                    nameToStrippedPropName[name] = Utils.stripForConcat(name);
                var strippedName = nameToStrippedPropName[name];
                var type = eventSourceProperties[eventSourceId].propertyNames[propIdx].type;
                var columnNameAndType = strippedName + "_" + type;
                if (!valueToStrippedValueMap.hasOwnProperty(String(events[eventIdx].values[propIdx])))
                    valueToStrippedValueMap[String(events[eventIdx].values[propIdx])] = Utils.stripForConcat(String(events[eventIdx].values[propIdx]));
                var eventObject = {
                    value: valueToStrippedValueMap[String(events[eventIdx].values[propIdx])],
                    name: strippedName,
                    type: type
                }
                event[columnNameAndType] = eventObject;
            }
            rows.push(event);
        }
        return rows;
    }
    
    private toISONoMillis (dateTime) {
        return dateTime.toISOString().slice(0,-5)+"Z";
    }

    //specifiedRange gives the subset of availability buckets to be returned. If not included, will return all buckets
    public transformAvailabilityForVisualization(availabilityTsx: any): Array<any> {
        var from = new Date(availabilityTsx.range.from);
        var to = new Date(availabilityTsx.range.to);
        var rawBucketSize = Utils.parseTimeInput(availabilityTsx.intervalSize);

        var buckets = {};
        var startBucket = Math.round(Math.floor(from.valueOf() / rawBucketSize) * rawBucketSize);
        var firstKey = this.toISONoMillis(new Date(startBucket));
        var firstCount = availabilityTsx.distribution[firstKey] ? availabilityTsx.distribution[firstKey] : 0;
        
        // reset first key if greater than the availability range from
        if (startBucket < (new Date(availabilityTsx.range.from)).valueOf())
            firstKey = this.toISONoMillis(new Date(availabilityTsx.range.from));
        buckets[firstKey] = {count: firstCount }

        Object.keys(availabilityTsx.distribution).forEach(key => {
            var formattedISO = this.toISONoMillis(new Date(key));
            buckets[formattedISO] = {count: availabilityTsx.distribution[key]};
        });

        //set end time value
        var lastBucket = Math.round(Math.floor(to.valueOf() / rawBucketSize) * rawBucketSize);
        buckets[this.toISONoMillis(to)] = (buckets[this.toISONoMillis(new Date(lastBucket))] != undefined) ? 
                                            buckets[this.toISONoMillis(new Date(lastBucket))] : 
                                            {count : 0};

        // pad out if range is less than one bucket;
        if (startBucket == lastBucket) {
            for(var i = startBucket; i <= startBucket + rawBucketSize; i += (rawBucketSize / 60)) {
                if (buckets[this.toISONoMillis(new Date(i))] == undefined)
                    buckets[this.toISONoMillis(new Date(i))] = {count : 0};
            }
            //reset startBucket to count 0 if not the start time
            if (startBucket != from.valueOf()) {
                buckets[this.toISONoMillis(new Date(startBucket))] = {count : 0}
            }
        }
        return [{"availabilityCount" : {"" : buckets}}];
    }

    public transformTsqResultsForVisualization(tsqResults: Array<any>, options): Array<any> {
        var result = [];
        tsqResults.forEach((tsqr, i) => {
            var transformedAggregate = {};
            var aggregatesObject = {};
            transformedAggregate[options[i].alias] = {'': aggregatesObject};
            
            if(tsqr.hasOwnProperty('__tsiError__'))
                transformedAggregate[''] = {};
            else{
                tsqr.timestamps.forEach((ts, j) => {
                    aggregatesObject[ts] = tsqr.properties.reduce((p,c) => {p[c.name] = c['values'][j]; return p;}, {});
                }); 
            }
            result.push(transformedAggregate);
        });
        return result;
    }

    public transformAggregatesForVisualization(aggregates: Array<any>, options): Array<any> {
        var result = [];
        aggregates.forEach((agg, i) => {
            var transformedAggregate = {};
            var aggregatesObject = {};
            transformedAggregate[options[i].alias] = aggregatesObject;
            
            if(agg.hasOwnProperty('__tsiError__'))
                transformedAggregate[''] = {};
            else if(agg.hasOwnProperty('aggregate')){
                agg.dimension.forEach((d, j) => {
                    var dateTimeToValueObject = {};
                    aggregatesObject[d] = dateTimeToValueObject;
                    agg.aggregate.dimension.forEach((dt, k) => {
                        var measuresObject = {};
                        dateTimeToValueObject[dt] = measuresObject;
                        options[i].measureTypes.forEach((t,l) => {
                            if (agg.aggregate.measures[j][k] != null && agg.aggregate.measures[j][k] != undefined && 
                                agg.aggregate.measures[j][k][l] != null && agg.aggregate.measures[j][k][l] != undefined)
                                measuresObject[t] = agg.aggregate.measures[j][k][l];
                            else
                                measuresObject[t] = null;
                        }) 
                    })
                })
            }
            else{
                var dateTimeToValueObject = {};
                aggregatesObject[''] = dateTimeToValueObject;
                agg.dimension.forEach((dt,j) => {
                    var measuresObject = {};
                    dateTimeToValueObject[dt] = measuresObject;
                    options[i].measureTypes.forEach((t,l) => {
                        measuresObject[t] = agg.measures[j][l];
                    }) 
                })     
            }
            
            result.push(transformedAggregate);
        });
        return result;
    }

    // exposed publicly to use for highlighting elements in the well on hover/focus
    public createEntityKey (aggName: string, aggIndex: number = 0) {
        return Utils.createEntityKey(aggName, aggIndex);
    }

    public transformTsqResultsToEventsArray (results) {
        let flattenedResults = [];
        results.forEach(tsqr => {
            tsqr.timestamps.forEach((ts, idx) => {
                let event = {};
                event['timestamp ($ts)'] = ts;
                tsqr.properties.forEach(p => {
                    event[`${p.name}_${p.type}`] = {name: p.name, type: p.type, value: p.values[idx]};
                });
                flattenedResults.push(event); 
            });
        });
        return flattenedResults.sort((a,b) => (new Date(a['timestamp ($ts)'])).valueOf() < (new Date(b['timestamp ($ts)_DateTime'])).valueOf() ? -1 : 1);
    }
}


export {UXClient}
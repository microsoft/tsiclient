import LineChart from "./Components/LineChart/LineChart";
import AvailabilityChart from "./Components/AvailabilityChart/AvailabilityChart";
import PieChart from "./Components/PieChart/PieChart";
import ScatterPlot from "./Components/ScatterPlot/ScatterPlot";
import GroupedBarChart from "./Components/GroupedBarChart/GroupedBarChart";
import Grid from "./Components/Grid/Grid";
import Slider from "./Components/Slider/Slider";
import Hierarchy from "./Components/Hierarchy/Hierarchy";
import AggregateExpression from "./Models/AggregateExpression";
import Heatmap from "./Components/Heatmap/Heatmap";
import EventsTable from "./Components/EventsTable/EventsTable";
import ModelSearch from "./Components/ModelSearch/ModelSearch"; 
import DateTimePicker from "./Components/DateTimePicker/DateTimePicker";
import TimezonePicker from "./Components/TimezonePicker/TimezonePicker";
import Utils from "./Utils";
import './styles.scss'
import  EllipsisMenu  from "./Components/EllipsisMenu/EllipsisMenu";
import  TsqExpression  from "./Models/TsqExpression";
import  ModelAutocomplete  from "./Components/ModelAutocomplete/ModelAutocomplete";
import  HierarchyNavigation  from "./Components/HierarchyNavigation/HierarchyNavigation";
import  SingleDateTimePicker  from "./Components/SingleDateTimePicker/SingleDateTimePicker";
import  DateTimeButtonSingle  from "./Components/DateTimeButtonSingle/DateTimeButtonSingle";
import  DateTimeButtonRange  from "./Components/DateTimeButtonRange/DateTimeButtonRange";
import  ProcessGraphic  from './Components/ProcessGraphic/ProcessGraphic';
import  PlaybackControls  from './Components/PlaybackControls/PlaybackControls';
import  ColorPicker  from "./Components/ColorPicker/ColorPicker";
import  GeoProcessGraphic  from "./Components/GeoProcessGraphic/GeoProcessGraphic";
import { transformTsqResultsForVisualization } from "./Utils/Transformers";

class UXClient {
    UXClient () {
    }

    // Public facing components have class constructors exposed as public UXClient members.
    // This allows for typings to be bundled while maintaining 'new Component()' syntax
    public DateTimePicker: typeof DateTimePicker = DateTimePicker;
    public PieChart: typeof PieChart = PieChart;
    public ScatterPlot: typeof ScatterPlot = ScatterPlot;
    public BarChart: typeof GroupedBarChart = GroupedBarChart;
    public LineChart: typeof LineChart = LineChart;
    public AvailabilityChart: typeof AvailabilityChart = AvailabilityChart;
    public Grid: typeof Grid = Grid;
    public Slider: typeof Slider = Slider;
    public Hierarchy: typeof Hierarchy = Hierarchy;
    public AggregateExpression: typeof AggregateExpression = AggregateExpression;
    public TsqExpression: typeof TsqExpression = TsqExpression;
    public Heatmap: typeof Heatmap = Heatmap;
    public EventsTable: typeof EventsTable = EventsTable;
    public ModelSearch: typeof ModelSearch = ModelSearch;
    public ModelAutocomplete: typeof ModelAutocomplete = ModelAutocomplete;
    public HierarchyNavigation: typeof HierarchyNavigation = HierarchyNavigation;
    public TimezonePicker: typeof TimezonePicker = TimezonePicker;
    public EllipsisMenu: typeof EllipsisMenu = EllipsisMenu;
    public SingleDateTimePicker: typeof SingleDateTimePicker = SingleDateTimePicker;
    public DateTimeButtonSingle: typeof DateTimeButtonSingle = DateTimeButtonSingle;
    public DateTimeButtonRange: typeof DateTimeButtonRange = DateTimeButtonRange;
    public ProcessGraphic: typeof ProcessGraphic = ProcessGraphic;
    public PlaybackControls: typeof PlaybackControls = PlaybackControls;
    public ColorPicker: typeof ColorPicker = ColorPicker;
    public GeoProcessGraphic: typeof GeoProcessGraphic = GeoProcessGraphic;

    public transformTsqResultsForVisualization: typeof transformTsqResultsForVisualization = transformTsqResultsForVisualization;

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
            if (events[eventIdx].hasOwnProperty('$op')) {
                let defaultType = 'String';
                let otherProps = JSON.parse(events[eventIdx]['$op']);
                Object.keys(otherProps).forEach((propNameRaw) => {
                    let strippedNameOP = Utils.stripForConcat(propNameRaw);
                    let columnNameAndTypeOP = strippedNameOP + '_String';
                    event[columnNameAndTypeOP] = {
                        value: otherProps[propNameRaw],
                        name: strippedNameOP,
                        type: defaultType
                    }
                });
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
        return flattenedResults.sort((a,b) => (new Date(a['timestamp ($ts)'])).valueOf() < (new Date(b['timestamp ($ts)'])).valueOf() ? -1 : 1);
    }
}


export default UXClient
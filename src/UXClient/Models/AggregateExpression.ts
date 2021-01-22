import Utils from "../Utils";
import { ChartDataOptions } from "./ChartDataOptions";

const MAXCARD = 150000;

class AggregateExpression extends ChartDataOptions {
    public measureObject: any;
    public splitByObject;
    public predicate: Object; // predicate TSX
    public visibleSplitByCap: number = 10;

	constructor(predicateObject: any, measureObject: any, measureTypes: Array<string>, searchSpan: any, splitByObject: any = null, 
                colorOrOptionsObject: any, alias?: string, contextMenu?: Array<any>){
        super((typeof(colorOrOptionsObject) === 'object' && !!colorOrOptionsObject) ? {...colorOrOptionsObject, searchSpan: searchSpan, measureTypes: measureTypes} : {color: colorOrOptionsObject, searchSpan: searchSpan, measureTypes: measureTypes, alias: alias, contextMenu: contextMenu });
        this.predicate = predicateObject;
        this.splitByObject = splitByObject;
        this.measureObject = ((measureTypes.length == 1 && measureTypes[0] == 'count') || measureObject.property == 'Events Count') ?  {count: {}} : {input : measureObject};
    }
    
    public toTsx(roundFromTo: boolean = false){
        var tsx = {};
        let shiftMillis = Utils.parseShift(this.timeShift, this.startAt, this.searchSpan);
        let fromMillis = this.searchSpan.from.valueOf() + shiftMillis;
        let toMillis = this.searchSpan.to.valueOf() + shiftMillis;
        let bucketSizeInMillis = Utils.parseTimeInput(this.searchSpan.bucketSize);
        let roundedFromMillis = Math.floor((fromMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000; 
        let roundedToMillis = Math.ceil((toMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
        if (roundFromTo) {
            fromMillis = roundedFromMillis;
            toMillis = roundedToMillis;
        }
        tsx['searchSpan'] = {from: (new Date(fromMillis)).toISOString(), to: (new Date(toMillis)).toISOString()}; 
        
        // create aggregates
        var measures = (this.measureObject.hasOwnProperty('count')) ? [{count: {}}] 
            : this.measureTypes.reduce((p,c) => {
                var measureObject = {}; 
                if(c == 'count')
                    measureObject = {count: {}};
                else
                    measureObject[c] = this['measureObject'];
                p.push(measureObject);
                return p;
            }, []);
        var aggregateObject = {};
        var dimensionObject = {dateHistogram: {input: {builtInProperty: "$ts"}, breaks: {size: this.searchSpan.bucketSize}}};
        if(this.splitByObject != null){
            var bucketsCeil = Math.ceil((roundedToMillis - roundedFromMillis) / bucketSizeInMillis);
            aggregateObject['dimension'] = {uniqueValues: {input: this.splitByObject, take: Math.floor(MAXCARD / bucketsCeil)}};
            aggregateObject['aggregate'] = {dimension : dimensionObject, measures: measures};
        }
        else{
            aggregateObject['dimension'] = dimensionObject;
            aggregateObject['measures'] = measures;
        }
        var aggregates = [aggregateObject];
        tsx['aggregates'] = aggregates;
        
        // create predicate
        var predicate;
        if(!this.measureObject.hasOwnProperty('count'))
            predicate = {and: [this.predicate, {not: {eq: {left: this.measureObject.input, right: {'double': null}}}}]};
        else
            predicate = this.predicate;
        tsx['predicate'] = predicate;
        
        return tsx;
    }
}
export default AggregateExpression

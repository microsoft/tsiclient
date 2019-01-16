import {Utils} from "./../Utils";
import { ChartableExpression } from "./ChartableExpression";

const MAXCARD = 150000;

class AggregateExpression extends ChartableExpression {
    public measureObject: any;
    public splitByObject;
    public predicate: Object; // predicate TSX
    public visibleSplitByCap: number = 10;
    public visibilityState: Array<any>;

	constructor(predicateObject: any, measureObject: any, measureTypes: Array<string>, searchSpan: any, 
                splitByObject: any = null, color: string, alias: string, contextMenu: Array<any>, visibilityState: Array<any> = null){
        super(searchSpan, color, alias, contextMenu, measureTypes);
        this.predicate = predicateObject;
        this.measureTypes = measureTypes;
        this.splitByObject = splitByObject;
        this.visibilityState = visibilityState;
        this.measureObject = ((measureTypes.length == 1 && measureTypes[0] == 'count') || measureObject.property == 'Events Count') ?  {count: {}} : {input : measureObject};
    }
    
    public toTsx(roundFromTo: boolean = false){
        var tsx = {};
        let fromMillis = this.searchSpan.from.valueOf(), toMillis = this.searchSpan.to.valueOf();
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
export {AggregateExpression}

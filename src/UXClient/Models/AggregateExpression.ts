import {Utils} from "./../Utils";

class AggregateExpression {
    public searchSpan: any;  // from,to,bucketSize as TSX
    public measureObject: any;
    public measureTypes: Array<string>;
    public splitByObject;
    public predicate: Object; // predicate TSX
    public color: string;
    public alias: string;
    public contextMenu: any; // describes menu shown with a split by member on context menu, and actions

	constructor(predicateObject: any, measureObject: any, measureTypes: Array<string>, searchSpan: any, 
        splitByObject: any = null, color: string, alias: string, contextMenu: Array<any>){
        this.predicate = predicateObject;
        this.measureTypes = measureTypes;
        this.searchSpan = searchSpan;
        this.splitByObject = splitByObject;
        this.measureObject = ((measureTypes.length == 1 && measureTypes[0] == 'count') || measureObject.property == 'Events Count') ?  {count: {}} : {input : measureObject};
        this.color = color ? color : null;
        this.alias = alias.length ? alias : measureObject.property;
        this.contextMenu = contextMenu;
    }
    
    public toTsx(roundFromTo: boolean = false){
        var tsx = {};
        let fromMillis = this.searchSpan.from.valueOf(), toMillis = this.searchSpan.to.valueOf();
        if (roundFromTo) {
            let bucketSizeInMillis = Utils.parseTimeInput(this.searchSpan.bucketSize);
            fromMillis = Math.floor((fromMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
            toMillis = Math.ceil((toMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
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
            aggregateObject['dimension'] = {uniqueValues: {input: this.splitByObject, take: 1000}};
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

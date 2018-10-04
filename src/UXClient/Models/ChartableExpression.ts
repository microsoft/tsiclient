import {Utils} from "./../Utils";

// Represents an expression that is suitable for use as the expression options parameter in a chart component
abstract class ChartableExpression {

    public searchSpan: any;  // from,to,bucketSize as TSX
    public color: string;
    public alias: string;
    public contextMenu: any; // describes menu shown with a split by member on context menu, and actions
    public measureTypes: Array<string>;  // 

    constructor (searchSpan: any, color: string, alias: string, contextMenu: Array<any>, measureTypes: Array<any>){
        this.searchSpan = searchSpan;
        this.color = color;
        this.alias = alias;
        this.contextMenu = contextMenu;
        this.measureTypes = measureTypes;
    }
}
export {ChartableExpression}

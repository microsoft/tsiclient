import Utils from "../Utils";
import {ChartComponent} from "./ChartComponent";
import { ChartDataOptions } from "../Models/ChartDataOptions";

class ChartVisualizationComponent extends ChartComponent {	

    constructor(renderTarget: Element){
		super(renderTarget);
	}

	public render (data, options, aggregateExpressionOptions) {
        this.data = Utils.standardizeTSStrings(data);
        this.chartOptions.setOptions(options);
        this.aggregateExpressionOptions = data.map((d, i) => 
            Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions ? 
                new ChartDataOptions(aggregateExpressionOptions[i]) : 
                new ChartDataOptions({})));
	}
}
export {ChartVisualizationComponent}

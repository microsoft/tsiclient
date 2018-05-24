import * as d3 from 'd3';
import './AvailabilityChart.scss';
import { LineChart } from '../LineChart/LineChart';
import { Utils } from "./../../Utils";
import { Component } from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { UXClient } from '../../UXClient';

class AvailabilityChart extends ChartComponent{

    private margins = {
        left: 10,
        right: 10
    }
    private uxClient: any;
    private brushMoveAction: any;
    private brushContextMenuActions: any;
	
	constructor(renderTarget: Element){
        super(renderTarget);
        this.uxClient = new UXClient();
    }

    public render(transformedAvailability: any, chartOptions: any, rawAvailability: any) {

        var ae = [new this.uxClient.AggregateExpression({predicateString: ""}, {property: 'Count', type: "Double"}, ['count'],
        { from: new Date(rawAvailability.range.from), to: new Date(rawAvailability.range.to.valueOf()), bucketSize: rawAvailability.intervalSize }, null, 'green', 'Availability')];

        var targetElement = d3.select(this.renderTarget)
            .classed("tsi-availabilityChart", true);

        chartOptions.yAxisHidden = true;
        chartOptions.focusHidden = true;

        super.themify(targetElement, chartOptions.theme);
        
        var timePickerContainer = targetElement.append("div").classed("tsi-timePickerContainer", true);
        var timePickerChart = timePickerContainer.append("div").classed("tsi-timePickerChart", true);
        var sparkLineContainer = targetElement.append("div").classed("tsi-sparklineContainer", true);

        var timePickerLineChart = new tsiClient.ux.LineChart(timePickerChart.node());
        timePickerLineChart.render(transformedAvailability, chartOptions, [{color: 'teal'}]);

        var sparkLineChart = new tsiClient.ux.LineChart(sparkLineContainer.node());
        var sparkLineOptions: any = this.createSparkLineOptions(chartOptions);
        sparkLineOptions.brushMoveAction = (from, to) => {
            timePickerLineChart.render(transformedAvailability, chartOptions, []);
        }
        sparkLineChart.render(transformedAvailability, sparkLineOptions, [{color: 'teal'}]);
    }

    private createSparkLineOptions (chartOptions) {
        return {
            theme: chartOptions.theme, 
            grid: false, 
            tooltip: false, 
            legend: "hidden", 
            brushContextMenuActions: [], 
            snapBrush: false, 
            xAxisHidden: true,
            yAxisHidden: true,
            focusHidden: true 
        };
    }
}

export {AvailabilityChart}

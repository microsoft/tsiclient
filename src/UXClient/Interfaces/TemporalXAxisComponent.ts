import * as d3 from 'd3';
import {Utils} from "./../Utils";
import {ChartComponent} from "./ChartComponent";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';
import { EllipsisMenu } from "../Components/EllipsisMenu/EllipsisMenu";

class TemporalXAxisComponent extends ChartComponent {

    protected xAxis;
    protected x;
    protected chartWidth;
    protected chartHeight;
    
	constructor(renderTarget: Element){
		super(renderTarget);
    }

    protected createXAxis (singleLineXAxisLabel) {
        return d3.axisBottom(this.x)
            .ticks(this.getXTickNumber(singleLineXAxisLabel))
            .tickFormat(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis(), this.chartOptions.offset, this.chartOptions.is24HourTime, null, this.chartOptions.xAxisTimeFormat));
    }

    public getXTickNumber (singleLineXAxisLabel) {
        return Math.max((singleLineXAxisLabel ? Math.floor(this.chartWidth / 300) :  Math.floor(this.chartWidth / 160)), 2);
    }

    private labelFormatUsesSeconds () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesSeconds;
    }

    private labelFormatUsesMillis () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesMillis;
    }

    protected drawXAxis (yOffset) {
        var xAxisEntered = this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + yOffset + ")")
            .call(this.createXAxis(this.chartOptions.singleLineXAxisLabel));

        if (!this.chartOptions.singleLineXAxisLabel)                                     
            xAxisEntered.selectAll('text').call(Utils.splitTimeLabel);

        xAxisEntered.select(".domain").style("display", "none");
    }

}
export {TemporalXAxisComponent}

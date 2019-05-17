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

    private createOffsetXAxis () {
        let xCopy = this.x.copy();
        let startMillis = xCopy.domain()[0].valueOf() + (xCopy.domain()[0].getTimezoneOffset() + Utils.getOffsetMinutes(this.chartOptions.offset, xCopy.domain()[0].valueOf())) * 60 * 1000;
        let endMillis = xCopy.domain()[1].valueOf() + (xCopy.domain()[1].getTimezoneOffset() + Utils.getOffsetMinutes(this.chartOptions.offset, xCopy.domain()[1].valueOf())) * 60 * 1000;
        xCopy.domain([ 
            new Date(startMillis), new Date(endMillis)
        ]);
        return xCopy;
    }

    protected createXAxis (singleLineXAxisLabel) {
        let offsetX: any = this.createOffsetXAxis();
        let ticks = offsetX.ticks(this.getXTickNumber(singleLineXAxisLabel));
        ticks = ticks.map((d) => {
            return new Date(d.valueOf() - ((d.getTimezoneOffset() + Utils.getOffsetMinutes(this.chartOptions.offset, d.valueOf())) * 60 * 1000))
        })
        if (ticks.length <= 2) {
            ticks = this.x.domain();
        }
        return d3.axisBottom(this.x)
            .tickValues(ticks)
            .tickFormat(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis(), this.chartOptions.offset, this.chartOptions.is24HourTime, null, null));
    }

    public getXTickNumber (singleLineXAxisLabel) {
        return Math.max((singleLineXAxisLabel ? Math.floor(this.chartWidth / 300) :  Math.floor(this.chartWidth / 160)), 1);
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

        //update text by applying function
        if (this.chartOptions.xAxisTimeFormat) {
            let indexOfLast = xAxisEntered.selectAll('.tick').size() - 1;
            let self = this;
            xAxisEntered.selectAll('.tick').each(function (d, i) {
                d3.select(this).select('text').text((d) => {
                    let momentTimeFormatString: string = String(self.chartOptions.xAxisTimeFormat(d, i, i === 0, i === indexOfLast));
                    return Utils.timeFormat(self.labelFormatUsesSeconds(), self.labelFormatUsesMillis(), self.chartOptions.offset, self.chartOptions.is24HourTime, null, momentTimeFormatString)(d);
                });
            });
        }

        if (!this.chartOptions.singleLineXAxisLabel)                                     
            xAxisEntered.selectAll('text').call(Utils.splitTimeLabel);

        xAxisEntered.select(".domain").style("display", "none");
    }

}
export {TemporalXAxisComponent}

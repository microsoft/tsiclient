import * as d3 from 'd3';
import Utils from "../Utils";
import { ChartVisualizationComponent } from './ChartVisualizationComponent';

class TemporalXAxisComponent extends ChartVisualizationComponent {

    protected xAxis;
    protected x;
    protected chartHeight;
    private smartTickFormat;
    private xAxisEntered;

	constructor(renderTarget: Element){
		super(renderTarget);
    }

    private createOffsetXAxis () {
        let xCopy = this.x.copy();
        let rawStart = this.chartOptions.timeFrame ? (new Date(this.chartOptions.timeFrame[0])) : xCopy.domain()[0];
        let rawEnd = this.chartOptions.timeFrame ? (new Date(this.chartOptions.timeFrame[1])) : xCopy.domain()[1];
        xCopy.domain([ 
            new Date(rawStart), new Date(rawEnd)
        ]);
        return xCopy;
    }

    private createXAxis (singleLineXAxisLabel, snapFirst = false, snapLast = false) {
        let offsetX: any = this.createOffsetXAxis();
        let ticks = offsetX.ticks(this.getXTickNumber(singleLineXAxisLabel));
        if (ticks.length <= 2) {
            ticks = this.x.domain();
        }

        if (snapFirst) {
            ticks[0] = this.x.domain()[0];
        }
        if (snapLast) {
            ticks[ticks.length - 1] = this.x.domain()[1];
        }

        this.smartTickFormat = this.createSmartTickFormat(ticks, offsetX);
        return d3.axisBottom(this.x)
            .tickValues(ticks)
            .tickFormat(Utils.timeFormat(this.labelFormatUsesSeconds(ticks), this.labelFormatUsesMillis(ticks), this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale));
    }

    private getXTickNumber (singleLineXAxisLabel) {
        return Math.max((singleLineXAxisLabel ? Math.floor(this.chartWidth / 300) :  Math.floor(this.chartWidth / 160)), 1);
    }

    private labelFormatUsesSeconds (ticks = null) {
        let tickSpanSubMinute = ticks ? !this.isTickSpanGreaterThan(ticks, 59 * 1000) : false;
        return !this.chartOptions.minutesForTimeLabels && tickSpanSubMinute;
    }

    private labelFormatUsesMillis (ticks = null) {
        let tickSpanSubSecond = ticks ? !this.isTickSpanGreaterThan(ticks, 999) : false;
        return !this.chartOptions.minutesForTimeLabels && tickSpanSubSecond;
    }

    public updateXAxis (forceFirst = false, forceLast = false) {
        this.xAxisEntered.call(this.createXAxis(this.chartOptions.singleLineXAxisLabel, forceFirst, forceLast));
        this.updateAxisText(forceFirst, forceLast);
    }

    private updateAxisText (forceFirst = false, forceLast = false) {
        //update text by applying function
        if (this.chartOptions.xAxisTimeFormat) {
            let indexOfLast = this.xAxisEntered.selectAll('.tick').size() - 1;
            let self = this;
            this.xAxisEntered.selectAll('.tick').each(function (d, i) {
                d3.select(this).select('text').text((d) => {
                    let momentTimeFormatString: string = String(self.chartOptions.xAxisTimeFormat(d, i, i === 0, i === indexOfLast));
                    return Utils.timeFormat(self.labelFormatUsesSeconds(), self.labelFormatUsesMillis(), self.chartOptions.offset, self.chartOptions.is24HourTime, null, momentTimeFormatString, self.chartOptions.dateLocale)(d);
                });
            });
        } else {
            let indexOfLast = this.xAxisEntered.selectAll('.tick').size() - 1;
            let self = this;
            this.xAxisEntered.selectAll('.tick').each(function (d, i) {
                d3.select(this).select('text').text((d) => {
                    let momentTimeFormatString: string = String(self.smartTickFormat(d, i, i === 0, i === indexOfLast));
                    //harcode format of first and last to include hours/minutes if force first/last
                    if ((i === 0 && forceFirst) || (i === indexOfLast && forceLast)) { 
                        momentTimeFormatString = 'L ' + Utils.subDateTimeFormat(self.chartOptions.is24HourTime, false, false); 
                    }
                    return Utils.timeFormat(self.labelFormatUsesSeconds(), self.labelFormatUsesMillis(), self.chartOptions.offset, self.chartOptions.is24HourTime, null, momentTimeFormatString, self.chartOptions.dateLocale)(d);
                });
            });
        }

        if (!this.chartOptions.singleLineXAxisLabel)                                     
            this.xAxisEntered.selectAll('text').call(Utils.splitTimeLabel);

        this.xAxisEntered.select(".domain").style("display", "none");
    }

    protected drawXAxis (yOffset, snapFirst = false, snapLast = false) {
        this.xAxisEntered = this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + yOffset + ")")
            .call(this.createXAxis(this.chartOptions.singleLineXAxisLabel, snapFirst, snapLast));
        this.updateAxisText(snapFirst, snapLast);
    }

    private isSameDate (d1, d2) {
        return (d1.getYear() === d2.getYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate());
    }

    private isTickSpanGreaterThan (ticks, minValue) {
        return (ticks[1].valueOf() - ticks[0].valueOf() >= minValue);
    }

    private createSmartTickFormat (ticks, offsetX): any {
        let spansMultipleDays = !this.isSameDate(offsetX.domain()[0], offsetX.domain()[1]);
        let lessTicksThanDays = this.isTickSpanGreaterThan(ticks, 23 * 60 * 60 * 1000);

        let timeFormat = Utils.subDateTimeFormat(this.chartOptions.is24HourTime, this.labelFormatUsesSeconds(ticks), this.labelFormatUsesMillis(ticks)); 

        return (d, i, isFirst, isLast) => {
            let timeAndDate = this.chartOptions.singleLineXAxisLabel ? ('L ' + timeFormat) : (timeFormat + ' L');
            if (lessTicksThanDays) {
                return 'L';
            }
            if (isFirst || isLast) {
                return timeAndDate;
            }
            if (!spansMultipleDays) {
                return timeFormat;
            }
            return timeAndDate;
        }
    }

}
export {TemporalXAxisComponent}

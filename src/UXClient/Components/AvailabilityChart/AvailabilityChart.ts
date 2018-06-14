import * as d3 from 'd3';
import './AvailabilityChart.scss';
import { LineChart } from '../LineChart/LineChart';
import { Utils } from "./../../Utils";
import { Component } from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { UXClient } from '../../UXClient';
import { ChartOptions } from '../../Models/ChartOptions';

class AvailabilityChart extends ChartComponent{
    private fromMillis: number;
    private toMillis: number;
    private selectedFromMillis: number;
    private selectedToMillis: number;
    private zoomedFromMillis: number;
    private zoomedToMillis: number;
    private minBrushWidth: number = 5;
    private color: string;

    private margins = {
        left: 10,
        right: 10
    }
    private uxClient: any;
    private brushMoveAction: any;
    private brushContextMenuActions: any;
    private timePickerLineChart: any;
    private timePickerContainer: any;
    private timePickerChart: any;
    private timePickerTextContainer: any;
    private sparkLineChart: any;
    private ae: any;
    private rawAvailability: any;
    private maxBuckets: number;
    private quickTimeArray: Array<any> = [
        ["Last 30 mins", 30 * 60 * 1000],
        ["Last Hour", 60 * 60 * 1000],
        ["Last 2 Hours", 2 * 60 * 60 * 1000],
        ["Last 4 Hours", 4 * 60 * 60 * 1000],
        ["Last 12 Hours", 12 * 60 * 60 * 1000],
        ["Last 24 Hours", 24 * 60 * 60 * 1000],
        ["Last 7 Days", 7 * 24 * 60 * 60 * 1000],
        ["Last 30 Days", 30 * 24 * 60 * 60 * 1000],
        ["Custom", null]
    ];
	
	constructor(renderTarget: Element){
        super(renderTarget);
        this.uxClient = new UXClient();
    }

    //the most zoomed in possible
    private getMinZoomedRange() {
        let maxZoomFactor: number = (this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]) / this.minBrushWidth;                
        let totalTimeRange: number = this.toMillis - this.fromMillis;
        return totalTimeRange / maxZoomFactor;
    }

    private zoom(direction: string, xPos: number) {
        var range = Math.max(this.getMinZoomedRange(), (this.zoomedToMillis - this.zoomedFromMillis));
        let percentile = (xPos - this.sparkLineChart.x.range()[0]) / 
                         (this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]);
        let leftImpact = percentile * .2 * range;
        let rightImpact = (1 - percentile) * .2 * range;
        if (direction == 'out') {
            this.zoomedFromMillis = Math.max(this.zoomedFromMillis - leftImpact, this.fromMillis);
            this.zoomedToMillis = Math.min(this.zoomedToMillis + rightImpact, this.toMillis);
        } else {
            let prospectiveFromMillis = Math.max(this.zoomedFromMillis + leftImpact, this.fromMillis);
            let prospectiveToMillis = Math.min(this.zoomedToMillis - rightImpact, this.toMillis);  
            if (prospectiveToMillis - prospectiveFromMillis >= this.getMinZoomedRange()) {
                this.zoomedFromMillis = prospectiveFromMillis;
                this.zoomedToMillis = prospectiveToMillis;
            } else {
                let offBy = this.getMinZoomedRange() - (prospectiveToMillis - prospectiveFromMillis);
                this.zoomedFromMillis = prospectiveFromMillis - (percentile * offBy);
                this.zoomedToMillis = prospectiveToMillis + ((1 - percentile) * offBy);
            }
        }
        this.setAvailabilityRange(this.zoomedFromMillis, this.zoomedToMillis);
        this.sparkLineChart.setBrushEndTime(new Date(this.zoomedToMillis));
        this.sparkLineChart.setBrushStartTime(new Date(this.zoomedFromMillis));
        this.sparkLineChart.setBrush();
        d3.event.preventDefault && d3.event.preventDefault();
    }
    private setChartOptions (chartOptions) {
        this.chartOptions = new ChartOptions({ ...chartOptions, ...{
            keepBrush: true,
            isArea: true,
            noAnimate: true,
            minutesForTimeLabels: true,
            aggTopMargin: 0,
            yAxisHidden: true,
            focusHidden: true,
            singleLineXAxisLabel: true

        }});
    }

    public render(transformedAvailability: any, chartOptions: any, rawAvailability: any) {
        this.setChartOptions(chartOptions);
        this.rawAvailability = rawAvailability;
        this.color = this.chartOptions.color ? this.chartOptions.color : 'teal'; 
        this.maxBuckets = (this.chartOptions.maxBuckets) ? this.chartOptions.maxBuckets : 500;
        this.fromMillis = (new Date(rawAvailability.range.from)).valueOf();
        this.toMillis = (new Date(rawAvailability.range.to)).valueOf();
        this.ae = [new this.uxClient.AggregateExpression({predicateString: ""}, {property: 'Count', type: "Double"}, ['count'],
        { from: new Date(this.fromMillis), to: new Date(this.toMillis) }, null, this.color, 'Availability')];

        var targetElement = d3.select(this.renderTarget)
            .classed("tsi-availabilityChart", true);

        this.chartOptions.yAxisHidden = true;
        this.chartOptions.focusHidden = true;
        this.chartOptions.singleLineXAxisLabel = true;
        this.chartOptions.suppressResizeListener = true;
        this.chartOptions.brushClearable = false;

        var timePickerOptionsObj = { ...this.chartOptions.toObject(), ...{brushMoveAction: (from, to) => {
            if (this.isCustomTime(from.valueOf(), to.valueOf()))
                this.timePickerTextContainer.select('.tsi-timePicker')
                    .node().value = "Custom";
            this.setFromAndToTimes(from.valueOf(), to.valueOf());
            this.drawGhost();
        }}};

        super.themify(targetElement, chartOptions.theme);


        if (this.timePickerContainer == null) {
            targetElement.html("");
            this.timePickerTextContainer = targetElement.append("div").classed("tsi-timePickerTextContainer", true);
            this.timePickerContainer = targetElement.append("div").classed("tsi-timePickerContainer", true);
            this.timePickerChart = this.timePickerContainer.append("div").classed("tsi-timePickerChart", true);
            var sparkLineContainer = targetElement.append("div").classed("tsi-sparklineContainer", true);
            this.timePickerLineChart = new LineChart(this.timePickerChart.node() as any);
            this.createQuickTimePicker();
            this.buildFromAndTo();
            this.sparkLineChart = new LineChart(sparkLineContainer.node() as any);
            window.addEventListener('resize', () => {
                this.timePickerLineChart.draw();
                this.drawGhost();
                this.setTicks();
            });
        }

        var sparkLineOptions: any = this.createSparkLineOptions(chartOptions);
        this.sparkLineChart.render(transformedAvailability, sparkLineOptions, this.ae);
        this.sparkLineChart.setBrushEndTime(new Date(this.toMillis));
        this.sparkLineChart.setBrushStartTime(new Date(this.fromMillis));
        this.sparkLineChart.setBrush();
        this.setBrush(this.toMillis - (24 * 60 * 60 * 1000), this.toMillis);
        this.zoomedFromMillis = this.fromMillis;
        this.zoomedToMillis = this.toMillis;
        this.buildZoomButtons(targetElement);

        

        this.timePickerLineChart.render(transformedAvailability, timePickerOptionsObj, this.ae);
        this.setTicks();
        this.setFromAndToTimes(this.toMillis - (24 * 60 * 60 * 1000), this.toMillis);
        var self = this;
        this.timePickerChart.select(".brushElem").on("wheel.zoom", function (d) {
            let direction = d3.event.wheelDelta < 0 ? 'out' : 'in';
            let xPos = (d3.mouse(<any>this)[0]);
            self.zoom(direction, xPos);
        });
    }

    private buildZoomButtons(targetElement) {
        //blow away old buttons
        targetElement.selectAll(".tsi-zoomButtonContainer").remove();
        let midpoint = (this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]) / 2;
        var buttonsDiv = targetElement.append("div")
            .classed("tsi-zoomButtonContainer", true);
        buttonsDiv.append("button")
            .attr("class", "tsi-zoomButton tsi-zoomButtonIn")
            .text("+")
            .on("click", () => {
                this.zoom("in", midpoint);
            });
        buttonsDiv.append("button")
            .attr("class", "tsi-zoomButton tsi-zoomButtonOut")
            .text("-")
            .on("click", () => {
                this.zoom("out", midpoint);
            });
    }

    private setSelectedMillis (fromMillis, toMillis) {
        this.selectedFromMillis = fromMillis;
        this.selectedToMillis = toMillis;
    }

    private isCustomTime (fromMillis, toMillis) {
        if (toMillis != this.toMillis)
            return true;
        return !this.quickTimeArray.reduce((isQuickTime, currQuickTime) => {
            return isQuickTime || (currQuickTime[1] == (toMillis - fromMillis));
        }, false);
    }

    private setFromAndToTimes (fromMillis, toMillis) {
        [{"From": fromMillis}, {"To": toMillis}].forEach((fromOrTo) => {
            let fromOrToText = Object.keys(fromOrTo)[0]; 
            let date = new Date(fromOrTo[fromOrToText]);
            let hours = date.getUTCHours() < 10 ? "0" + date.getUTCHours() : date.getUTCHours();
            let minutes = date.getUTCMinutes() < 10 ? "0" + date.getUTCMinutes() : date.getUTCMinutes();
            let year = date.getUTCFullYear();
            let month = (date.getUTCMonth() + 1) < 10 ? "0" + (date.getUTCMonth() + 1) : (date.getUTCMonth() + 1);
            let day = date.getUTCDate() < 10 ? "0" + date.getUTCDate() : date.getUTCDate();
            this.timePickerTextContainer.select(".tsi-timeInput" + fromOrToText)
                .node().value = hours + ":" + minutes;
            this.timePickerTextContainer.select(".tsi-dateInput" + fromOrToText)
                .node().value = year + "/" + month + "/" + day;
        });
        this.setSelectedMillis(fromMillis, toMillis);
    }

    private drawGhost() {
        var svgGroup = d3.select('.tsi-sparklineContainer').select(".lineChartSVG").select(".svgGroup");
        svgGroup.selectAll(".ghostRect").remove();
        svgGroup.append("rect")
            .classed("ghostRect", true)
            .attr("x", this.sparkLineChart.x(new Date(this.selectedFromMillis)))
            .attr("y", 0)
            .attr("width", Math.max(1, this.sparkLineChart.x(new Date(this.selectedToMillis)) - this.sparkLineChart.x(new Date(this.selectedFromMillis))))
            .attr("height", 14)
            .attr("fill", "blue")
            .attr("fill-opacity", .3)
            .attr("pointer-events", "none");
        svgGroup.select(".overlay").style("fill", "white");
    }

    private buildFromAndTo () {
        ["From", "To"].forEach((fromOrTo) => {
            var inputDiv = this.timePickerTextContainer.append("div")
                .classed("tsi-dateTimeInputDiv", true);
            inputDiv.append("div").html(fromOrTo).classed("tsi-dateTimeInputLabel", true);
            var dateInput = inputDiv.append("input")
                .classed("tsi-dateInput tsi-dateInput" + fromOrTo, true)
                .attr("readonly", "");
            var timeInput = inputDiv.append("input")
                .classed("tsi-timeInput tsi-timeInput" + fromOrTo, true)
                .attr("readonly", "");
        });
    }


    private createQuickTimePicker () {

        var select = this.timePickerTextContainer
            .append("div")
            .append("select")
            .attr('class', 'select tsi-timePicker');

        var options = select.selectAll('option')
            .data(this.quickTimeArray).enter()
            .append('option')
            .text(function (d) { return d[0]; })
            .property("value", function (d) { return d[1]; });

        options.filter((d) => d[0] == "Last 24 Hours")
            .attr("selected", "selected");

        var self = this;
        select.on('change', function (d) {
            var selectValue = Number(d3.select(this).property('value'));
            if (!isNaN(selectValue)) {
                self.setBrush(Math.max(self.toMillis - selectValue, self.fromMillis), self.toMillis);
            }
        });
    }

    private setTicks () {
        if (this.timePickerLineChart.zoomedToMillis == this.timePickerLineChart.toMillis) {
            let xAxis = this.timePickerLineChart.createXAxis(true);
            let ticks = xAxis.scale().ticks(Math.max(2, this.timePickerLineChart.getXTickNumber(true)));
            if (this.zoomedToMillis == this.toMillis) {
                if (ticks.length > 1)
                    ticks[ticks.length - 1] = new Date(this.toMillis);
                else 
                    ticks.push(new Date(this.toMillis));
            }
            if (this.zoomedFromMillis == this.fromMillis)
                ticks[0] = new Date(this.fromMillis);
            let xAxisElem = this.timePickerContainer.select('.tsi-timePickerChart')
                .select('.xAxis')
                .call(xAxis.tickValues(ticks));
        }
    }

    private setAvailabilityRange (fromMillis, toMillis) {
        this.zoomedFromMillis = fromMillis;
        this.zoomedToMillis = toMillis;
        var transformedAvailability = this.uxClient.transformAvailabilityForVisualization(this.rawAvailability, 
                                            this.maxBuckets, {from: fromMillis, to: toMillis});
        this.chartOptions.keepBrush = true;
        var aeWithNewTimeSpan = {...this.ae[0], ...{searchSpan: {
            from: (new Date(fromMillis)),
            to: (new Date(toMillis))
        }}};
        this.timePickerLineChart.render(transformedAvailability, this.chartOptions, [aeWithNewTimeSpan]);
        this.setTicks();
        this.timePickerLineChart.setBrush();   
    }

    private setBrush (fromMillis, toMillis) {
        this.timePickerLineChart.setBrushEndTime(new Date(toMillis));
        this.timePickerLineChart.setBrushStartTime(new Date(fromMillis));
        this.timePickerLineChart.setBrush();
        this.setFromAndToTimes(fromMillis, toMillis);
        this.drawGhost();
    }

    private createSparkLineOptions (chartOptions) {
        return {
            aggTopMargin: 0,
            theme: chartOptions.theme, 
            grid: false, 
            tooltip: false, 
            legend: "hidden", 
            brushContextMenuActions: [], 
            snapBrush: false, 
            keepBrush: false,
            xAxisHidden: true,
            yAxisHidden: true,
            focusHidden: true,
            minBrushWidth: 5,
            brushMoveAction: (from, to) => {
                this.setAvailabilityRange(from.valueOf(), to.valueOf());
            },
            brushClearable: false
        };
    }
}

export {AvailabilityChart}

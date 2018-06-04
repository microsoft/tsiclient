import * as d3 from 'd3';
import './AvailabilityChart.scss';
import { LineChart } from '../LineChart/LineChart';
import { Utils } from "./../../Utils";
import { Component } from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { UXClient } from '../../UXClient';

class AvailabilityChart extends ChartComponent{

    private fromMillis: number;
    private toMillis: number;
    private selectedFromMillis: number;
    private selectedToMillis: number;

    private margins = {
        left: 10,
        right: 10
    }
    private uxClient: any;
    private brushMoveAction: any;
    private brushContextMenuActions: any;
    private timePickerLineChart: any;
    private timePickerContainer: any;
    private timePickerTextContainer: any;
    private sparkLineChart: any;
    private ae: any;
    private rawAvailability: any;
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

    public render(transformedAvailability: any, chartOptions: any, rawAvailability: any) {
        chartOptions.keepBrush = false;
        chartOptions.noAnimate = true;
        chartOptions.minutesForTimeLabels = true;
        chartOptions.aggTopMargin = 0;
        this.rawAvailability = rawAvailability;
        this.chartOptions = chartOptions;
        this.fromMillis = (new Date(rawAvailability.range.from)).valueOf();
        this.toMillis = (new Date(rawAvailability.range.to)).valueOf();
        this.ae = [new this.uxClient.AggregateExpression({predicateString: ""}, {property: 'Count', type: "Double"}, ['count'],
        { from: new Date(this.fromMillis), to: new Date(this.toMillis) }, null, 'green', 'Availability')];

        var targetElement = d3.select(this.renderTarget)
            .classed("tsi-availabilityChart", true);

        chartOptions.yAxisHidden = true;
        chartOptions.focusHidden = true;

        var timePickerOptions = { ...chartOptions, ...{brushMoveAction: (from, to) => {
            chartOptions.brushMoveAction(from, to);
            if (this.isCustomTime(from.valueOf(), to.valueOf()))
                this.timePickerTextContainer.select('.tsi-TimePicker')
                    .node().value = "Custom";
            this.setFromAndToTimes(from.valueOf(), to.valueOf());
            this.drawGhost();
        }}};

        super.themify(targetElement, chartOptions.theme);


        if (this.timePickerContainer == null) {
            targetElement.html("");
            var timePickerContainer = targetElement.append("div").classed("tsi-timePickerContainer", true);
            this.timePickerTextContainer = timePickerContainer.append("div").classed("tsi-timePickerTextContainer", true);
            var timePickerChart = timePickerContainer.append("div").classed("tsi-timePickerChart", true);
            var sparkLineContainer = targetElement.append("div").classed("tsi-sparklineContainer", true);
            this.timePickerLineChart = new tsiClient.ux.LineChart(timePickerChart.node());
            this.createQuickTimePicker();
            this.buildFromAndTo();
            this.sparkLineChart = new tsiClient.ux.LineChart(sparkLineContainer.node());
            var sparkLineOptions: any = this.createSparkLineOptions(chartOptions);
            this.sparkLineChart.render(transformedAvailability, sparkLineOptions, this.ae);
            this.sparkLineChart.setBrushEndTime(new Date(this.toMillis));
            this.sparkLineChart.setBrushStartTime(new Date(this.fromMillis));
            this.sparkLineChart.setBrush();
            this.setBrush(this.toMillis - (24 * 60 * 60 * 1000), this.toMillis);
        }

        window.addEventListener('resize', () => {
            this.drawGhost();
        });

        this.timePickerLineChart.render(transformedAvailability, timePickerOptions, this.ae);
        this.setFromAndToTimes(this.toMillis - (24 * 60 * 60 * 1000), this.toMillis);
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
            .attr("width", this.sparkLineChart.x(new Date(this.selectedToMillis)) - this.sparkLineChart.x(new Date(this.selectedFromMillis)))
            .attr("height", 18)
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
            .attr('class', 'select tsi-TimePicker');

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

    private setAvailabilityRange (fromMillis, toMillis) {
        var transformedAvailability = this.uxClient.transformAvailabilityForVisualization(this.rawAvailability, 
                                            500, {from: fromMillis, to: toMillis});
        this.chartOptions.keepBrush = true;
        var aeWithNewTimeSpan = {...this.ae[0], ...{searchSpan: {
            from: (new Date(fromMillis)),
            to: (new Date(toMillis))
        }}};
        this.timePickerLineChart.render(transformedAvailability, this.chartOptions, [aeWithNewTimeSpan]);
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
            xAxisHidden: true,
            yAxisHidden: true,
            focusHidden: true ,
            brushMoveAction: (from, to) => {
                this.setAvailabilityRange(from.valueOf(), to.valueOf());
            }
        };
    }
}

export {AvailabilityChart}

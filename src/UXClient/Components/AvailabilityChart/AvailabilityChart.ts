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
    private transformedAvailability: any;

    private margins = {
        left: 10,
        right: 10
    }
    private targetElement: any;
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
    private bucketSize: number;
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

    private zoom (direction: string, xPos: number) {
        if (this.chartOptions.isCompact)
            return;
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
        this.chartOptions.setOptions({ ...chartOptions, ...{
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

    //transformation of buckets created by the UX client to buckets for the availabilityChart
    private createDisplayBuckets (fromMillis: number, toMillis: number) {
        var keysInRange = Object.keys(this.transformedAvailability[0].availabilityCount[""]).reduce((inRangeObj: any, timestamp: string, i: number, timestamps: Array<string>) => {
            var currTSMillis = (new Date(timestamp)).valueOf();
            var nextTSMillis =  currTSMillis + this.bucketSize;
            if (currTSMillis >= fromMillis && currTSMillis <= toMillis) {
                inRangeObj[(new Date(currTSMillis)).toISOString()] = this.transformedAvailability[0].availabilityCount[""][timestamp];
                return inRangeObj;
            }
            if (currTSMillis < fromMillis && nextTSMillis > fromMillis) {
                inRangeObj[(new Date(fromMillis)).toISOString()] = this.transformedAvailability[0].availabilityCount[""][timestamp];
                return inRangeObj;
            }
            return inRangeObj;

        }, {});
        var rawBucketCount: number = Math.ceil((toMillis - fromMillis) / this.bucketSize);
        var bucketMultiplier: number = Math.ceil(rawBucketCount / this.maxBuckets);
        var computedBucketSize: number = this.bucketSize * bucketMultiplier;
        var createKey = (millis) => Math.round(Math.floor(millis / computedBucketSize) * computedBucketSize);

        var firstBucket: number = createKey(fromMillis); 
        var lastBucket: number =createKey(toMillis);
        var buckets = [];
        for (var i: number = firstBucket; i <= lastBucket; i += computedBucketSize) {
            buckets[(new Date(i)).toISOString()] = {count: 0};
        }

        Object.keys(keysInRange).sort().forEach((ts: string, i) => {
            var tsMillis = (new Date(ts)).valueOf();
            var computedKey = createKey(tsMillis);
            buckets[(new Date(computedKey)).toISOString()].count += (keysInRange[ts].count / bucketMultiplier); 
        });

        buckets[(new Date(fromMillis)).toISOString()] = buckets[(new Date(firstBucket)).toISOString()];
        buckets[(new Date(toMillis)).toISOString()] = buckets[(new Date(lastBucket)).toISOString()];

        // delete the bucket before the from time
        if (firstBucket < fromMillis) {
            delete buckets[(new Date(firstBucket)).toISOString()];
        }
            
        return [{"availabilityCount" : {"" : buckets}}];
    }

    public render(transformedAvailability: any, chartOptions: any, rawAvailability: any) {
        this.setChartOptions(chartOptions);
        this.rawAvailability = rawAvailability;
        this.transformedAvailability = transformedAvailability;
        this.color = this.chartOptions.color ? this.chartOptions.color : 'teal'; 
        this.maxBuckets = (this.chartOptions.maxBuckets) ? this.chartOptions.maxBuckets : 500;
        this.fromMillis = (new Date(rawAvailability.range.from)).valueOf();
        this.toMillis = (new Date(rawAvailability.range.to)).valueOf();
        // adjustment if (to - from) less than range 
        this.bucketSize = Utils.parseTimeInput(rawAvailability.intervalSize);
        var startBucket = Math.round(Math.floor(this.fromMillis / this.bucketSize) * this.bucketSize);
        var endBucket = Math.round(Math.floor(this.toMillis / this.bucketSize) * this.bucketSize);
        if (startBucket == endBucket) {
            this.fromMillis = Math.floor(this.fromMillis / this.bucketSize) * this.bucketSize;
            this.toMillis = this.fromMillis + this.bucketSize; 
            this.bucketSize = this.bucketSize / 60;
        }

        this.ae = [new this.uxClient.AggregateExpression({predicateString: ""}, {property: 'Count', type: "Double"}, ['count'],
        { from: new Date(this.fromMillis), to: new Date(this.toMillis) }, null, 'grey', 'Availability')];

        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-availabilityChart", true)
            .classed("tsi-compact", this.chartOptions.isCompact);

        this.chartOptions.yAxisHidden = true;
        this.chartOptions.focusHidden = true;
        this.chartOptions.singleLineXAxisLabel = true;
        this.chartOptions.suppressResizeListener = true;
        this.chartOptions.brushClearable = false;
        this.chartOptions.minBrushWidth = 1;
        this.chartOptions.brushHandlesVisible = true;
        this.chartOptions.hideChartControlPanel = true;

        let brushMoveAction = this.chartOptions.brushMoveAction;

        this.chartOptions.brushMoveAction = (from, to) => {
            if (this.isCustomTime(from.valueOf(), to.valueOf()))
                this.timePickerTextContainer.select('.tsi-timePicker')
                    .node().value = "Custom";
            this.setFromAndToTimes(from.valueOf(), to.valueOf());
            this.drawGhost();
            if (this.chartOptions.isCompact) {
                this.buildCompactFromAndTo();
            }
            if (brushMoveAction != null)
                brushMoveAction(from, to);
        }

        super.themify(this.targetElement, chartOptions.theme);

        if (this.timePickerContainer == null) {
            this.targetElement.html("");
            this.timePickerContainer = this.targetElement.append("div").classed("tsi-timePickerContainer", true);
            this.timePickerChart = this.timePickerContainer.append("div").classed("tsi-timePickerChart", true);
            var sparkLineContainer = this.targetElement.append("div").classed("tsi-sparklineContainer", true);
            this.timePickerTextContainer = this.targetElement.append("div").classed("tsi-timePickerTextContainer", true);
            this.timePickerLineChart = new LineChart(this.timePickerChart.node() as any);
            this.createQuickTimePicker();
            this.buildFromAndToInput();
            this.sparkLineChart = new LineChart(sparkLineContainer.node() as any);
            window.addEventListener('resize', () => {
                this.timePickerLineChart.draw();
                this.setTicks();
                if (this.chartOptions.isCompact)
                    this.buildCompactFromAndTo();
                setTimeout(() => {
                    this.drawGhost();
                }, 100);
            });
        }

        this.timePickerContainer.selectAll('.tsi-compactFromTo').remove();
        if (this.chartOptions.isCompact) {
            this.targetElement.select('.tsi-sparklineContainer').style("display", 'none');
            this.targetElement.select(".tsi-timePickerTextContainer").style('display', 'none');
            this.targetElement.select('.tsi-zoomButtonContainer').style('display', 'none');
            this.targetElement.select('.tsi-timePickerContainer').style('max-height', '80px').style('top', '20px');
            this.buildCompactFromAndTo();
        } else {
            this.targetElement.select('.tsi-sparklineContainer').style("display", 'flex');
            this.targetElement.select(".tsi-timePickerTextContainer").style('display', 'flex');
            this.targetElement.select('.tsi-zoomButtonContainer').style('display', 'flex');
            this.targetElement.select('.tsi-timePickerContainer').style('max-height', 'none').style('top', '0px');
        }

        var sparkLineOptions: any = this.createSparkLineOptions(chartOptions);
        this.sparkLineChart.render(this.transformedAvailability, sparkLineOptions, this.ae);

        if (!this.chartOptions.preserveAvailabilityState) {
            this.sparkLineChart.setBrushStartTime(new Date(this.fromMillis)); 
            this.sparkLineChart.setBrushEndTime(new Date(this.toMillis)); 
            this.zoomedFromMillis = this.fromMillis; 
            this.zoomedToMillis = this.toMillis; 
            this.setFromAndToTimes(this.toMillis - (7 * 24 * 60 * 60 * 1000), this.toMillis); 
            this.setBrush(this.toMillis - (7 * 24 * 60 * 60 * 1000), this.toMillis); 
        } else {
            if (this.zoomedFromMillis == null) this.zoomedFromMillis = this.fromMillis; 
            if (this.zoomedToMillis == null) this.zoomedToMillis = this.toMillis; 
            if (this.sparkLineChart.brushStartTime == null) this.sparkLineChart.setBrushStartTime(new Date(this.zoomedFromMillis)); 
            if (this.sparkLineChart.brushEndTime == null) this.sparkLineChart.setBrushEndTime(new Date(this.zoomedToMillis)); 
            if (this.selectedFromMillis == null || this.selectedToMillis == null) this.setFromAndToTimes(this.toMillis - (7 * 24 * 60 * 60 * 1000), this.toMillis); 
            this.drawGhost();
        }

        this.sparkLineChart.setBrush();

        this.timePickerLineChart.render(this.transformedAvailability, this.chartOptions, this.ae);
        this.setTicks();

        var self = this;
        this.timePickerChart.select(".brushElem").on("wheel.zoom", function (d) {
            let direction = d3.event.deltaY > 0 ? 'out' : 'in';
            let xPos = (d3.mouse(<any>this)[0]);
            self.zoom(direction, xPos);
        });
        if (!this.chartOptions.isCompact) {
            this.buildZoomButtons();
        } else {
            this.timePickerChart.select('.brushElem').select('.selection')
        }

        this.setAvailabilityRange(this.zoomedFromMillis, this.zoomedToMillis);
    }

    private buildZoomButtons() {
        this.targetElement.selectAll(".tsi-zoomButtonContainer").remove();
        let midpoint = (this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]) / 2;
        var buttonsDiv = this.targetElement.append("div")
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
        fromMillis = Math.max(this.fromMillis, fromMillis);
        toMillis = Math.min(this.toMillis, toMillis);
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
        var svgGroup = this.targetElement.select('.tsi-sparklineContainer').select(".tsi-lineChartSVG").select(".svgGroup");
        svgGroup.selectAll(".ghostRect").remove();
        svgGroup.append("rect")
            .classed("ghostRect", true)
            .attr("x", Math.max(this.sparkLineChart.x.range()[0], this.sparkLineChart.x(new Date(this.selectedFromMillis))))
            .attr("y", 0)
            .attr("width", Math.min(Math.max(this.sparkLineChart.xOffset, 
                            this.sparkLineChart.x(new Date(this.selectedToMillis)) - this.sparkLineChart.x(new Date(this.selectedFromMillis))), 
                            this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]))
            .attr("height", 14)
            .attr("fill", this.chartOptions.color ? this.chartOptions.color : 'dark-grey')
            .attr("fill-opacity", .3)
            .attr("pointer-events", "none");
    }

    private buildCompactFromAndTo () { 
        this.timePickerContainer.selectAll('.tsi-compactFromTo').remove();
        var brushPositions = this.timePickerLineChart.getBrushPositions();
        var leftTimeText = null;
        var rightTimeText = null;

        if (this.selectedFromMillis != null && this.selectedToMillis != null) {
            leftTimeText = this.timePickerContainer.append('div')
                .classed('tsi-compactFromTo', true)
                .style('left', (brushPositions.leftPos != null ? Math.max(brushPositions.leftPos, 5) : 5) + 'px')
                .html(Utils.timeFormat(false, false)(new Date(this.selectedFromMillis)));
            rightTimeText = this.timePickerContainer.append('div')
                .attr('class', 'tsi-compactFromTo')
                .style('right', brushPositions.rightPos != null ? 'calc(100% - ' + brushPositions.rightPos + 'px)' : '5px')
                .style('left', 'auto')
                .html(Utils.timeFormat(false, false)(new Date(this.selectedToMillis)));
        }

        if (leftTimeText && rightTimeText) {
            var rightSideOfLeft = leftTimeText.node().getBoundingClientRect().left + leftTimeText.node().getBoundingClientRect().width ;
            var leftSideOfRight = rightTimeText.node().getBoundingClientRect().left;
            var totalWidth = this.timePickerContainer.node().getBoundingClientRect().width;
            var minOffset = 32;
            if (leftSideOfRight - rightSideOfLeft < minOffset) { // if there is overlap (or near overlap), correction needed
                var correction = (rightSideOfLeft - leftSideOfRight + minOffset) / 2;
                //if the correction puts either side off the edge of the container, weight the correction to the other side
                var leftWeight = 1;
                var rightWeight = 1;
                var padding = 32;
                if ((brushPositions.leftPos - correction) < padding) {
                    leftWeight = 1 - ((padding - (brushPositions.leftPos - correction)) / correction)
                    rightWeight = 2 - leftWeight;
                }
                if ((brushPositions.rightPos + correction) > (totalWidth - padding)) {
                    rightWeight = 1 - (padding - (totalWidth - brushPositions.rightPos - correction)) / correction;
                    leftWeight = 2 - rightWeight;
                }
                rightTimeText.style('right', 'calc(100% - ' + Math.round((brushPositions.rightPos + (rightWeight * correction))) + 'px)')
                    .style('left', 'auto');
                leftTimeText.style('left', (brushPositions.leftPos - (leftWeight * correction)) + 'px');
            }
        }
    }

    private buildFromAndToInput () {
        var timeContainer = this.timePickerTextContainer.append("div")
            .classed('tsi-dateTimeContainer', true);
        ["From", "To"].forEach((fromOrTo, i) => {
            var inputDiv = timeContainer.append("div")
                .classed("tsi-dateTimeInputDiv", true)
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

        options.filter((d) => d[0] == "Last 7 Days")
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
        var visibileAvailability = this.createDisplayBuckets(fromMillis, toMillis);
        this.chartOptions.keepBrush = true;
        var aeWithNewTimeSpan = {...this.ae[0], ...{searchSpan: {
            from: (new Date(fromMillis)),
            to: (new Date(toMillis))
        }}};
        this.timePickerLineChart.render(visibileAvailability, this.chartOptions, [aeWithNewTimeSpan]);
        this.setTicks();
        this.timePickerLineChart.setBrush();   
    }

    public setBrush (fromMillis, toMillis) {
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
            color: null,
            brushHandlesVisible: true,
            brushMoveAction: (from, to) => {
                this.setAvailabilityRange(from.valueOf(), to.valueOf());
            },
            brushClearable: false,
            hideChartControlPanel: true
        };
    }
}

export {AvailabilityChart}

import * as d3 from "d3";
import "./AvailabilityChart.scss";
import LineChart from "../LineChart/LineChart";
import DateTimePicker from "../DateTimePicker/DateTimePicker";
import Utils from "../../Utils";
import { ChartComponent } from "../../Interfaces/ChartComponent";
import UXClient from "../../UXClient";
import DateTimeButtonRange from "../DateTimeButtonRange/DateTimeButtonRange";

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
    private minGhostWidth = 2;
    private timeContainer;

    private dateTimeButton: DateTimeButtonRange;

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
    private dateTimePickerContainer: any;
    private dateTimePicker: any;
	
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

    private zoom (event: any, direction: string, xPos: number) {
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
        this.timePickerLineChart.drawBrushRange();
        event.preventDefault && event.preventDefault();
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
            singleLineXAxisLabel: false
        }});
    }
    private dateTimePickerAction (fromMillis, toMillis) {
        this.setBrush(fromMillis, toMillis, true);
        this.chartOptions.brushMoveEndAction(new Date(fromMillis), new Date(toMillis), this.chartOptions.offset);
        this.setTicks();
        this.dateTimePickerContainer.style("display", "none");
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
        var lastBucket: number = createKey(toMillis);
        var buckets = [];
        for (var i: number = firstBucket; i <= lastBucket; i += computedBucketSize) {
            buckets[(new Date(i)).toISOString()] = {count: 0};
        }

        Object.keys(keysInRange).sort().forEach((ts: string, i) => {
            var tsMillis = (new Date(ts)).valueOf();
            var computedKey = createKey(tsMillis);
            buckets[(new Date(computedKey)).toISOString()].count += (keysInRange[ts].count / bucketMultiplier); 
        });

        if (fromMillis !== null && firstBucket !== null) {
            buckets[(new Date(fromMillis)).toISOString()] = buckets[(new Date(firstBucket)).toISOString()];
        }
        if (toMillis !== null && lastBucket !== null) {
            buckets[(new Date(toMillis)).toISOString()] = buckets[(new Date(lastBucket)).toISOString()];
        }
        // delete the bucket before the from time
        if (firstBucket < fromMillis) {
            delete buckets[(new Date(firstBucket)).toISOString()];
        }
            
        return [{"availabilityCount" : {"" : buckets}}];
    }
    private setRangeVariables (rawAvailability) {
        if (Utils.safeNotNullOrUndefined(() => rawAvailability.range.from || rawAvailability.range.to || rawAvailability.intervalSize)) {
            this.fromMillis = (new Date(rawAvailability.range.from)).valueOf();
            this.toMillis = (new Date(rawAvailability.range.to)).valueOf();
            this.bucketSize = Utils.parseTimeInput(rawAvailability.intervalSize);
        } else {
            this.fromMillis = null;
            this.toMillis = null;
            this.bucketSize = null;
        }
    }

    public render (transformedAvailability: any, chartOptions: any, rawAvailability: any = {}) {
        this.setChartOptions(chartOptions);
        this.rawAvailability = rawAvailability;
        this.transformedAvailability = transformedAvailability;
        this.color = this.chartOptions.color ? this.chartOptions.color : 'teal'; 
        this.maxBuckets = (this.chartOptions.maxBuckets) ? this.chartOptions.maxBuckets : 500;
        this.setRangeVariables(rawAvailability);

        var startBucket = (this.fromMillis !== null && this.bucketSize !== null) ? 
            Math.round(Math.floor(this.fromMillis / this.bucketSize) * this.bucketSize) : null;
        var endBucket = (this.toMillis !== null && this.bucketSize !== null) ? 
            Math.round(Math.floor(this.toMillis / this.bucketSize) * this.bucketSize) : null;
        
        if (startBucket !== null && startBucket === endBucket) {
            this.fromMillis = Math.floor(this.fromMillis / this.bucketSize) * this.bucketSize;
            this.toMillis = this.fromMillis + this.bucketSize; 
            this.bucketSize = this.bucketSize / 60;
        }

        this.ae = [new this.uxClient.AggregateExpression({predicateString: ""}, {property: 'Count', type: "Double"}, ['count'],
        { from: new Date(this.fromMillis), to: new Date(this.toMillis) }, null, 'grey', 'Availability')];

        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-availabilityChart", true)
            .classed("tsi-compact", this.chartOptions.isCompact)
            .classed("tsi-withButton", this.chartOptions.persistDateTimeButtonRange);

        this.chartOptions.yAxisHidden = true;
        this.chartOptions.focusHidden = true;
        this.chartOptions.singleLineXAxisLabel = true;
        this.chartOptions.suppressResizeListener = true;
        this.chartOptions.brushClearable = false;
        this.chartOptions.minBrushWidth = 1;
        this.chartOptions.brushHandlesVisible = true;

        let brushMoveAction = this.chartOptions.brushMoveAction;

        this.chartOptions.brushMoveAction = (from, to) => {
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
            this.timePickerContainer = this.targetElement.append("div")
                .classed("tsi-timePickerContainer", true);
            this.timePickerChart = this.timePickerContainer.append("div").classed("tsi-timePickerChart", true);
            var sparkLineContainer = this.targetElement.append("div").classed("tsi-sparklineContainer", true);
            this.timePickerTextContainer = this.targetElement.append("div").classed("tsi-timePickerTextContainer", true)
                .style("margin-left", this.chartOptions.availabilityLeftMargin + this.margins.left);
            this.timePickerLineChart = new LineChart(this.timePickerChart.node() as any);
            this.timePickerLineChart.chartMargins.left = (this.chartOptions.availabilityLeftMargin - this.margins.left);
            this.buildFromAndToContainer();
            this.sparkLineChart = new LineChart(sparkLineContainer.node() as any);
            this.sparkLineChart.chartMargins.left = (this.chartOptions.availabilityLeftMargin - this.margins.left);
            this.dateTimePickerContainer = this.targetElement.append("div").classed("tsi-dateTimePickerContainer", true);
            this.dateTimePicker = new DateTimePicker(this.dateTimePickerContainer.node());
            window.addEventListener('resize', () => {
                this.timePickerLineChart.draw();
                this.setTicks();
                this.drawWarmRange();
                if (this.chartOptions.isCompact)
                    this.buildCompactFromAndTo();
                setTimeout(() => {
                    this.drawGhost();
                }, 100);
            });
            var pickerContainerAndContent = this.targetElement.selectAll(".tsi-dateTimePickerContainer, .tsi-dateTimePickerContainer *");
        }

        //clear the date time picker
        this.dateTimePickerContainer.style("display", "none");

        this.timePickerContainer.selectAll('.tsi-compactFromTo').remove();
        if (this.chartOptions.isCompact) {
            this.targetElement.select('.tsi-sparklineContainer').style("display", 'none');
            if(!this.chartOptions.persistDateTimeButtonRange)
                this.targetElement.select(".tsi-timePickerTextContainer").style('display', 'none');
            this.targetElement.select('.tsi-zoomButtonContainer').style('display', 'none');
            this.targetElement.select('.tsi-timePickerContainer').style('max-height', '68px').style('top', this.chartOptions.persistDateTimeButtonRange ? '6px' : '20px');
        } else {
            this.targetElement.select('.tsi-sparklineContainer').style("display", 'flex');
            this.targetElement.select(".tsi-timePickerTextContainer").style('display', 'inherit');
            this.targetElement.select('.tsi-zoomButtonContainer').style('display', 'flex');
            this.targetElement.select('.tsi-timePickerContainer').style('max-height', 'none').style('top', '0px');
        }

        var sparkLineOptions: any = this.createSparkLineOptions(chartOptions);

        var visibileAvailability = this.createDisplayBuckets(this.fromMillis, this.toMillis);
        this.sparkLineChart.render(visibileAvailability, sparkLineOptions, this.ae);

        this.timePickerLineChart.render(visibileAvailability, this.chartOptions, this.ae);
        this.setTicks();
        this.drawWarmRange();

        if (!this.chartOptions.preserveAvailabilityState) { 
            this.zoomedToMillis = this.toMillis; 
            this.zoomedFromMillis = this.chartOptions.defaultAvailabilityZoomRangeMillis ? Math.max(this.fromMillis, this.toMillis - this.chartOptions.defaultAvailabilityZoomRangeMillis) : this.fromMillis;
            this.sparkLineChart.setBrushStartTime(new Date(this.zoomedFromMillis)); 
            this.sparkLineChart.setBrushEndTime(new Date(this.zoomedToMillis)); 
            this.setFromAndToTimes(Math.max(this.fromMillis, this.toMillis - (24 * 60 * 60 * 1000)), this.toMillis); 
            this.setBrush(Math.max(this.fromMillis, this.toMillis - (24 * 60 * 60 * 1000)), this.toMillis); 
        } else {
            if (this.zoomedFromMillis == null) this.zoomedFromMillis = this.chartOptions.defaultAvailabilityZoomRangeMillis ? Math.max(this.fromMillis, this.toMillis - this.chartOptions.defaultAvailabilityZoomRangeMillis) : this.fromMillis;
            if (this.zoomedToMillis == null) this.zoomedToMillis = this.toMillis; 
            if (this.sparkLineChart.brushStartTime == null) this.sparkLineChart.setBrushStartTime(new Date(this.zoomedFromMillis)); 
            if (this.sparkLineChart.brushEndTime == null) this.sparkLineChart.setBrushEndTime(new Date(this.zoomedToMillis)); 
            if (this.selectedFromMillis == null || this.selectedToMillis == null) this.setFromAndToTimes(this.toMillis - (24 * 60 * 60 * 1000), this.toMillis); 
            this.drawGhost();
            this.setBrush(this.selectedFromMillis, this.selectedToMillis);
        }

        this.sparkLineChart.setBrush();

        var self = this;
        this.timePickerChart.select(".brushElem").on("wheel.zoom", function (event, d) {
            let direction = event.deltaY > 0 ? 'out' : 'in';
            let xPos = (d3.pointer(event)[0]);
            self.zoom(event, direction, xPos);
        });
        if (!this.chartOptions.isCompact) {
            this.buildZoomButtons();
        } else {
            this.timePickerChart.select('.brushElem').select('.selection')
        }
        this.setAvailabilityRange(this.zoomedFromMillis, this.zoomedToMillis);
        if (this.chartOptions.isCompact) {
            this.buildCompactFromAndTo();
        }
        this.timePickerLineChart.drawBrushRange();
    }

    private buildZoomButtons() {
        this.targetElement.selectAll(".tsi-zoomButtonContainer").remove();
        let midpoint = (this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]) / 2;
        var buttonsDiv = this.targetElement.append("div")
            .classed("tsi-zoomButtonContainer", true);
        buttonsDiv.append("button")
            .attr("class", "tsi-zoomButton tsi-zoomButtonIn")
            .attr('aria-label', this.getString('A line chart zoom in'))
            .attr('title', this.getString('zoom in'))
            .on("click", (event) => {
                this.zoom(event, "in", midpoint);
            });
        buttonsDiv.append("button")
            .attr("class", "tsi-zoomButton tsi-zoomButtonOut")
            .attr('aria-label', this.getString('A line chart zoom out'))
            .attr('title', this.getString('zoom out'))
            .on("click", (event) => {
                this.zoom(event, "out", midpoint);
            });
    }

    private setSelectedMillis (fromMillis, toMillis) {
        this.selectedFromMillis = fromMillis;
        this.selectedToMillis = toMillis;
        this.timePickerLineChart.drawBrushRange();
    }

    private renderDateTimeButton () {
        let minMillis = this.fromMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.fromMillis) * 60 * 1000);
        let maxMillis = this.toMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.toMillis) * 60 * 1000);
        let startMillis = this.selectedFromMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.selectedFromMillis) * 60 * 1000);
        let endMillis = this.selectedToMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.selectedFromMillis) * 60 * 1000);
        this.dateTimeButton.render(this.chartOptions, this.fromMillis, this.toMillis, this.selectedFromMillis, this.selectedToMillis, 
            (fromMillis, toMillis, offset) => {
                this.chartOptions.offset = offset;
                this.timePickerLineChart.chartOptions.offset = offset;
                this.sparkLineChart.chartOptions.offset = offset;
                this.dateTimePickerAction(fromMillis, toMillis);
                (<any>d3.select(this.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
            },
            () => {
                this.dateTimePickerContainer.style("display", "none");
                (<any>d3.select(this.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
            });
    }

    private setFromAndToTimes (fromMillis, toMillis, isFromButton = false) {
        let timezone = Utils.parseTimezoneName(this.chartOptions.offset);
        let timezoneAbbreviation = Utils.timezoneAbbreviation(timezone);
        this.setSelectedMillis(fromMillis, toMillis);
        if (!isFromButton) {
            this.renderDateTimeButton();
        }
    }

    private drawGhost () {
        var svgGroup = this.targetElement.select('.tsi-sparklineContainer').select(".tsi-lineChartSVG").select(".svgGroup");
        svgGroup.selectAll(".ghostRect").remove();
        svgGroup.append("rect")
            .classed("ghostRect", true)
            .attr("x", Math.max(this.sparkLineChart.x.range()[0], this.sparkLineChart.x(new Date(this.selectedFromMillis))))
            .attr("y", 0)
            .attr("width", Math.min(Math.max(this.minGhostWidth, 
                            this.sparkLineChart.x(new Date(this.selectedToMillis)) - this.sparkLineChart.x(new Date(this.selectedFromMillis))), 
                            this.sparkLineChart.x.range()[1] - this.sparkLineChart.x.range()[0]))
            .attr("height", 8)
            .attr("fill", this.chartOptions.color ? this.chartOptions.color : 'dark-grey')
            .attr("fill-opacity", .3)
            .attr("pointer-events", "none");
    }

    private drawWarmRange () {

        var svgGroup = this.targetElement.select('.tsi-timePickerContainer').select(".tsi-lineChartSVG").select(".svgGroup");
        if (svgGroup.select('.tsi-warmRect').empty()) {
            svgGroup.append("rect")
                .classed("tsi-warmRect", true);
            svgGroup.select('.brushElem').raise();
        }
        let warmRect = svgGroup.select(".tsi-warmRect");
 
        let outOfRange = true;
        if (this.chartOptions.warmStoreRange) {
            let warmStart = new Date(this.chartOptions.warmStoreRange[0]);
            let boundedWarmStart = new Date(Math.max(warmStart.valueOf(), this.zoomedFromMillis));
            let warmEnd = new Date(this.chartOptions.warmStoreRange.length === 2 ? this.chartOptions.warmStoreRange[1] : this.toMillis);
            let boundedWarmEnd = new Date(Math.min(warmEnd.valueOf(), this.zoomedToMillis));

            if (boundedWarmStart < boundedWarmEnd) {
                outOfRange = false;
                warmRect.attr("x", Math.max(this.timePickerLineChart.x(boundedWarmStart)))
                    .attr("y", this.chartOptions.isCompact ? 12 : -8)
                    .attr("width", this.timePickerLineChart.x(boundedWarmEnd) - this.timePickerLineChart.x(boundedWarmStart))
                    .attr("height", this.chartOptions.isCompact ? 4 : Math.max((this.targetElement.select('.tsi-timePickerContainer').select(".tsi-lineChartSVG").node().getBoundingClientRect().height - 44), 0))
                    .attr("fill-opacity", this.chartOptions.isCompact ? .8 : .08)
                    .attr('stroke-opacity', this.chartOptions.isCompact ? 0 : .5)
                    .attr("pointer-events", "none");
            } 
        }
        if (outOfRange || this.chartOptions.warmStoreRange === null) {
            warmRect.style('display', 'none');
        } else {
            warmRect.style('display', 'block');
        }
    }

    private buildCompactFromAndTo () { 
        this.timePickerContainer.selectAll('.tsi-compactFromTo').remove();

        // if the view is compact and there is a datetimebuttonrange present, we don't need compact from and to
        if(this.chartOptions.persistDateTimeButtonRange)
            return;
        
            var brushPositions = this.timePickerLineChart.getBrushPositions();
        var leftTimeText = null;
        var rightTimeText = null;

        if (this.selectedFromMillis != null && this.selectedToMillis != null) {
            leftTimeText = this.timePickerContainer.append('div')
                .classed('tsi-compactFromTo', true)
                .style('left', (brushPositions.leftPos != null ? Math.max(brushPositions.leftPos, 5) : 5) + 'px')
                .text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(this.selectedFromMillis)));
            let timezoneAbbreviation = ' (' + Utils.createTimezoneAbbreviation(this.chartOptions.offset) + ')';
            rightTimeText = this.timePickerContainer.append('div')
                .attr('class', 'tsi-compactFromTo')
                .style('right', brushPositions.rightPos != null ? 'calc(100% - ' + brushPositions.rightPos + 'px)' : '5px')
                .style('left', 'auto')
                .text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)
                            (new Date(this.selectedToMillis)) + timezoneAbbreviation);
        }

        if (leftTimeText && rightTimeText) {
            var rightSideOfLeft = leftTimeText.node().getBoundingClientRect().left + leftTimeText.node().getBoundingClientRect().width ;
            var leftSideOfRight = rightTimeText.node().getBoundingClientRect().left;
            var totalWidth = this.timePickerContainer.node().getBoundingClientRect().width;
            var minOffset = 40;
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

    private offsetUTC (date: Date) {
        date.setTime( date.getTime() + date.getTimezoneOffset()*60*1000 );
        return date;
    }

    private buildFromAndToContainer () {
        let dateTimeContainer = this.timePickerTextContainer.append('div').classed('tsi-dateTimeContainer', true);
        let timeframeLabel = dateTimeContainer.append("label").text(this.getString("Timeframe")).attr("id", "time-frame-label");
        let dateTimeButtonContainer = dateTimeContainer.append("div")
            .classed('tsi-dateTimeButtonContainer', true)
            .attr("aria-labelledby", 'time-frame-label');
        this.dateTimeButton = new DateTimeButtonRange(dateTimeButtonContainer.node());
    }

    private setTicks () {
        this.timePickerLineChart.updateXAxis();
        let forceFirst = (this.timePickerLineChart.zoomedFromMillis == this.timePickerLineChart.fromMillis) && (this.zoomedFromMillis == this.fromMillis);
        let forceLast = (this.timePickerLineChart.zoomedToMillis == this.timePickerLineChart.toMillis) && (this.zoomedToMillis == this.toMillis);
        this.timePickerLineChart.updateXAxis(forceFirst, forceLast);

        let ticks = this.timePickerContainer.select('.tsi-timePickerChart')
            .select('.xAxis')
            .selectAll('.tick');
        ticks.each(function(d, i){
            var elt = d3.select(this);
            elt.classed((i === 0 && forceFirst ? 'tsi-fromTick' : (i === ticks.size() - 1 && forceLast ? 'tsi-toTick' : '')), true);
        })
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
        this.drawWarmRange();
        this.timePickerLineChart.setBrush();   
    }

    public setBrush (fromMillis, toMillis, isFromButton = false) {
        this.timePickerLineChart.setBrushEndTime(new Date(toMillis));
        this.timePickerLineChart.setBrushStartTime(new Date(fromMillis));
        this.timePickerLineChart.setBrush();
        this.setFromAndToTimes(fromMillis, toMillis, isFromButton);
        this.drawGhost();

        if(this.chartOptions.isCompact)
            this.buildCompactFromAndTo();
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
            hideChartControlPanel: true,
            brushRangeVisible: false,
            isArea: true
        };
    }
}

export default AvailabilityChart
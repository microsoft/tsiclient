import * as d3 from 'd3';
import './Marker.scss';
import {Utils, LINECHARTCHARTMARGINS, DataTypes} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { LineChartData } from '../../Models/LineChartData';

class Marker extends Component {
    //DOM components
    private markerContainer: any;
    private timeLabel: any;
    private closeButton: any;

    private x: any;
    private timestampMillis: number;
    private chartHeight: number;
    private chartMargins: any;
    private chartComponentData: LineChartData;
    private marginLeft: number;
    private colorMap: any;
    private yMap: any;
    private onChange: any;

	constructor(renderTarget) {
        super(renderTarget);
    }

    public getMillis () {
        return this.timestampMillis;
    }

    private createMarker () {
        this.markerContainer = d3.select(this.renderTarget)
            .append('div')
            .attr('class', 'tsi-markerContainer');

        this.markerContainer.append("div")
            .attr("class", "tsi-markerLine");

        this.markerContainer.append("div")
            .attr("class", "tsi-markerDragger")
            .on("mouseover", function () {
                d3.select(this).classed("tsi-isHover", true);
            })
            .on("mouseout", function () {
                d3.select(this).classed("tsi-isHover", false);
            })
            .on("contextmenu", function () {
                d3.select(d3.select(this).node().parentNode).remove();
                d3.event.preventDefault();
            });

        this.timeLabel = this.markerContainer.append("div")
            .attr("class", "tsi-markerTimeLabel");

        let self = this;
        this.markerContainer.selectAll(".tsi-markerDragger,.tsi-markerTimeLabel,.tsi-markerLine")
            .call(d3.drag()
                .on("drag", function (d) {
                    if (d3.select(d3.event.sourceEvent.target).classed("tsi-closeButton")) {
                        return;
                    }
                    let marker = d3.select(<any>d3.select(this).node().parentNode);
                    let startPosition = self.x(new Date(self.timestampMillis));
                    let newPosition = startPosition + d3.event.x;

                    self.timestampMillis = Utils.findClosestTime(self.x.invert(newPosition).valueOf(), self.chartComponentData.timeMap);
                    self.setPositionsAndLabels(self.timestampMillis);
                })
                .on("end", function (d) {
                    if (!d3.select(d3.event.sourceEvent.target).classed("tsi-closeButton")) {
                        self.onChange(false, false);
                    }
                })
            );

    }

    private setMarkerPosition (closestTime: number) {
        this.markerContainer
            .style('top', this.chartMargins.top + this.chartOptions.aggTopMargin + "px")
            .style("height", this.chartHeight - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin) + "px");
        this.setMarkerXPosition(closestTime);
    }

    private setMarkerXPosition (millis: number) {
        this.markerContainer.style("left", (d) => {
            return (Math.round(this.x(millis) + this.marginLeft) + "px");
        });
    }

    private getValueOfVisible (d: any) {
        return Utils.getValueOfVisible(d, this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy))
    }

    private setValueLabels (closestTime) {
        let values = this.chartComponentData.timeMap[closestTime] != undefined ? this.chartComponentData.timeMap[closestTime] : [];

        values = values.filter((d) => {
            return (this.getValueOfVisible(d) !== null) && this.chartComponentData.getDataType(d.aggregateKey) === DataTypes.Numeric; 
        });
        let self = this;

        let valueLabels = this.markerContainer.selectAll(".tsi-markerValue").data(values, (d) => {
            return d.aggregateKey + "_" + d.splitBy;
        });

        valueLabels.enter()
            .append("div")
            .classed("tsi-markerValue", true)
            .merge(valueLabels)
            .each(function (d: any) {
                let valueLabel = d3.select(this).selectAll(".tsi-markerValueLabel").data([d]);
                valueLabel.enter()
                    .append("div")
                    .classed("tsi-markerValueLabel", true)
                    .merge(valueLabel)
                    .text(() => Utils.formatYAxisNumber(self.getValueOfVisible(d)))
                    .style("border-color", () => self.colorMap[d.aggregateKey + "_" + d.splitBy])
                valueLabel.exit().remove();

                let valueCaret = d3.select(this).selectAll(".tsi-markerValueCaret").data([d])
                valueCaret.enter()
                    .append("div")
                    .classed("tsi-markerValueCaret", true)
                    .merge(valueCaret)
                    .style("border-right-color", () => self.colorMap[d.aggregateKey + "_" + d.splitBy]);
                valueCaret.exit().remove();
            })
            .transition()
            .duration(self.chartOptions.noAnimate ? 0 : self.TRANSDURATION)
            .style('top', (d) => this.calcTopOfValueLabel(d));

        valueLabels.exit().remove();
    }

    private calcTopOfValueLabel (d: any) {
        let yScale = this.yMap[d.aggregateKey];
        return Math.round(yScale(this.getValueOfVisible(d)) - this.chartOptions.aggTopMargin) + "px";
    }


    private setTimeLabel (closestTime: number) {
        let values: Array<any> = this.chartComponentData.timeMap[closestTime];
        if (values == undefined || values.length == 0) {
            return;
        }
        let firstValue = values[0].dateTime;
        let secondValue = new Date(values[0].dateTime.valueOf() + (values[0].bucketSize != null ? values[0].bucketSize : 0));
        let timeFormat = Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
            this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale);
        let dateToTime = (t) => ((timeFormat(t).split(" ") && timeFormat(t).split(" ").length > 1) ? timeFormat(t).split(" ")[1] : '');
        let text = dateToTime(firstValue) + " - " + dateToTime(secondValue);
        let self = this;

        this.timeLabel.text(text);

        this.closeButton = this.timeLabel.append("button")
            .attr("aria-label", this.getString("Delete marker at") + ' ' + text) 
            .classed("tsi-closeButton", true)
            .on("click", function () {
                d3.select(d3.select(this).node().parentNode.parentNode).remove();
                self.onChange(true, false);
            });

        let markerLeft: number = Number(this.markerContainer.style("left").replace("px", ""));
        let timeLabelWidth: number = Math.round(this.timeLabel.node().getBoundingClientRect().width);
        let minLeftPosition = this.marginLeft + 20;
        let width = this.x.range()[1] - this.x.range()[0];
        let maxRightPosition = width + this.marginLeft; // TODO this needs work
        let calculatedLeftPosition = markerLeft - (timeLabelWidth / 2);
        let calculatedRightPosition = markerLeft + (timeLabelWidth / 2);
        let translate = "translateX(calc(-50% + 1px))";
        if (calculatedLeftPosition < minLeftPosition) {
            translate = "translateX(-" + Math.max(0, markerLeft - minLeftPosition) + "px)";
        }
        if (calculatedRightPosition > maxRightPosition) {
            translate = "translateX(calc(-50% + " + (maxRightPosition - calculatedRightPosition) + "px))";
        }

        this.timeLabel
            .style("-webkit-tranform", translate)
            .style("transform", translate);
    }

    public focusCloseButton () {
        this.closeButton.node().focus();
    }

    private isMarkerInRange (millis: number) {
        let domain = this.x.domain();
        return !(millis < domain[0].valueOf() || millis > domain[1].valueOf());
    }

    public destroyMarker () {
        if (this.markerContainer) {
            this.markerContainer.remove();
        }
        this.markerContainer = null;
    }

    public render (timestampMillis: number, chartOptions: ChartOptions, chartMargins: any, chartComponentData: any, x: any, chartHeight: number, marginLeft: number, 
                    colorMap: any, yMap: any, onChange: any, isDropping: boolean = false) {
        this.chartMargins = Object.assign({}, chartMargins);
        this.chartHeight = chartHeight;
        this.timestampMillis = timestampMillis;
        this.chartOptions = chartOptions;
        this.x = x;
        this.chartComponentData = chartComponentData;
        this.marginLeft = marginLeft;
        this.colorMap = colorMap;

        this.yMap = yMap;
        if (onChange) { // only update onChange if passed in, otherwise maintain previous
            this.onChange = onChange;
        }

        if (!this.isMarkerInRange(this.timestampMillis)) {
            this.destroyMarker();
            return;
        }
        if (!this.markerContainer) {
            this.createMarker();
        }

        let closestTime = Utils.findClosestTime(this.timestampMillis, this.chartComponentData.timeMap);
        this.setPositionsAndLabels(closestTime);
        super.themify(this.markerContainer, this.chartOptions.theme);
    }

    public setPositionsAndLabels (millis: number) {
        if (!this.isMarkerInRange(millis)) {
            this.destroyMarker();
            return;
        }

        if (!this.markerContainer) {
            this.createMarker();
        }

        this.setMarkerPosition(millis);
        this.setTimeLabel(millis);
        this.setValueLabels(millis);
    }

}

export {Marker}
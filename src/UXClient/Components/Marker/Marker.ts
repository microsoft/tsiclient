import * as d3 from 'd3';
import './Marker.scss';
import {Utils, LINECHARTCHARTMARGINS, DataTypes, MARKERVALUENUMERICHEIGHT, LINECHARTXOFFSET} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { LineChartData } from '../../Models/LineChartData';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartComponentData } from '../../Models/ChartComponentData';

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
    private tooltipMap: any = {};
    private guid: string;

    readonly ADDITIONALRIGHTSIDEOVERHANG = 12;

	constructor(renderTarget) {
        super(renderTarget);
        this.guid = Utils.guid();
    }

    public getMillis () {
        return this.timestampMillis;
    }

    private renderMarker () {
        let self = this;
        let marker = d3.select(this.renderTarget).selectAll(`.tsi-markerContainer`)
            .filter((d: any) => d.guid === this.guid)
            .data([{guid: this.guid, timestamp: this.timestampMillis}]);
        this.markerContainer = marker.enter()
            .append('div')
            .attr('class', 'tsi-markerContainer')
            .merge(marker)
            .style('top', `${this.chartMargins.top + this.chartOptions.aggTopMargin}px`)
            .style('height', `${this.chartHeight - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin)}px`)
            .style('left', (d: any) => {
                return `${Math.round(this.x(d.timestamp) + this.marginLeft)}px`;
            })
            .each(function(markerD) {
                if (d3.select(this).selectAll('.tsi-markerLine').empty()) {
                    d3.select(this).append('div')
                        .attr('class', 'tsi-markerLine');

                    d3.select(this).append('div')
                        .attr('class', 'tsi-markerDragger')
                        .on('mouseover', function () {
                            d3.select(this).classed('tsi-isHover', true);
                        })
                        .on('mouseout', function () {
                            d3.select(this).classed('tsi-isHover', false);
                        })
                        .on('contextmenu', function () {
                            d3.select((d3.select(this).node() as any).parentNode).remove();
                            d3.event.preventDefault();
                        });

                    self.timeLabel = d3.select(this).append("div")
                        .attr('class', 'tsi-markerTimeLabel');
                }
                d3.select(this).selectAll('.tsi-markerDragger,.tsi-markerTimeLabel,.tsi-markerLine')
                    .call(d3.drag()
                        .on('start', function(d: any) {
                            // put the marker being dragged on top
                            d3.select(self.renderTarget).selectAll('.tsi-markerContainer').sort((a: any, b: any) => {  
                                if (a.timestamp === markerD.timestamp)
                                    return 1;
                                if (b.timestamp === markerD.timestamp)
                                    return -1;
                                return a.timestamp < b.timestamp ? 1 : -1;
                            });
                        })
                        .on('drag', function (d) {
                            if (d3.select(d3.event.sourceEvent.target).classed('tsi-closeButton')) {
                                return;
                            }
                            let marker = d3.select(<any>d3.select(this).node().parentNode);
                            let startPosition = self.x(new Date(self.timestampMillis));
                            let newPosition = startPosition + d3.event.x;

                            self.timestampMillis = Utils.findClosestTime(self.x.invert(newPosition).valueOf(), self.chartComponentData.timeMap);
                            self.setPositionsAndLabels(self.timestampMillis);
                        })
                        .on('end', function (d) {
                            if (!d3.select(d3.event.sourceEvent.target).classed('tsi-closeButton')) {
                                self.onChange(false, false);
                            }
                        })
                    );
            });
        marker.exit().remove();
    }

    private getValueOfVisible (d: any) {
        return Utils.getValueOfVisible(d, this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy))
    }

    private getTooltipKey (d: any) {
        return d.aggregateKey + '_' + d.splitBy;
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
            .style('top', (d) => this.calcTopOfValueLabel(d) + 'px')
            .each(function (d: any) {
                let tooltipKey = self.getTooltipKey(d);
                let tooltip;
                
                if (self.tooltipMap[tooltipKey]) {
                    tooltip = self.tooltipMap[tooltipKey];
                } else {
                    tooltip = new Tooltip(d3.select(this));
                    self.tooltipMap[tooltipKey] = tooltip;
                }
                tooltip.render(self.chartOptions.theme);
                let tooltipHeight = MARKERVALUENUMERICHEIGHT;
                tooltip.draw(d, self.chartComponentData, 0, tooltipHeight/2, {right:0, left:0, top:0, bottom:0}, (tooltipTextElement) => {

                    tooltipTextElement.text(Utils.formatYAxisNumber(self.getValueOfVisible(d)))
                        .classed('tsi-markerValueTooltipInner', true)
                        .style('height', tooltipHeight + 'px')
                        .style('line-height', ((tooltipHeight - 2) + 'px')) // - 2 to account for border height
                        .style('border-color', self.colorMap[d.aggregateKey + "_" + d.splitBy]);                
                        
                }, null, 0, 0, self.colorMap[d.aggregateKey + "_" + d.splitBy]);

                let markerValueCaret = d3.select(this).selectAll('.tsi-markerValueCaret')
                    .data([d]);
                markerValueCaret.enter().append('div')
                    .attr('class', 'tsi-markerValueCaret')
                    .merge(markerValueCaret)
                    .style("border-right-color", () => self.colorMap[d.aggregateKey + "_" + d.splitBy]);
                markerValueCaret.exit().remove();
            });

        let valueLabelsExit = valueLabels.exit();
        valueLabelsExit.each((d) => {
            delete this.tooltipMap[this.getTooltipKey(d)];
        })
        valueLabelsExit.remove();
    }

    private calcTopOfValueLabel (d: any) {
        let yScale = this.yMap[d.aggregateKey];
        return Math.round(yScale(this.getValueOfVisible(d)) - this.chartOptions.aggTopMargin);
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
        let minLeftPosition = this.marginLeft + LINECHARTXOFFSET;
        let width = this.x.range()[1] - this.x.range()[0];
        let maxRightPosition = width + this.marginLeft + LINECHARTXOFFSET + this.ADDITIONALRIGHTSIDEOVERHANG;
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


    public render (timestampMillis: number, chartOptions: ChartOptions, chartComponentData: any, additionalMarkerFields: {chartMargins: any, x: any, marginLeft: number, colorMap: any, yMap: any, onChange: any, isDropping: boolean, chartHeight: number}) {
        this.chartMargins = Object.assign({}, additionalMarkerFields.chartMargins);
        this.chartHeight = additionalMarkerFields.chartHeight;
        this.timestampMillis = timestampMillis;
        this.chartOptions = chartOptions;
        this.x = additionalMarkerFields.x;
        this.chartComponentData = chartComponentData;
        this.marginLeft = additionalMarkerFields.marginLeft;
        this.colorMap = additionalMarkerFields.colorMap;

        this.yMap = additionalMarkerFields.yMap;
        if (additionalMarkerFields.onChange) { // only update onChange if passed in, otherwise maintain previous
            this.onChange = additionalMarkerFields.onChange;
        }

        if (!this.isMarkerInRange(this.timestampMillis)) {
            this.destroyMarker();
            return;
        }

        this.renderMarker();

        let closestTime = Utils.findClosestTime(this.timestampMillis, this.chartComponentData.timeMap);
        this.setPositionsAndLabels(closestTime);
        super.themify(this.markerContainer, this.chartOptions.theme);
    }

    public setPositionsAndLabels (millis: number) {
        if (!this.isMarkerInRange(millis)) {
            this.destroyMarker();
            return;
        }
        this.renderMarker();
        this.setTimeLabel(millis);
        this.setValueLabels(millis);
    }

}

export {Marker}
import * as d3 from 'd3';
import './Marker.scss';
import Utils from "../../Utils";
import { MARKERVALUENUMERICHEIGHT, LINECHARTXOFFSET } from "./../../Constants/Constants";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { LineChartData } from '../../Models/LineChartData';
import Tooltip  from '../Tooltip';
import { KeyCodes, ShiftTypes, DataTypes, TooltipMeasureFormat } from '../../Constants/Enums';

const MARKERSTRINGMAXLENGTH = 250;
const MARKERVALUEMAXWIDTH = 80;

class Marker extends Component {
    //DOM components
    private markerContainer: any;
    private timeLabel: any;
    private closeButton: any;
    private markerLabel: any;

    private x: any;
    private timestampMillis: number;
    private chartHeight: number;
    private chartMargins: any;
    private chartComponentData: LineChartData;
    private marginLeft: number;
    private colorMap: any;
    private yMap: any;
    public onChange: any;
    private tooltipMap: any = {};
    private guid: string;
    private labelText: string = '';
    private markerIsDragging: boolean = false;
    private timeFormat;
    private isSeriesLabels: boolean = false;

    readonly ADDITIONALRIGHTSIDEOVERHANG = 12;

	constructor(renderTarget) {
        super(renderTarget);
        this.guid = Utils.guid();
    }

    public getGuid () {
        return this.guid;
    }

    public setMillis (millis: number) {
        this.timestampMillis = millis;
    }

    public getMillis () {
        return this.timestampMillis;
    }

    // returns whether the string was trimmed to the max length
    public setLabelText (labelText: string): boolean {
        if (labelText.length > MARKERSTRINGMAXLENGTH) {
            this.labelText = labelText.slice(0, MARKERSTRINGMAXLENGTH);
            return true;
        }
        this.labelText = labelText;
        return false;
    }

    public getLabelText () {
        return this.labelText;
    }

    private setSeriesLabelText (d, text, isSeriesLabelInFocus) {
        text.classed('tsi-isExpanded', false);
        let title = text.append('h4')
            .attr('class', 'tsi-seriesLabelGroupName tsi-tooltipTitle');
        Utils.appendFormattedElementsFromString(title, d.aggregateName);
        let shiftTuple = this.chartComponentData.getTemporalShiftStringTuple(d.aggregateKey);
        let shiftString = '';
        if (shiftTuple !== null) {
            shiftString = shiftTuple[0] === ShiftTypes.startAt ? this.timeFormat(new Date(shiftTuple[1])) : shiftTuple[1]; 
        }

        let labelDatum = {
            splitBy: d.splitBy,
            variableAlias: this.chartComponentData.displayState[d.aggregateKey].aggregateExpression.variableAlias,
            timeShift: shiftString,
        }

        let subtitle = text.selectAll('.tsi-seriesLabelSeriesName').data([labelDatum]);
        let enteredSubtitle = subtitle.enter()
            .append('div')
            .attr('class', 'tsi-seriesLabelSeriesName tsi-tooltipSubtitle');

        if (labelDatum.splitBy && labelDatum.splitBy !== '') {
            enteredSubtitle.append('span')
                .classed('tsi-splitBy', true)
        }
        if (labelDatum.timeShift) {
            enteredSubtitle.append('span')
                .classed('tsi-timeShift', true)
        }
        if (labelDatum.variableAlias) {
            enteredSubtitle.append('span')
                .classed('tsi-variableAlias', true)
        }
        subtitle.exit().remove();
        Utils.setSeriesLabelSubtitleText(enteredSubtitle, false);
    }

	protected tooltipFormat (d, text, measureFormat: TooltipMeasureFormat, xyrMeasures = null, isSeriesLabelInFocus = false) {
        
        let tooltipHeight = MARKERVALUENUMERICHEIGHT;

        // revert to default text format if none specified
        if (!this.isSeriesLabels) {
            text.text(Utils.formatYAxisNumber(this.getValueOfVisible(d)))
                .style('height', tooltipHeight + 'px')
                .style('line-height', ((tooltipHeight - 2) + 'px')) // - 2 to account for border height

        } else {
            this.setSeriesLabelText(d, text, isSeriesLabelInFocus);
        }
        text.classed('tsi-markerValueTooltipInner', true)
            .style('border-color', this.colorMap[d.aggregateKey + "_" + d.splitBy]);                
    }

    private getLeft (d) {
        return Math.round(this.x(d.timestamp) + this.marginLeft);
    }


    // check to see if any marker is being dragged
    private isMarkerDragOccuring () {
        return this.markerIsDragging;
        return (d3.select(this.renderTarget).selectAll('.tsi-markerContainer').filter((d: any) => {
            return d.isDragging;
        }).size() > 0);
    }

    private bumpMarker () {
        d3.select(this.renderTarget).selectAll('.tsi-markerContainer')
        .style('animation', 'none')
        .sort((a: any, b: any) => {  
            if (a.timestamp === this.timestampMillis) {
                return 1;
            }
            if (b.timestamp === this.timestampMillis){
                return -1;
            }
            return a.timestamp < b.timestamp ? 1 : -1;
        });
    }

    private renderMarker () {
        let self = this;
        let marker = d3.select(this.renderTarget).selectAll<HTMLDivElement, unknown>(`.tsi-markerContainer`)
            .filter((d: any) => d.guid === this.guid)
            .data([{guid: this.guid, timestamp: this.timestampMillis}]);
        this.markerContainer = marker.enter()
            .append('div')
            .attr('class', 'tsi-markerContainer')
            .classed('tsi-isSeriesLabels', this.isSeriesLabels)
            .merge(marker)
            .style('top', `${this.chartMargins.top + this.chartOptions.aggTopMargin}px`)
            .style('height', `${this.chartHeight - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin)}px`)
            .style('left', (d: any) => {
                return `${this.getLeft(d)}px`;
            })
            .classed('tsi-isFlipped', (d) => {
                if (this.isSeriesLabels) {
                    return false;
                }
                return (this.chartOptions.labelSeriesWithMarker && this.x(d.timestamp) > (this.x.range()[1] - MARKERVALUEMAXWIDTH));
            }) 
            .each(function(markerD) {
                if (self.isSeriesLabels) {
                    return;
                }
                if (d3.select(this).selectAll('.tsi-markerLine').empty()) {
                    d3.select(this).append('div')
                        .attr('class', 'tsi-markerLine');
                    self.markerLabel = d3.select(this).append('div')
                        .attr('class', 'tsi-markerLabel')
                        .on('mouseleave', function () {
                            d3.select(this).classed('tsi-markerLabelHovered', false);
                        });

                    self.markerLabel.append('div')
                        .attr('class', 'tsi-markerGrabber')
                        .on('mouseenter', () => {
                            self.bumpMarker();    
                        });

                    self.markerLabel.append('div')
                        .attr('class', 'tsi-markerLabelText')
                        .attr('contenteditable', 'true')
                        .text(self.labelText)
                        .on('keydown', (event) =>{
                            if (event.keyCode === KeyCodes.Enter && !event.shiftKey) {
                                event.preventDefault();
                                self.closeButton.node().focus();
                            }
                        })
                        .on('input', function () {
                            let didTrim = self.setLabelText(d3.select(this).text());
                            if (didTrim) {
                                d3.select(this).text(self.labelText);
                            }
                        })
                        .on('focus', function () {
                            d3.select(this.parentNode).classed('tsi-markerLabelTextFocused', true);
                        })
                        .on('blur', function () {
                            d3.select(this.parentNode).classed('tsi-markerLabelTextFocused', false);
                            self.onChange(false, false, false);
                        })
                        .on('mousedown', (event) => {
                            event.stopPropagation();
                        })
                        .on('mouseover', function () {
                            if (!self.isMarkerDragOccuring()) {
                                d3.select(d3.select(this).node().parentNode).classed('tsi-markerLabelHovered', true);
                                self.bumpMarker();    
                            }
                        });
                    
                    self.closeButton = self.markerLabel.append("button")
                        .attr("aria-label", self.getString('Delete marker')) 
                        .classed("tsi-closeButton", true)
                        .on("click", function () {
                            self.onChange(true, false);
                            d3.select((d3.select(this).node() as any).parentNode.parentNode).remove();
                        });
            
                    self.timeLabel = d3.select(this).append("div")
                        .attr('class', 'tsi-markerTimeLabel');
                }
                d3.select(this).selectAll('.tsi-markerTimeLabel,.tsi-markerLine,.tsi-markerLabel')
                    .call(d3.drag()
                        .on('start', function(event, d: any) {
                            d.isDragging = true;
                            self.markerIsDragging = true;
                            self.bumpMarker();
                        })
                        .on('drag', function (event, d) {
                            if (d3.select(event.sourceEvent.target).classed('tsi-closeButton')) {
                                return;
                            }
                            let marker = d3.select(<any>d3.select(this).node().parentNode);
                            let startPosition = self.x(new Date(self.timestampMillis));
                            let newPosition = startPosition + event.x;

                            self.timestampMillis = Utils.findClosestTime(self.x.invert(newPosition).valueOf(), self.chartComponentData.timeMap);
                            self.setPositionsAndLabels(self.timestampMillis);
                        })
                        .on('end', function (event, d: any) {
                            if (!d3.select(event.sourceEvent.target).classed('tsi-closeButton')) {
                                self.onChange(false, false);
                            }
                            d.isDragging = false;
                            self.markerIsDragging = false;
                        })
                    );
            });
        marker.exit().remove();
    }

    private getValueOfVisible (d: any) {
        return Utils.getValueOfVisible(d, this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy));
    }

    private getTooltipKey (d: any) {
        return d.aggregateKey + '_' + d.splitBy;
    }

    private findYatX (x, path) {
        let pathParent = path.parentNode;
        let length_end = path.getTotalLength();
        let length_start = 0;
        let point = path.getPointAtLength((length_end + length_start) / 2);
        let bisection_iterations_max = 100;
        let bisection_iterations = 0;

        let error = 0.01;

        while (x < point.x - error || x > point.x + error) {
            point = path.getPointAtLength((length_end + length_start) / 2)
            if (x < point.x) {
                length_end = (length_start + length_end)/2
            } else {
                length_start = (length_start + length_end)/2
            }
            if(bisection_iterations_max < ++ bisection_iterations) {
                break;
            }
        }
        let offset = path.parentNode.parentNode.transform.baseVal[0].matrix.f;  // roundabout way of getting the y transform of the agg group
        return point.y + offset;
   }

    private positionToValue (yPos: number, aggKey: string) {
        let yScale = this.yMap[aggKey]; 
        return yScale.invert(yPos);   
    }

    private bisectionInterpolateValue (millis: number, aggKey: string, splitBy: string, path: any) {
        if (path === null) {
            return null;
        }
        let yPosition = this.findYatX(this.x(millis), path);
        let interpolatedValue = this.positionToValue(yPosition, aggKey);
        let newDatum = this.createNewDatum(aggKey, splitBy, interpolatedValue);
        newDatum.isInterpolated = true;
        return newDatum;
    }

    private getPath (aggKey: string, splitBy: string) {
        let selectedPaths = d3.select(this.renderTarget).selectAll('.tsi-valueLine').filter((d: any) => {
            if (d.length) {
                return d[0].aggregateKey === aggKey && d[0].splitBy === splitBy;
            }
            return false;
        });
        if (selectedPaths.size() === 0) {
            return null;
        }
        return selectedPaths.nodes()[0];
    }

    private createNewDatum (aggKey, splitBy, valueOfVisible) {
        let newDatum: any = {};
        newDatum.aggregateKey = aggKey;
        newDatum.splitBy = splitBy;
        newDatum.measures = {}
        newDatum.measures[this.chartComponentData.getVisibleMeasure(aggKey, splitBy)] = valueOfVisible;
        return newDatum;
    }

    private findGapPath (aggKey, splitBy, millis) {
        let gapPath = d3.select(this.renderTarget).selectAll('.tsi-gapLine')
            .filter((d: any) => {
                if (d.length === 2 && aggKey === d[0].aggregateKey && splitBy === d[0].splitBy) {
                    return (millis > d[0].dateTime.valueOf() && millis < d[1].dateTime.valueOf());
                }
                return false;
            });
        if (gapPath.size() === 0) {
            return null;
        }
        return gapPath.nodes()[0];
    }

    //check if a value is within the time constrained bounds of a path
    private inBounds (path: any, millis: number) {
        let filteredData = path.data()[0].filter((d) => {
            return d.measures && this.getValueOfVisible(d) !== null;
        })
        if (filteredData.length > 0) {
            let lowerBound = filteredData[0].dateTime.valueOf();
            let upperBound = filteredData[filteredData.length - 1].dateTime.valueOf();
            return millis >= lowerBound && millis <= upperBound;
        }
        return false;
    }

    private getIntersectingPath (aggKey: string, splitBy: string, millis: number) {
        if (this.chartComponentData.displayState[aggKey].bucketSize) {
            millis = millis - (this.chartComponentData.displayState[aggKey].bucketSize / 2);
        }
        let gapPath = this.findGapPath(aggKey, splitBy, millis);
        if (gapPath) {
            return gapPath;
        } else {
            return this.inBounds(d3.select(this.getPath(aggKey, splitBy)), millis) ? this.getPath(aggKey, splitBy) : null;
        }
    }

    private interpolateValue (millis, aggKey, splitBy) {
        let path = this.getIntersectingPath(aggKey, splitBy, millis);
        if (path === null) {
            return null;
        }
        return this.bisectionInterpolateValue(millis, aggKey, splitBy, path);
    }

    private getValuesAtTime (closestTime) {
        let valueArray = [];
        let values = this.chartComponentData.timeMap[closestTime] != undefined ? this.chartComponentData.timeMap[closestTime] : [];
        Object.keys(this.chartComponentData.visibleTAs).forEach((aggKey) => {
            Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                if (this.chartComponentData.displayState[aggKey].dataType !== DataTypes.Numeric) {
                    return;
                }
                let filteredValues = values.filter((v) => {
                    return (v.aggregateKey === aggKey && v.splitBy === splitBy && this.getValueOfVisible(v) !== null);
                });
                if (filteredValues.length === 1 && (this.getValueOfVisible(filteredValues[0]) !== null)) {
                    valueArray.push(filteredValues[0]);
                } else {
                    let interpolatedValue = this.interpolateValue(closestTime, aggKey, splitBy); 
                    if (interpolatedValue !== null || !this.isSeriesLabels) {
                        valueArray.push(interpolatedValue);
                    } else {
                        let lastValue = this.chartComponentData.findLastTimestampWithValue(aggKey, splitBy);
                        if (lastValue !== null) {
                            valueArray.push(lastValue);
                        }
                    }
                }
            });
        });
        return valueArray;
    }

    private setValueLabels (closestTime) {
        let values = this.getValuesAtTime(closestTime);
        values = values.filter((d) => {
            return d && this.chartComponentData.getDataType(d.aggregateKey) === DataTypes.Numeric; 
        });
        let self = this;

        let valueLabels = this.markerContainer.selectAll(".tsi-markerValue").data(values, (d) => {
            return d.aggregateKey + "_" + d.splitBy;
        });

        valueLabels.enter()
            .append("div")
            .classed("tsi-markerValue", true)
            .classed('tsi-seriesLabelValue', this.isSeriesLabels)
            .merge(valueLabels)
            .classed('tsi-isInterpolated', d => {
                return d.isInterpolated;
            })
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
                tooltip.draw(d, self.chartComponentData, 0, MARKERVALUENUMERICHEIGHT/2, {right:0, left:0, top:0, bottom:0}, (tooltipTextElement) => {
                    self.tooltipFormat(d, tooltipTextElement, null, null);
                }, null, 0, 0, self.colorMap[d.aggregateKey + "_" + d.splitBy], true);

                let markerValueCaret = d3.select(this).selectAll<HTMLDivElement, unknown>('.tsi-markerValueCaret')
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

    private getTimeFormat () {
        return Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
            this.chartOptions.offset, this.chartOptions.is24HourTime, 0, null, this.chartOptions.dateLocale);   
    }

    private setTimeLabel (closestTime: number) {
        if (this.isSeriesLabels) {
            return;
        }
        let values: Array<any> = this.chartComponentData.timeMap[closestTime];
        if (values == undefined || values.length == 0) {
            return;
        }
        let firstValue = values[0].dateTime;
        let secondValue = new Date(values[0].dateTime.valueOf() + (values[0].bucketSize != null ? values[0].bucketSize : 0));
        this.timeLabel.text('');

        this.timeLabel.append('div')
            .attr('class', 'tsi-markerTimeLine')
            .text(this.timeFormat(firstValue));
        if (values[0].bucketSize !== null) {
            this.timeLabel.append('div')
                .attr('class', 'tsi-markerTimeLine')
                .text(this.timeFormat(secondValue));            
        }

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
        if (this.closeButton) {
            this.closeButton.node().focus();
        }
    }

    public isMarkerInRange (millis: number = this.timestampMillis) {
        let domain = this.x.domain();
        return !(millis < domain[0].valueOf() || millis > domain[1].valueOf());
    }

    public destroyMarker () {
        if (this.markerContainer) {
            this.markerContainer.remove();
        }
        this.tooltipMap = {};
        this.markerContainer = null;
    }


    public render (timestampMillis: number, chartOptions: ChartOptions, chartComponentData: any, additionalMarkerFields: {chartMargins: any, x: any, marginLeft: number, colorMap: any, yMap: any, onChange: any, isDropping: boolean, chartHeight: number, labelText: string, isSeriesLabels: boolean}) {
        this.chartMargins = Object.assign({}, additionalMarkerFields.chartMargins);
        this.chartHeight = additionalMarkerFields.chartHeight;
        this.timestampMillis = timestampMillis;
        this.chartOptions = chartOptions;
        this.x = additionalMarkerFields.x;
        this.chartComponentData = chartComponentData;
        this.marginLeft = additionalMarkerFields.marginLeft;
        this.colorMap = additionalMarkerFields.colorMap;
        this.timeFormat = this.getTimeFormat();
        this.isSeriesLabels = additionalMarkerFields.isSeriesLabels;
        if (additionalMarkerFields.labelText) {
            this.labelText = additionalMarkerFields.labelText;
        }

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

export default Marker;
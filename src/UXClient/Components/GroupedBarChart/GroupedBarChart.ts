import * as d3 from 'd3';
import './GroupedBarChart.scss';
import Utils from "../../Utils";
import { TooltipMeasureFormat } from "./../../Constants/Enums";
import Legend from './../Legend';
import Slider from './../Slider';
import { GroupedBarChartData } from '../../Models/GroupedBarChartData';
import ContextMenu from './../ContextMenu';
import Tooltip from '../Tooltip';
import { ChartVisualizationComponent } from '../../Interfaces/ChartVisualizationComponent';

class GroupedBarChart extends ChartVisualizationComponent {
    private contextMenu: ContextMenu;
    private setStateFromData: any;
    private timestamp: any;
    private isStacked: boolean = null;
    private stackedButton: any = null;
    chartComponentData = new GroupedBarChartData();
    
    constructor(renderTarget: Element){
        super(renderTarget);
        this.chartMargins = {
            top: 52,
            bottom: 48,
            left: 70, 
            right: 60
        }
    }

    GroupedBarChart() { }
    public render(data: any, options: any, aggregateExpressionOptions: any) {
        super.render(data, options, aggregateExpressionOptions);
        if (options && options.stacked || this.isStacked == null) {
            this.isStacked = this.chartOptions.stacked;
        } 

        this.chartMargins.top = (this.chartOptions.legend === 'compact') ? 84 : 52;

        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        var height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.timestamp, this.aggregateExpressionOptions);
        this.timestamp = (options && options.timestamp != undefined) ? options.timestamp : this.chartComponentData.allTimestampsArray[0]; 

        var chartHeight = height - this.chartMargins.bottom - this.chartMargins.top; 
        this.chartWidth = this.getChartWidth();

        if(this.svgSelection == null){
            var targetElement = d3.select(this.renderTarget)
                .classed("tsi-barChart", true);
            var svgSelection = targetElement.append("svg")
                .attr("class", "tsi-barChartSVG tsi-chartSVG")
                .attr('title', this.getString('Bar chart'))
                .style("height", height)
                .style("width", this.getSVGWidth()  + 'px');
            this.svgSelection = svgSelection;

            
            var g = svgSelection.append("g")
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");

            var baseLine: any = g.append("line")
                .classed("tsi-baseLine", true)
                .attr("stroke-width", 1);

            var focus = g.append("g")
                .attr("transform", "translate(-100,-100)")
                .attr("class", "tsi-focus");
            focus.append("line")
                .attr("class", "tsi-focusLine")
                .attr("x1", 0)
                .attr("x2", this.chartWidth)
                .attr("y1", 0)
                .attr("y2", 0);
            var vHoverG: any = focus.append("g")
                .attr("class", 'vHoverG');
            var vHoverBox: any = vHoverG.append("rect")
                .attr("class", 'vHoverBox')
                .attr("x", -5)
                .attr("y", 0)
                .attr("width", 0)
                .attr("height", 0)
            var vHoverText: any = vHoverG.append("text")
                .attr("class", "vHoverText hoverText")
                .attr("dy", ".32em")
                .attr("x", -10)
                .text(d => d);

            d3.select(this.renderTarget).append('div').classed('tsi-sliderWrapper', true);

            var tooltip = new Tooltip(d3.select(this.renderTarget));

            var measureMap = this.chartComponentData.data.map((aggregate, aggI) => {
                var aggName: string = Object.keys(aggregate)[0]
                var aggKey: string = Utils.createEntityKey(Object.keys(aggregate)[0], aggI);
                var possibleMeasures = Object.keys(aggregate)
            });

            var labelMouseover = (aggKey: string, splitBy: string = null) => {
                var self = this;
                svgSelection.selectAll(".tsi-valueElement")
                    .attr("stroke-opacity", 1)
                    .attr("fill-opacity", 1);
                //filter out the selected timeseries/splitby
                var selectedFilter = (d: any, j: number ) => {
                    var currAggKey: string;
                    var currSplitBy: string;
                    if (d.aggKey) {
                        currAggKey = d.aggKey;
                        currSplitBy = d.splitBy;
                    } else  if (d && d.length) {
                        currAggKey = d[0].aggKey;
                        currSplitBy = d[0].splitBy
                    } else 
                        return true;
                    return !(aggKey == currAggKey && (splitBy == null || splitBy == currSplitBy))
                }

                svgSelection.selectAll(".tsi-valueElement")
                            .filter(selectedFilter)
                            .attr("stroke-opacity", .3)
                            .attr("fill-opacity", .3);
                var text = svgSelection.selectAll(".barGroup")
                            .filter((d: any) => {
                                return d == aggKey;
                            })
                            .select(".labelGroup").select("text").text(null);
                var dy = parseFloat(text.attr("dy"));

                let aggLabelGroup = text.append("tspan").attr('class', "tsi-labelGroupLine");
                Utils.appendFormattedElementsFromString(aggLabelGroup, self.chartComponentData.displayState[aggKey].name, {inSvg: true, additionalClassName: "tsi-aggregateLabelGroupText"});
                let splitByLabelGroup = text.append("tspan").attr('class', "tsi-labelGroupLine");
                Utils.appendFormattedElementsFromString(splitByLabelGroup, splitBy, {inSvg: true, additionalClassName: "tsi-splitByLabelGroupText"});

                splitByLabelGroup.selectAll('.tsi-splitByLabelGroupText').each(function(d, i) {
                    if (i == 0) {
                        d3.select(this).attr("y", text.attr("y"))
                        .attr("x", text.attr("x"))
                        .attr("dy", (dy + dy * 2) + "em")
                        .attr("text-anchor", "middle");
                    }
                });
                rePositionLabelGroupBoxes(svgSelection, aggKey);         
            }

            var labelMouseout = (svgSelection, aggKey) => {
                var self = this;
                var allText = svgSelection.selectAll(".barGroup")
                    .selectAll(".labelGroup")
                    .selectAll("text")
                    .text(null);
                allText.each(function(aggKey) {
                    var text = d3.select(this);
                    if (self.chartComponentData.displayState[aggKey] != undefined) {
                        Utils.appendFormattedElementsFromString(text, self.chartComponentData.displayState[aggKey].name, {inSvg: true, additionalClassName: "tsi-aggregateLabelGroupText"});
                    }
                })
                rePositionLabelGroupBoxes(svgSelection);
            }                         

            var calcSpacePerAgg = () => {
                var aggregateCount = Math.max(Object.keys(this.chartComponentData.filteredAggregates).length, 1);
                return Math.max((this.chartWidth / 2) / aggregateCount, 0); 
            }

            var rePositionLabelGroupBoxes = (svgSelection, aggKey = null) => {
                svgSelection.selectAll(".barGroup").filter((d, i) => {
                    if (aggKey == null)
                        return true;
                    return d == aggKey
                })
                .each(function () {         
                    if (d3.select(this).select('.labelGroup').select('text').node() == null)
                        return; 
                    var textElemDimensions = (<any>d3.select(this).select('.labelGroup').select('text').node())
                        .getBoundingClientRect();
                    var spacePerAgg = calcSpacePerAgg();
                    var aggregateWidth = d3.select(this).attr("width");
                    
                    // //truncate text to fit in spacePerAggregate of width
                    var textSelection: any = d3.select(this).select('.labelGroup').select("text");

                    var truncateText = (textSelection, childrenSize = 1) => {
                        if(textSelection.node().getComputedTextLength) {
                            var textLength = textSelection.node().getComputedTextLength();
                            var text = textSelection.text();
                            while ( textLength > ((spacePerAgg-6)/childrenSize) && text.length > 0) {
                                text = text.slice(0, -1);
                                textSelection.text(text + '...');
                                textLength = textSelection.node().getComputedTextLength();
                            }
                        }
                    }

                    //text is either in tspans or just in text. Either truncate text directly or through tspan
                    if (textSelection.selectAll("tspan").filter(function() {return !d3.select(this).classed("tsi-labelGroupLine")}).size() === 0)
                        truncateText(textSelection)
                    else {
                        textSelection.selectAll("tspan").filter(function() {return !d3.select(this).classed("tsi-labelGroupLine")}).each(function() {
                            var tspanTextSelection = d3.select(this);
                            let childrenSize = tspanTextSelection.classed("tsi-splitByLabelGroupText") ? textSelection.selectAll(".tsi-splitByLabelGroupText").size() : textSelection.selectAll(".tsi-aggregateLabelGroupText").size();
                            truncateText(tspanTextSelection, childrenSize);
                        });
                    }

                    d3.select(this).select('.labelGroup').select("rect")
                        .attr("height", textElemDimensions.height + 4)
                        .attr("y", chartHeight + 6)
                        .attr("x", 0)
                        .attr("width", spacePerAgg);
                });
            }

            var draw = (isFromResize = false) => {
                var self = this;
                this.width = this.getWidth();
                height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

                this.chartComponentData.timestamp = (this.chartOptions.timestamp != undefined) ? this.chartOptions.timestamp : this.chartComponentData.allTimestampsArray[0];
                this.chartComponentData.setFilteredAggregates();

                if (!isFromResize) {
                    this.chartWidth = this.getChartWidth();
                }
                
                super.themify(targetElement, this.chartOptions.theme);

                if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel === null) {
                    this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, this.chartMargins.top, this.chartOptions);

                    this.stackedButton = this.chartControlsPanel.append("button")
                        .style("left", "60px")
                        .attr("class", "tsi-stackedButton").on("click", function () {
                            self.chartOptions.stacked = !self.chartOptions.stacked;
                            self.draw();
                        })
                        .attr("type", "button")
                        .attr('title', this.getString('Stack/Unstack Bars'));
                } else  if (this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null){
                    this.removeControlPanel();
                }

                if (this.chartControlsPanel) {
                    this.stackedButton.attr('aria-label', this.chartOptions.stacked ? this.getString("Unstack bars") : this.getString("Stack bars"))
                }
        
                if (this.chartControlsPanel !== null && this.ellipsisItemsExist()) {
                    this.drawEllipsisMenu();
                    this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 24), 0) + 'px');
                } else {
                    this.removeEllipsisMenu();
                }

                /********* Determine the number of timestamps present, add margin for slider *********/

                if(this.chartComponentData.allTimestampsArray.length > 1)
                    this.chartMargins.bottom = 88;
                /*******************/
                chartHeight = height - this.chartMargins.bottom - this.chartMargins.top; 
                focus.select("line").attr("x2", this.chartWidth);

                svgSelection.style("width", `${this.getSVGWidth()}px`);
                if (this.timestamp.substring(this.timestamp.length - 5, this.timestamp.length) == ".000Z")
                    this.timestamp = this.timestamp.substring(0, this.timestamp.length - 5) + "Z";
                
                var aggregateCount = Math.max(Object.keys(this.chartComponentData.filteredAggregates).length, 1);
                
                svgSelection.select('g').attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")")
                    .selectAll('.barGroup')
                    .attr("visibility", "hidden");
                var barGroups = g.selectAll<SVGGElement, unknown>('.barGroup').data(Object.keys(this.chartComponentData.displayState));
                var spacePerAggregate = calcSpacePerAgg();

                //map to x position
                var xPosMap = this.chartComponentData.filteredAggregates.reduce((map, aggKey, aggKeyI) => {
                    map[aggKey] = ((1 / (aggregateCount + 1)) * (aggKeyI + 1) * this.chartWidth - (spacePerAggregate / 2))
                    return map;
                }, {});            
                
                this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, labelMouseover, 
                                        svgSelection, this.chartOptions, labelMouseout);

                barGroups = barGroups.enter()
                    .append("g")
                    .attr("class", "barGroup")
                    .merge(barGroups)
                    .attr("display", (d, i) => {return (this.chartComponentData.displayState[d].visible ? "inherit" : "none");})
                    .attr("visibility", "visible")
                    .attr("transform",(d, i) => {
                        if (xPosMap[d])
                            return "translate(" + xPosMap[d] + ",0)";
                        return "";
                    });
            
                this.chartComponentData.setEntireRangeData(this.chartOptions.scaledToCurrentTime);
                var allValues: Array<number> = this.chartComponentData.valuesOfVisibleType;
                var aggsSeries = this.chartComponentData.aggsSeries;
                
                var yScale = d3.scaleLinear()
                    .range([chartHeight, 0]);
                var extent = d3.extent(allValues);
                if (!this.chartOptions.stacked) {
                    if (allValues.length > 0) { //check to make sure there are values present
                        if (this.chartOptions.zeroYAxis) {
                            if (extent[0] > 0)
                                yScale.domain([0, d3.extent(allValues)[1]])
                            else
                                yScale.domain([d3.extent(allValues)[0], Math.max(d3.extent(allValues)[1], 0)])
                        } 
                        else {
                            var offset = (Math.abs(d3.extent(allValues)[1]) * .05);
                            yScale.domain([d3.extent(allValues)[0] - offset, (d3.extent(allValues)[1] + offset)]);
                        }
                    } else {
                        yScale.domain([0,0]);
                    }      
                } else {
                    yScale.domain([Math.min(this.chartComponentData.globalMin, this.chartComponentData.globalMax), 
                                   Math.max(this.chartComponentData.globalMin, this.chartComponentData.globalMax)]);
                }

                var barBase = (yScale.domain()[0] > 0) ? yScale(yScale.domain()[0]) : yScale(0);

                var legendObject = this.legendObject;
                barGroups.each(function (aggKey, i) {
                    var splitBys = Object.keys(self.chartComponentData.displayState[aggKey].splitBys)
                    var filteredSplitBys = splitBys.filter((splitBy) => {
                        return self.chartComponentData.displayState[aggKey].splitBys[splitBy].visible;
                    });

                    var splitByCount = filteredSplitBys.length;
                    var barWidth = spacePerAggregate / splitByCount;

                    var valueElements = d3.select(this).selectAll<SVGGElement, unknown>('.tsi-valueElement').data(self.chartComponentData.getValueContainerData(aggKey));

                    var labelGroup = d3.select(this).selectAll<SVGGElement, unknown>(".labelGroup").data([aggKey]);
                    var labelGroupEntered = labelGroup.enter()
                        .append("g")
                        .attr("class", "labelGroup");
                    labelGroupEntered.append("rect");
                    var labelGroupText = labelGroupEntered.append("text")
                        .attr("dy", ".71em");
                    Utils.appendFormattedElementsFromString(labelGroupText, self.chartComponentData.displayState[aggKey].name, {inSvg: true, additionalClassName: "tsi-aggregateLabelGroupText"});

                    var labelGroupBox: any = labelGroupEntered.merge(labelGroup)
                        .select("rect")
                        .attr("class", 'aggregateLabelBox')
                        .attr("x", 0)
                        .attr("y", 1)
                        .attr("width", 0)
                        .attr("height", 0);

                    d3.select(this).select(".labelGroup").select("text")
                        .transition()
                        .duration(self.TRANSDURATION)
                        .ease(d3.easeExp)                        
                        .attr("x", (d) => (spacePerAggregate / 2))
                        .attr("y", chartHeight + 12)
                        .style("fill", (d) => self.chartComponentData.displayState[aggKey].color)
                        .attr("text-anchor", "middle");
                    
                    labelGroup.exit().remove();

                    rePositionLabelGroupBoxes(svgSelection, aggKey);

                    var xScale = d3.scaleLinear()
                        .domain([0, splitByCount])
                        .range([0, spacePerAggregate]);

                    //yOffset to position 0 at the appropriate place
                    var yOffset = chartHeight - filteredSplitBys.reduce((offset, splitBy) => {
                        var measureType = self.chartComponentData.displayState[aggKey].splitBys[splitBy].visibleType;
                        var yScaledVal; // either 0 or the value 
                        if (self.chartComponentData.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements)
                            yScaledVal = yScale(self.chartComponentData.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements[measureType]);
                        else
                            yScaledVal = 0;
                        return offset + yScaledVal;
                    }, 0);

                    //calculate the yPosition of an element, either by its data or explicitly through its value
                    var calcYPos = (d, i) => {
                        if (!self.chartOptions.stacked) {
                            if (d.val > 0)
                                return yScale(d.val);
                            return yScale(0);
                        } 
                        if (aggsSeries[d.aggKey] != undefined && aggsSeries[d.aggKey].length != 0){
                            return yScale(aggsSeries[d.aggKey][i][0][1]);
                        }
                        return 0;
                    }

                    //calculate the height of an element given its data
                    var calcHeight = (d, i, dValue = null) => {
                        if (!self.chartOptions.stacked) {
                            if (yScale.domain()[0] >= 0) 
                                return chartHeight - calcYPos(d, i);
                            dValue = (dValue != null) ? dValue : d.val;
                            if (dValue > 0)
                                return Math.abs(calcYPos(d, i) - yScale(0));
                            return yScale(dValue) - yScale(0);
                        }
                        return Math.max(Math.abs(yScale(d.val) - yScale(0)), 0);
                    }

                    //map to x position for grouped, map to y position for stacked
                    var splitByXPosMap = filteredSplitBys.reduce((map, splitBy, splitByI) => {
                        map[splitBy] = xScale(splitByI);
                        return map;
                    }, {});  

                    var valueElementsEntered = valueElements.enter()
                        .append("g")
                        .attr("class", "tsi-valueElement");
                    valueElementsEntered.append("rect");
                    valueElementsEntered.append("line");


                    var valueElementMouseout = (event, d) => {
                        if (self.contextMenu && self.contextMenu.contextMenuVisible)
                            return;
                        focus.style("display", "none");                        
                        (<any>legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: string) {
                            return (d3.select(this.parentNode).datum() == d.aggKey) && (filteredSplitBy == d.splitBy);
                        })).classed("inFocus", false);
                        event.stopPropagation();
                        svgSelection.selectAll(".tsi-valueElement")
                                    .attr("stroke-opacity", 1)
                                    .attr("fill-opacity", 1);
                        labelMouseout(svgSelection, d.aggKey);
                        tooltip.hide();
                    }
                    var mouseOutValueElementOnContextMenuClick = () => {
                        valueElementsEntered.selectAll("path").each(valueElementMouseout);
                    }

                    var splitByColors = Utils.createSplitByColors(self.chartComponentData.displayState, aggKey, self.chartOptions.keepSplitByColor);
                    valueElementsEntered.merge(valueElements)
                        .select<SVGGElement>("rect") 
                        .attr("fill", (d, j) => {
                            return splitByColors[j];
                        })
                        .on("mouseover", function (event, d) {
                            if (self.contextMenu && self.contextMenu.contextMenuVisible)
                                return;
                            
                            (legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: string) {
                                return (d3.select(this.parentNode).datum() == d.aggKey) && (filteredSplitBy == d.splitBy);
                            })).classed("inFocus", true);
                            labelMouseover(d.aggKey, d.splitBy);

                            const e = valueElementsEntered.nodes();
                            const j = e.indexOf(event.currentTarget);
                            var yPos = calcYPos(d, j);
                            if (d.val < 0) {
                                yPos = yPos + calcHeight(d, j);
                            }
                            focus.style("display", "block")
                                .attr("transform", "translate(0," + yPos + ")");

                            focus.select('.vHoverG')
                            .select("text")
                            .text(() => {
                                if (!self.chartOptions.stacked)
                                    return Utils.formatYAxisNumber(d.val);
                                var yVal = yScale.invert(calcYPos(d, j))
                                if (d.val < 0)
                                    yVal += d.val;
                                return Utils.formatYAxisNumber(yVal);
                            });
                            var textElemDimensions = (<any>focus.select('.vHoverG').select("text")
                                .node()).getBoundingClientRect();
                            focus.select(".vHoverG").select("rect")
                                .attr("x", -(textElemDimensions.width) - 13)
                                .attr("y", -(textElemDimensions.height / 2) - 3)
                                .attr("width", textElemDimensions.width + 6)
                                .attr("height", textElemDimensions.height + 4);
                            
                            (<any>focus.node()).parentNode.appendChild(focus.node());
                        })
                        .on("mousemove", function (event, d) {
                            if (self.chartOptions.tooltip) {
                                const e = valueElementsEntered.nodes();
                                const i = e.indexOf(event.currentTarget);
                                var mousePos = d3.pointer(event, <any>g.node());
                                tooltip.render(self.chartOptions.theme)
                                tooltip.draw(d, self.chartComponentData, mousePos[0], mousePos[1], self.chartMargins,(text) => {
                                    self.tooltipFormat(self.convertToTimeValueFormat(d), text, TooltipMeasureFormat.SingleValue);
                                }, null, 20, 20, splitByColors[i]);
                            } else {
                                tooltip.hide();
                            }
                        })
                        .on("mouseout", valueElementMouseout)
                        .on("contextmenu", (event, d: any) => {
                            if (self.chartComponentData.displayState[d.aggKey].contextMenuActions && 
                                    self.chartComponentData.displayState[d.aggKey].contextMenuActions.length) {
                                var mousePosition = d3.pointer(event, <any>targetElement.node());
                                event.preventDefault();
                                self.contextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                      mousePosition, d.aggKey, d.splitBy, mouseOutValueElementOnContextMenuClick,
                                                      new Date(self.chartComponentData.timestamp));
                            }
                        })
                        .transition()
                        .duration(self.TRANSDURATION)
                        .ease(d3.easeExp)                        
                        .attr("y", (d, i) => calcYPos(d, i))
                        .attr("height", (d, i) => {
                            if (self.chartOptions.stacked && (splitByXPosMap[d.splitBy] == undefined))
                                return 0;
                            return Math.max(calcHeight(d, i), 0);
                        })
                        .attr("x", function (d, i)  {
                            if (self.chartOptions.stacked)
                                return 0;
                            if (splitByXPosMap[d.splitBy] != undefined)
                                return splitByXPosMap[d.splitBy];
                            //if invisible, put it in the empty space where it would be
                            var splitBys = Object.keys(self.chartComponentData.displayState[aggKey].splitBys);
                            var prevSplitBy = splitBys[0];
                            for (var splitByI = 0; splitBys[splitByI] != d.splitBy; splitByI++) {
                                if (splitByXPosMap[splitBys[splitByI]] != undefined)
                                    prevSplitBy = splitBys[splitByI];
                            }
                            if (splitByXPosMap[prevSplitBy] != undefined)
                                return splitByXPosMap[prevSplitBy] + barWidth;
                            return 0;
                        })
                        .attr("width", (d, i) => {
                            if (self.chartOptions.stacked) 
                                return spacePerAggregate;
                            if (splitByXPosMap[d.splitBy] != undefined)
                                return barWidth;
                            return 0;
                        });

                        valueElementsEntered.merge(valueElements)
                        .select("line")
                        .classed("tsi-baseLine", true)
                        .attr("stroke-width", 2)
                        .transition()
                        .duration(self.TRANSDURATION)
                        .ease(d3.easeExp)
                        .attr("x1", (d, i) => {
                            if (self.chartOptions.stacked) 
                                return 0;
                            if (splitByXPosMap[d.splitBy] != undefined)
                                return splitByXPosMap[d.splitBy];
                            return 0;
                        })
                        .attr("x2", (d, i) => {
                            if (self.chartOptions.stacked) 
                                return spacePerAggregate;
                            if (splitByXPosMap[d.splitBy] != undefined)
                                return splitByXPosMap[d.splitBy] + barWidth;
                            return 0;
                        })
                        .attr("y1", (d, i) => {
                            if (!self.chartOptions.stacked) {
                                return barBase;
                            }
                            var dValue = d.val;
                            if (self.chartOptions.stacked && (splitByXPosMap[d.splitBy] == undefined))
                                return calcYPos(d, i);
                            return calcYPos(d, i) + calcHeight(d, i);
                        })
                        .attr("y2", (d, i) => {
                            if (!self.chartOptions.stacked) {
                                return barBase;
                            }
                            var dValue = d.val;
                            if (self.chartOptions.stacked && (splitByXPosMap[d.splitBy] == undefined))
                                return calcYPos(d, i);
                            return calcYPos(d, i) + calcHeight(d, i);
                        });
                    valueElements.exit().remove();
                });
                barGroups.exit().remove();

                var yAxis: any = g.selectAll(".yAxis")
                .data([yScale]);
                yAxis.enter()
                    .append("g")
                    .attr("class", "yAxis")
                    .merge(yAxis)
                    .call(d3.axisLeft(yScale).tickFormat(Utils.formatYAxisNumber).ticks(4));
                yAxis.exit().remove();

                baseLine
                .attr("x1", 0)
                .attr("x2", this.chartWidth)
                .attr("y1", barBase + 1)
                .attr("y2", barBase + 1);

                /******************** Stack/Unstack button ************************/
                this.stackedButton.style("opacity", this.chartOptions.stacked ? 1 : .5)
                    .classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                    .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                
                /******************** Temporal Slider ************************/
                if(this.chartComponentData.allTimestampsArray.length > 1){
                    d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', false);
                    slider.render(this.chartComponentData.allTimestampsArray.map(ts => {
                        var action = () => {
                            this.chartOptions.timestamp = ts;
                            this.render(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions);
                        }
                        return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                              this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(ts)), action: action};
                    }), this.chartOptions, this.getSVGWidth(), Utils.timeFormat(this.chartComponentData.usesSeconds, 
                                  this.chartComponentData.usesMillis, this.chartOptions.offset, this.chartOptions.is24HourTime, 
                                  null, null, this.chartOptions.dateLocale)(new Date(this.chartComponentData.timestamp)));
                }
                else{
                    slider.remove();
                    d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', true);
                }

                this.setControlsPanelWidth();
            }

            this.legendObject = new Legend(draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(this.draw, this.renderTarget);
            
            // temporal slider
            var slider = new Slider(<any>d3.select(this.renderTarget).select('.tsi-sliderWrapper').node());
            
            this.draw = draw;
            window.addEventListener("resize", () => {
                if (!this.chartOptions.suppressResizeListener)
                    this.draw();
            });
        }

        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.ellipsisContainer && event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.timestamp, this.aggregateExpressionOptions);
        this.draw();
        this.gatedShowGrid();

        this.legendPostRenderProcess(this.chartOptions.legend, this.svgSelection, true);
    }
}
export default GroupedBarChart

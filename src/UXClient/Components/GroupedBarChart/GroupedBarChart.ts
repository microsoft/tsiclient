import * as d3 from 'd3';
import './GroupedBarChart.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {Slider} from './../Slider/Slider';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { GroupedBarChartData } from '../../Models/GroupedBarChartData';
import { ContextMenu } from './../ContextMenu/ContextMenu';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';
import { Grid } from '../Grid/Grid';

class GroupedBarChart extends ChartComponent {
    private svgSelection: any;
    private legendObject: Legend;
    private contextMenu: ContextMenu;
    public draw: any;
    private setStateFromData: any;
    private timestamp: any;
    private isStacked: boolean = null;
    private stackedButton: any = null;
    private ellipsisContainer: any;
    private ellipsisMenu: EllipsisMenu;
    chartComponentData = new GroupedBarChartData();
    
    private chartMargins: any = {
        top: 52,
        bottom: 48,
        left: 70, 
        right: 60
    };

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    GroupedBarChart() { }
    public render(data: any, options: any, aggregateExpressionOptions: any) {
        var isStacked = this.chartOptions && this.chartOptions.stacked;
        this.chartOptions.setOptions(options);
        this.chartOptions.stacked = isStacked
        if (options.stacked || this.isStacked == null) {
            this.isStacked = this.chartOptions.stacked;
        } 

        if (this.chartOptions.legend == "compact")
            this.chartMargins.top = 84;
        else
            this.chartMargins.top = 52;
        this.aggregateExpressionOptions = aggregateExpressionOptions;
        var width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        var height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        var firstTerm = data[0][Object.keys(data[0])[0]];
        var firstSplitByKey = Object.keys(firstTerm)[0];
        this.timestamp = (options.timestamp != undefined) ? options.timestamp : Object.keys(firstTerm[firstSplitByKey])[0];
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.timestamp, aggregateExpressionOptions);

        var controlsOffset = (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0)
        var chartHeight = height - this.chartMargins.bottom - this.chartMargins.top; 
        var chartWidth = width - this.chartMargins.left - this.chartMargins.right - controlsOffset;

        if(this.svgSelection == null){
            var targetElement = d3.select(this.renderTarget)
                .classed("tsi-barChart", true);
            var svgSelection = targetElement.append("svg")
                .attr("class", "tsi-barChartSVG tsi-chartSVG")
                .style("height", height)
                .style("width", width - controlsOffset + 'px');
            this.svgSelection = svgSelection;

            
            var g = svgSelection.append("g")
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");

            var baseLine: any = g.append("line")
                .classed("tsi-baseLine", true)
                .attr("stroke-width", 1);

            var focus = g.append("g")
                .attr("transform", "translate(-100,-100)")
                .attr("class", "focus");
            focus.append("line")
                .attr("class", "focusLine")
                .attr("x1", 0)
                .attr("x2", chartWidth)
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
                svgSelection.selectAll(".valueElement")
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

                svgSelection.selectAll(".valueElement")
                            .filter(selectedFilter)
                            .attr("stroke-opacity", .3)
                            .attr("fill-opacity", .3);
                var text = svgSelection.selectAll(".barGroup")
                            .filter((d: any) => {
                                return d == aggKey;
                            })
                            .select(".labelGroup").select("text");
                var dy = parseFloat(text.attr("dy"));
                text.text(null).append("tspan")
                    .attr("y", text.attr("y"))
                    .attr("x", text.attr("x"))
                    .attr("dy", dy + "em")
                    .attr("text-anchor", "middle")
                    .text(this.chartComponentData.displayState[aggKey].name);
                text.append("tspan")
                    .attr("y", text.attr("y"))
                    .attr("x", text.attr("x"))
                    .attr("dy", (dy + dy * 2) + "em")
                    .attr("text-anchor", "middle")
                    .text(splitBy);   
                rePositionLabelGroupBoxes(svgSelection, aggKey);         
            }

            var labelMouseout = (svgSelection, aggKey) => {
                svgSelection.selectAll(".barGroup")
                    .selectAll(".labelGroup")
                    .selectAll("text")
                    .text((aggKey) => {
                        if (this.chartComponentData.displayState[aggKey] != undefined)
                            return this.chartComponentData.displayState[aggKey].name;
                        return "";
                    });
                rePositionLabelGroupBoxes(svgSelection);
            }                         

            var calcSpacePerAgg = () => {
                var aggregateCount = Math.max(Object.keys(this.chartComponentData.filteredAggregates).length, 1);
                return Math.max((chartWidth / 2) / aggregateCount, 0); 
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

                    var truncateText = (textSelection) => {
                        var textLength = textSelection.node().getComputedTextLength();
                        var text = textSelection.text();
                        while ( ( textLength > spacePerAgg - 6) && text.length > 0) {
                            text = text.slice(0, -1);
                            textSelection.text(text + '...');
                            textLength = textSelection.node().getComputedTextLength();
                        }
                    }

                    //text is either in tspans or just in text. Either truncate text directly or through tspan
                    if (textSelection.selectAll("tspan").size() == 0)
                        truncateText(textSelection)
                    else {
                        textSelection.selectAll("tspan").each(function() {
                            var tspanTextSelection = d3.select(this);
                            truncateText(tspanTextSelection);
                        });
                    }

                    d3.select(this).select('.labelGroup').select("rect")
                        .attr("height", textElemDimensions.height + 4)
                        .attr("y", chartHeight + 6)
                        .attr("x", 0)
                        .attr("width", spacePerAgg);
                });
            }

            var draw = () => {
                var self = this;
                width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
                height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

                this.chartComponentData.timestamp = (this.chartOptions.timestamp != undefined) ? this.chartOptions.timestamp : Object.keys(firstTerm[firstSplitByKey])[0];
                this.chartComponentData.setFilteredAggregates();
                
                
                super.themify(targetElement, this.chartOptions.theme);

                var chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, this.chartMargins.top, this.chartOptions);

                this.stackedButton = chartControlsPanel.append("div")
                    .style("left", "60px")
                    .attr("class", "tsi-stackedButton").on("click", () => {
                        this.chartOptions.stacked = !this.chartOptions.stacked;
                        this.draw();
                    })
                    .attr('title', 'Stack/Unstack Bars');

                if (this.chartOptions.canDownload || this.chartOptions.grid) {
                    this.ellipsisContainer = chartControlsPanel.append("div")
                        .attr("class", "tsi-ellipsisContainerDiv");
                    this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());

                    var ellipsisItems = [];
                    if (this.chartOptions.grid) {
                        ellipsisItems.push(Utils.createGridEllipsisOption(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData));
                    }
                    if (this.chartOptions.canDownload) {
                        ellipsisItems.push(Utils.createDownloadEllipsisOption(() => this.chartComponentData.generateCSVString()));
                    }

                    this.ellipsisMenu.render(ellipsisItems, {theme: this.chartOptions.theme});
                }

                /********* Determine the number of timestamps present, add margin for slider *********/

                if(this.chartComponentData.allTimestampsArray.length > 1)
                    this.chartMargins.bottom = 88;
                /*******************/
                
                var controlsOffset = (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0)
                chartHeight = height - this.chartMargins.bottom - this.chartMargins.top; 
                chartWidth = width - this.chartMargins.left - this.chartMargins.right - controlsOffset;
                svgSelection.style("height", height + "px")
                            .style("width", (width - controlsOffset) + "px");            
                focus.select("line").attr("x2", chartWidth);

                if (this.timestamp.substring(this.timestamp.length - 5, this.timestamp.length) == ".000Z")
                    this.timestamp = this.timestamp.substring(0, this.timestamp.length - 5) + "Z";
                
                var aggregateCount = Math.max(Object.keys(this.chartComponentData.filteredAggregates).length, 1);
                
                g.selectAll('.barGroup')
                    .attr("visibility", "hidden");
                var barGroups = g.selectAll('.barGroup').data(Object.keys(this.chartComponentData.displayState));
                var spacePerAggregate = calcSpacePerAgg();

                //map to x position
                var xPosMap = this.chartComponentData.filteredAggregates.reduce((map, aggKey, aggKeyI) => {
                    map[aggKey] = ((1 / (aggregateCount + 1)) * (aggKeyI + 1) * chartWidth - (spacePerAggregate / 2))
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

                    var valueElements = d3.select(this).selectAll('.valueElement').data(self.chartComponentData.getValueContainerData(aggKey));

                    var labelGroup = d3.select(this).selectAll(".labelGroup").data([aggKey]);
                    var labelGroupEntered = labelGroup.enter()
                        .append("g")
                        .attr("class", "labelGroup");
                    labelGroupEntered.append("rect");
                    labelGroupEntered.append("text")
                        .attr("dy", ".71em");
                    

                    var labelGroupBox: any = labelGroupEntered.merge(labelGroup)
                        .select("rect")
                        .attr("class", 'aggregateLabelBox')
                        .attr("x", 0)
                        .attr("y", 1)
                        .attr("width", 0)
                        .attr("height", 0);

                    // labelText.enter()
                    labelGroupEntered
                        .merge(labelGroup)
                        .select("text")
                        .text((d) => self.chartComponentData.displayState[aggKey].name);
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
                        .attr("class", "valueElement");
                    valueElementsEntered.append("rect");
                    valueElementsEntered.append("line");


                    var valueElementMouseout = (d, j) => {
                        if (self.contextMenu && self.contextMenu.contextMenuVisible)
                            return;
                        focus.style("display", "none");                        
                        (<any>legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
                            return (labelData[0] == d.aggKey) && (labelData[1] == d.splitBy);
                        })).classed("inFocus", false);
                        d3.event.stopPropagation();
                        svgSelection.selectAll(".valueElement")
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
                        .select("rect") 
                        .attr("fill", (d, j) => {
                            return splitByColors[j];
                        })
                        .on("mouseover", function (d, j) {
                            if (self.contextMenu && self.contextMenu.contextMenuVisible)
                                return;
                            
                            (legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
                                return (labelData[0] == d.aggKey) && (labelData[1] == d.splitBy);
                            })).classed("inFocus", true);
                            labelMouseover(d.aggKey, d.splitBy);

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
                        .on("mousemove", function (d) {
                            if (self.chartOptions.tooltip) {
                                var mousePos = d3.mouse(<any>g.node());
                                tooltip.render(self.chartOptions.theme)
                                tooltip.draw(d, self.chartComponentData, mousePos[0], mousePos[1], self.chartMargins, (text) => {
                                    text.text(null);
                                    text.append("div")
                                        .attr("class", "title")
                                        .text(self.chartComponentData.displayState[d.aggKey].name);  
                                    if (d.splitBy != "") {
                                        text.append("div")
                                            .attr("class", "value")
                                            .text(d.splitBy);
                                    }
            
                                    text.append("div")
                                        .attr("class", "value")
                                        .text(Utils.formatYAxisNumber(d.val));
                                });
                            } else {
                                tooltip.hide();
                            }
                        })
                        .on("mouseout", valueElementMouseout)
                        .on("contextmenu", (d: any, i) => {
                            if (self.chartComponentData.displayState[d.aggKey].contextMenuActions && 
                                    self.chartComponentData.displayState[d.aggKey].contextMenuActions.length) {
                                var mousePosition = d3.mouse(<any>targetElement.node());
                                d3.event.preventDefault();
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
                .attr("x2", chartWidth)
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
                        return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, this.chartOptions.offset)(new Date(ts)), action: action};
                    }), this.chartOptions, width - controlsOffset - 10,  Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, this.chartOptions.offset)(new Date(this.chartComponentData.timestamp)));
                }
                else{
                    slider.remove();
                    d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', true);
                }
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

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.ellipsisContainer && d3.event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.timestamp, aggregateExpressionOptions);
        this.draw();
    }
}
export {GroupedBarChart}

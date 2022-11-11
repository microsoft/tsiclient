import * as d3 from 'd3';
import './Legend.scss';
import Utils from "../../Utils";
import { DataTypes, EventElementTypes } from "./../../Constants/Enums";
import {Component} from "./../../Interfaces/Component";
import { ChartComponentData } from '../../Models/ChartComponentData';

const NUMERICSPLITBYHEIGHT = 44;
const NONNUMERICSPLITBYHEIGHT = 24; 

class Legend extends Component {
    public drawChart: any;
    public legendElement: any;
    public legendWidth: number;
    private legendState: string;
    private stickySeriesAction: any;
    private labelMouseover: any;
    private labelMouseout: any;
    private svgSelection: any;
    private chartComponentData: ChartComponentData;

	constructor(drawChart: any, renderTarget: Element, legendWidth: number) {
        super(renderTarget);
        this.drawChart = drawChart;
        this.legendWidth = legendWidth;
        this.legendElement = d3.select(renderTarget).insert("div", ":first-child")
                                .attr("class", "tsi-legend")
                                .style("left", "0px")
                                .style("width", (this.legendWidth) + "px"); // - 16 for the width of the padding
    }

    private labelMouseoutWrapper (labelMouseout, svgSelection, event) {
        return (svgSelection, aggKey) => {
            event?.stopPropagation();
            svgSelection.selectAll(".tsi-valueElement")
                        .filter(function () { return !d3.select(this).classed("tsi-valueEnvelope"); })
                        .attr("stroke-opacity", 1)
                        .attr("fill-opacity", 1);
            svgSelection.selectAll(".tsi-valueEnvelope")
                        .attr("fill-opacity", .2);
            labelMouseout(svgSelection, aggKey);
        }
    }

    private toggleSplitByVisible (aggregateKey: string, splitBy: string)  {
        var newState = !this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible;
        this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible = newState;
        this.chartComponentData.displayState[aggregateKey].visible = Object.keys(this.chartComponentData.displayState[aggregateKey].splitBys)
                                        .reduce((prev: boolean, curr: string): boolean => {
                                            return this.chartComponentData.displayState[aggregateKey]["splitBys"][curr]["visible"] || prev;
                                        }, false);
    //turn off sticky if making invisible
        if (newState == false && (this.chartComponentData.stickiedKey != null && 
            this.chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
            this.chartComponentData.stickiedKey.splitBy == splitBy)) {
            this.chartComponentData.stickiedKey = null;
        }
    } 

    public triggerSplitByFocus (aggKey: string, splitBy: string) {
        if (this.chartOptions.legend == "hidden") {
            return;
        }
        this.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);
        this.legendElement.selectAll('.tsi-splitByLabel').filter(function (labelData: any) {
            return (d3.select(this.parentNode).datum() == aggKey) && (labelData == splitBy);
        }).classed("inFocus", true);

        var indexOfSplitBy = Object.keys(this.chartComponentData.displayState[aggKey].splitBys).indexOf(splitBy);

        if (indexOfSplitBy != -1) {
            var splitByNode = this.legendElement.selectAll('.tsi-splitByContainer').filter((d) => {
                return d == aggKey;
            }).node();
            var prospectiveScrollTop = Math.max((indexOfSplitBy - 1) * this.getHeightPerSplitBy(aggKey), 0) ;
            if (splitByNode.scrollTop < prospectiveScrollTop - (splitByNode.clientHeight - 40) || splitByNode.scrollTop > prospectiveScrollTop) {
                splitByNode.scrollTop = prospectiveScrollTop;
            }  
        }
    }

    private getHeightPerSplitBy (aggKey) {
        return (this.chartComponentData.displayState[aggKey].dataType === DataTypes.Numeric ? NUMERICSPLITBYHEIGHT : NONNUMERICSPLITBYHEIGHT);
    }

    private createGradient (gradientKey, svg, values) {
        let gradient = svg.append('defs').append('linearGradient')
            .attr('id', gradientKey).attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
        let catCount = Object.keys(values).length; 
            Object.keys(values).forEach((category, i) => {
                let currentStop = i / catCount * 100;
                let nextStop = (i + 1) / catCount * 100;
                let color = values[category].color;
                
                gradient.append('stop')
                    .attr("offset", currentStop + "%")
                    .attr("stop-color",  color)
                    .attr("stop-opacity", 1);
    
                gradient.append('stop')
                    .attr("offset", nextStop + "%")
                    .attr("stop-color",  color)
                    .attr("stop-opacity", 1);
            });
    }

    private isNonNumeric (aggKey) {
        let dataType = this.chartComponentData.displayState[aggKey].dataType;
        return (dataType === DataTypes.Categorical || dataType === DataTypes.Events); 
    }

    private createNonNumericColorKey (dataType, colorKey, aggKey) {
        if (dataType === DataTypes.Categorical) {
            this.createCategoricalColorKey(colorKey, aggKey);
        }
        if (dataType === DataTypes.Events) {
            this.createEventsColorKey(colorKey, aggKey);
        }
    }

    private createCategoricalColorKey (colorKey, aggKey) {
        let categories = this.chartComponentData.displayState[aggKey].aggregateExpression.valueMapping;
        colorKey.classed('tsi-categoricalColorKey', true);
        colorKey.selectAll('*').remove();
        let svg = colorKey.append('svg')
            .attr('width', colorKey.style('width'))
            .attr('height', colorKey.style('height'));
        let rect = svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'black');
        let gradientKey = Utils.guid();
        this.createGradient(gradientKey, svg, categories);
        rect.attr('fill', "url(#" + gradientKey + ")");
    }

    private createEventsColorKey (colorKey, aggKey) {
        let categories = this.chartComponentData.displayState[aggKey].aggregateExpression.valueMapping;
        let eventElementType = this.chartComponentData.displayState[aggKey].aggregateExpression.eventElementType;
        colorKey.classed('tsi-eventsColorKey', true);
        colorKey.selectAll('*').remove();

        let colorKeyWidth = colorKey.node().getBoundingClientRect().width;
        let colorKeyHeight = colorKey.node().getBoundingClientRect().height;
        let colorKeyUnitLength = Math.floor(colorKeyHeight / Math.sqrt(2));
        
        let svg = colorKey.append('svg')
            .attr('width', `${colorKeyWidth}px`)
            .attr('height', `${colorKeyHeight}px`);

        let gradientKey = Utils.guid();
        this.createGradient(gradientKey, svg, categories);

        if (eventElementType === EventElementTypes.Teardrop) {
            svg.append('path')
                .attr('transform', (d: any) => {
                    return 'translate(' + (colorKeyWidth * .75) + ',' + (colorKeyHeight * .75) + ') rotate(180)';
                })
                .attr('d', this.teardropD(colorKeyWidth / 2, colorKeyHeight / 2))
                .attr('stroke-width', Math.min(colorKeyUnitLength / 2.25, 8))
                .style('fill', 'none')
                .style('stroke', "url(#" + gradientKey + ")");

        } else {
            let rect = svg.append('rect')
                .attr('width', colorKeyUnitLength)
                .attr('height', colorKeyUnitLength)
                .attr('transform', `translate(${(colorKeyWidth/2)},0)rotate(45)`)
                .attr('fill', 'black');
            rect.attr('fill', "url(#" + gradientKey + ")");
        }
    }

    private renderSplitBys = (aggKey, aggSelection, dataType, noSplitBys) => {
        var splitByLabelData = Object.keys(this.chartComponentData.timeArrays[aggKey]);
        var firstSplitBy = this.chartComponentData.displayState[aggKey].splitBys
                        [Object.keys(this.chartComponentData.displayState[aggKey].splitBys)[0]];
        var firstSplitByType = firstSplitBy ? firstSplitBy.visibleType : null;
        var isSame = Object.keys(this.chartComponentData.displayState[aggKey].splitBys).reduce((isSame: boolean, curr: string) => {
            return (firstSplitByType == this.chartComponentData.displayState[aggKey].splitBys[curr].visibleType) && isSame;
        }, true);
        let showMoreSplitBys = () => {
            const oldShownSplitBys = this.chartComponentData.displayState[aggKey].shownSplitBys; 
            this.chartComponentData.displayState[aggKey].shownSplitBys = Math.min(oldShownSplitBys + 20, splitByLabelData.length);
            if (oldShownSplitBys != this.chartComponentData.displayState[aggKey].shownSplitBys) {
                this.renderSplitBys(aggKey, aggSelection, dataType, noSplitBys);
            }
        }

        let splitByContainer = aggSelection.selectAll(".tsi-splitByContainer").data([aggKey]);
            var splitByContainerEntered = splitByContainer.enter().append("div")
                .merge(splitByContainer)
                .classed("tsi-splitByContainer", true);

        var splitByLabels = splitByContainerEntered.selectAll('.tsi-splitByLabel')
            .data(splitByLabelData.slice(0, this.chartComponentData.displayState[aggKey].shownSplitBys), function (d: string): string {
                return d;
            });

        let self = this;

        var splitByLabelsEntered = splitByLabels                    
            .enter()
            .append("div")
            .merge(splitByLabels)
            .attr('role', this.legendState === 'compact' ? 'button' : 'presentation')
            .attr('tabindex', this.legendState === 'compact' ? '0' : '-1')
            .on('keypress', (event, splitBy: string) => {
                if (this.legendState === 'compact' && (event.keyCode === 13 || event.keyCode === 32)) { //space or enter
                    this.toggleSplitByVisible(aggKey, splitBy);
                    this.drawChart();
                    event.preventDefault();
                }
            })
            .on("click", function (event: any, splitBy: string) {
                if (self.legendState == "compact") {
                    self.toggleSplitByVisible(aggKey, splitBy);
                } else {
                    self.toggleSticky(aggKey, splitBy);
                }
                self.drawChart();
            })
            .on("mouseover", function(event, splitBy: string) {
                event.stopPropagation();
                self.labelMouseover(aggKey, splitBy);
            })
            .on("mouseout", function(event) {
                event.stopPropagation();
                self.svgSelection.selectAll(".tsi-valueElement")
                            .attr("stroke-opacity", 1)
                            .attr("fill-opacity", 1);
                self.labelMouseout(self.svgSelection, aggKey);
            })
            .attr("class", (splitBy, i) => {
                let compact = (dataType !== DataTypes.Numeric) ? 'tsi-splitByLabelCompact' : '';
                let shown = Utils.getAgVisible(self.chartComponentData.displayState, aggKey, splitBy) ? 'shown' : ''; 
                return `tsi-splitByLabel tsi-splitByLabel ${compact} ${shown}`;
            })
            .classed("stickied", (splitBy, i) => {
                if (self.chartComponentData.stickiedKey != null) {
                    return aggKey == self.chartComponentData.stickiedKey.aggregateKey && splitBy == self.chartComponentData.stickiedKey.splitBy;
                }
            });

        var colors = Utils.createSplitByColors(self.chartComponentData.displayState, aggKey, self.chartOptions.keepSplitByColor);

        splitByLabelsEntered.each(function (splitBy, j) {
            let color = (self.chartComponentData.isFromHeatmap) ? self.chartComponentData.displayState[aggKey].color : colors[j];
            if (dataType === DataTypes.Numeric || noSplitBys || self.legendState === 'compact'){
                let colorKey = d3.select(this).selectAll<any, unknown>('.tsi-colorKey').data([color]);
                let colorKeyEntered = colorKey.enter()
                    .append("div")
                    .attr("class", 'tsi-colorKey')
                    .merge(colorKey);
                if (dataType === DataTypes.Numeric) {
                    colorKeyEntered.style('background-color', (d) => {
                        return d;
                    });
                } else {
                    self.createNonNumericColorKey(dataType, colorKeyEntered, aggKey);
                } 
                d3.select(this).classed('tsi-nonCompactNonNumeric', 
                    (dataType === DataTypes.Categorical || dataType === DataTypes.Events) && this.legendState !== 'compact');
                colorKey.exit().remove();    
            } else {
                d3.select(this).selectAll('.tsi-colorKey').remove();
            }

            if (d3.select(this).select('.tsi-eyeIcon').empty()) {
                d3.select(this).append("button")
                    .attr("class", "tsi-eyeIcon")
                    .attr('aria-label', () => {
                        let showOrHide = self.chartComponentData.displayState[aggKey].splitBys[splitBy].visible ? self.getString('hide series') : self.getString('show series');            
                        return `${showOrHide} ${splitBy} ${self.getString('in group')} ${self.chartComponentData.displayState[aggKey].name}`;

                    })
                    .attr('title', () => self.getString('Show/Hide values'))
                    .on("click", function (event) {
                        event.stopPropagation();
                        self.toggleSplitByVisible(aggKey, splitBy);
                        d3.select(this)
                            .classed("shown", Utils.getAgVisible(self.chartComponentData.displayState, aggKey, splitBy));
                        self.drawChart();
                    });    
            }

            if (d3.select(this).select('.tsi-seriesName').empty()) {
                let seriesName = d3.select(this)
                    .append('div')
                    .attr('class', 'tsi-seriesName');
                Utils.appendFormattedElementsFromString(seriesName, noSplitBys ? (self.chartComponentData.displayState[aggKey].name): splitBy);
            }

            if (dataType === DataTypes.Numeric) {
                if (d3.select(this).select('.tsi-seriesTypeSelection').empty()) {
                    d3.select(this).append("select")
                        .attr('aria-label', `${self.getString("Series type selection for")} ${splitBy} ${self.getString('in group')} ${self.chartComponentData.displayState[aggKey].name}`)
                        .attr('class', 'tsi-seriesTypeSelection')
                        .on("change", function (data: any) {
                            var seriesType: any = d3.select(this).property("value");
                            self.chartComponentData.displayState[aggKey].splitBys[splitBy].visibleType = seriesType; 
                            self.drawChart();
                        })
                        .on("click", (event) => {
                            event.stopPropagation();
                        });
                }
                d3.select(this).select('.tsi-seriesTypeSelection')
                    .each(function (d) {
                        var typeLabels = d3.select(this).selectAll<HTMLOptionElement, unknown>('option')
                        .data(data => self.chartComponentData.displayState[aggKey].splitBys[splitBy].types.map( (type) => {
                            return {
                                type: type,
                                aggKey: aggKey,
                                splitBy: splitBy,
                                visibleMeasure: Utils.getAgVisibleMeasure(self.chartComponentData.displayState, aggKey, splitBy)
                            }
                        }));

                        typeLabels
                            .enter()
                            .append("option")
                            .attr("class", "seriesTypeLabel")
                            .merge(typeLabels)
                            .property("selected", (data: any) => {
                                return ((data.type == Utils.getAgVisibleMeasure(self.chartComponentData.displayState, data.aggKey, data.splitBy)) ? 
                                        " selected" : "");
                            })                           
                            .text((data: any) => data.type);
                        typeLabels.exit().remove();
                    });
            } else {
                d3.select(this).selectAll('.tsi-seriesTypeSelection').remove();
            }
        });
        splitByLabels.exit().remove();

        let shouldShowMore = self.chartComponentData.displayState[aggKey].shownSplitBys < splitByLabelData.length;
        splitByContainerEntered.selectAll('.tsi-legendShowMore').remove();
        if(this.legendState === 'shown' && shouldShowMore) {
            splitByContainerEntered.append('button')
                .text(this.getString('Show more'))
                .attr('class', 'tsi-legendShowMore')
                .style('display', (this.legendState === 'shown' && shouldShowMore) ? 'block': 'none')
                .on('click', showMoreSplitBys);
        }

        splitByContainerEntered.on("scroll", function () {
            if (self.chartOptions.legend === 'shown') {
                if ((<any>this).scrollTop + (<any>this).clientHeight + 40 > (<any>this).scrollHeight) {
                    showMoreSplitBys();
                }    
            }
        });
        splitByContainer.exit().remove();
    }

    private toggleSticky = (aggregateKey: string, splitBy: string) => {
        //don't do anything if not visible 
        if (!this.chartComponentData.displayState[aggregateKey].visible ||
            !this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible)
            return;
        if (this.chartComponentData.stickiedKey != null && 
            this.chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
            this.chartComponentData.stickiedKey.splitBy == splitBy){
            this.chartComponentData.stickiedKey = null;
        } else {
            if (this.stickySeriesAction) {
                this.stickySeriesAction(aggregateKey, splitBy);
            }
        }
    }

	public draw(legendState: string, chartComponentData, labelMouseover, svgSelection, options, labelMouseoutAction = null, stickySeriesAction = null, event?: any) {
        this.chartOptions.setOptions(options);
        this.chartComponentData = chartComponentData;
        this.legendState = legendState;
        this.stickySeriesAction = stickySeriesAction;
        this.labelMouseover = labelMouseover;
        this.labelMouseout = this.labelMouseoutWrapper(labelMouseoutAction, svgSelection, event);
        this.svgSelection = svgSelection;
        var legend = this.legendElement;
        var self = this;

        
        super.themify(this.legendElement, this.chartOptions.theme);

        legend.style('visibility', this.legendState != 'hidden')
            .classed('compact', this.legendState == 'compact')
            .classed('hidden', this.legendState == 'hidden');

        let seriesNames = Object.keys(this.chartComponentData.displayState);
        var seriesLabels: any = legend.selectAll(".tsi-seriesLabel")
            .data(seriesNames, d => d);

        var seriesLabelsEntered = seriesLabels.enter()
            .append("div") 
            .merge(seriesLabels)
            .attr("class", (d, i) => {
                return "tsi-seriesLabel " + (this.chartComponentData.displayState[d]["visible"] ? " shown" : "");
            })
            .style("min-width", () => {
                return Math.min(124, this.legendElement.node().clientWidth / seriesNames.length) + 'px';  
            })
            .style("border-color", function (d, i) {
                if (d3.select(this).classed("shown"))
                    return self.chartComponentData.displayState[d].color;
                return "lightgray";
            });

        var self = this;

        const heightPerNameLabel: number = 25;
        const verticalPaddingPerSeriesLabel: number = 16;
        const usableLegendHeight: number = legend.node().clientHeight;
        var prospectiveAggregateHeight = Math.ceil(Math.max(201, (usableLegendHeight / seriesLabelsEntered.size())));
        var contentHeight = 0;

        seriesLabelsEntered.each(function (aggKey: string, i: number) {
            let heightPerSplitBy = self.getHeightPerSplitBy(aggKey);
            var splitByLabelData = Object.keys(self.chartComponentData.timeArrays[aggKey]);
            var noSplitBys: boolean = splitByLabelData.length == 1 && splitByLabelData[0] == "";
            var seriesNameLabel = d3.select(this).selectAll<HTMLButtonElement, unknown>(".tsi-seriesNameLabel").data([aggKey]);
            d3.select(this).classed('tsi-nsb', noSplitBys);
            var enteredSeriesNameLabel = seriesNameLabel.enter().append("button")
                .merge(seriesNameLabel)
                .attr("class", (agg: string, i) => {
                    return "tsi-seriesNameLabel" + (self.chartComponentData.displayState[agg].visible ? " shown" : "");
                }) 
                .attr("aria-label", (agg: string) => {
                    let showOrHide = self.chartComponentData.displayState[agg].visible ? self.getString('hide group') : self.getString('show group');
                    return `${showOrHide} ${self.getString('group')} ${Utils.stripNullGuid(self.chartComponentData.displayState[agg].name)}`;
                })   
                .on("click", function (event, d: string) {
                    var newState = !self.chartComponentData.displayState[d].visible;
                    self.chartComponentData.displayState[d].visible = newState;

                    //turn off sticky if making invisible
                    if (newState == false && (self.chartComponentData.stickiedKey != null && 
                        self.chartComponentData.stickiedKey.aggregateKey == d)) {
                        self.chartComponentData.stickiedKey = null;
                    }
                    self.drawChart();
                })
                .on("mouseover", (event, d) => {
                    labelMouseover(d);
                })
                .on("mouseout", (event, d) => {
                    self.labelMouseout(svgSelection, d);
                });
            let dataType = self.chartComponentData.displayState[aggKey].dataType;
            if (dataType === DataTypes.Categorical || dataType === DataTypes.Events) {
                enteredSeriesNameLabel.classed('tsi-nonCompactNonNumeric', true);
                let colorKey = enteredSeriesNameLabel.selectAll<HTMLDivElement, unknown>('.tsi-colorKey').data(['']);
                let colorKeyEntered = colorKey.enter()
                    .append("div")
                    .attr("class", 'tsi-colorKey')
                    .merge(colorKey);
                self.createNonNumericColorKey(dataType, colorKeyEntered, aggKey);
                colorKey.exit().remove();
            }

            var seriesNameLabelText = enteredSeriesNameLabel.selectAll<HTMLHeadingElement, unknown>("h4").data([aggKey]);
            seriesNameLabelText.enter()
                .append("h4")
                .merge(seriesNameLabelText)
                .attr("title", (d: string) => Utils.stripNullGuid(self.chartComponentData.displayState[d].name))
                .each(function() {
                    Utils.appendFormattedElementsFromString(d3.select(this), self.chartComponentData.displayState[aggKey].name);
                });
            

            seriesNameLabelText.exit().remove();
            seriesNameLabel.exit().remove();

            var splitByContainerHeight;
            if (splitByLabelData.length > (prospectiveAggregateHeight / heightPerSplitBy)) {
                splitByContainerHeight = prospectiveAggregateHeight - heightPerNameLabel;
                contentHeight += splitByContainerHeight + heightPerNameLabel;
            } else if (splitByLabelData.length > 1 || (splitByLabelData.length === 1 && splitByLabelData[0] !== "")) {
                splitByContainerHeight = splitByLabelData.length * heightPerSplitBy + heightPerNameLabel;
                contentHeight += splitByContainerHeight + heightPerNameLabel;
            } else {
                splitByContainerHeight = heightPerSplitBy;
                contentHeight += splitByContainerHeight;
            }
            if (self.chartOptions.legend == "shown") {
                d3.select(this).style("height", splitByContainerHeight + "px");
            } else {
                d3.select(this).style("height", "unset");
            }

            var splitByContainer = d3.select(this).selectAll<HTMLDivElement, unknown>(".tsi-splitByContainer").data([aggKey]);
            var splitByContainerEntered = splitByContainer.enter().append("div")
                .merge(splitByContainer)
                .classed("tsi-splitByContainer", true);

            let aggSelection = d3.select(this);
            
            var sBs = self.renderSplitBys(aggKey, aggSelection, dataType, noSplitBys);
            splitByContainerEntered.on("scroll", function () {
                if (self.chartOptions.legend == "shown") {
                    if ((<any>this).scrollTop + (<any>this).clientHeight + 40 > (<any>this).scrollHeight) {
                        const oldShownSplitBys = self.chartComponentData.displayState[aggKey].shownSplitBys; 
                        self.chartComponentData.displayState[aggKey].shownSplitBys = Math.min(oldShownSplitBys + 20, splitByLabelData.length);
                        if (oldShownSplitBys != self.chartComponentData.displayState[aggKey].shownSplitBys) {
                            self.renderSplitBys(aggKey, aggSelection, dataType, noSplitBys);
                        }
                    }    
                }
            });
            d3.select(this).on('scroll', function () {
                if (self.chartOptions.legend == "compact") {
                    if ((<any>this).scrollLeft + (<any>this).clientWidth + 40 > (<any>this).scrollWidth) {
                        const oldShownSplitBys = self.chartComponentData.displayState[aggKey].shownSplitBys; 
                        self.chartComponentData.displayState[aggKey].shownSplitBys = Math.min(oldShownSplitBys + 20, splitByLabelData.length);
                        if (oldShownSplitBys != self.chartComponentData.displayState[aggKey].shownSplitBys) {
                            this.renderSplitBys(dataType);                   
                        }
                    }    
                }
            });
            splitByContainer.exit().remove();

        });

        if (this.chartOptions.legend == 'shown') {
            var legendHeight = legend.node().clientHeight;
            //minSplitBysForFlexGrow: the minimum number of split bys for flex-grow to be triggered 
            if (contentHeight < usableLegendHeight) {
                this.legendElement.classed("tsi-flexLegend", true);
                seriesLabelsEntered.each(function (d) {
                    let heightPerSplitBy = self.getHeightPerSplitBy(d);
                    var minSplitByForFlexGrow = (prospectiveAggregateHeight - heightPerNameLabel) / heightPerSplitBy;

                    var splitBysCount = Object.keys(self.chartComponentData.displayState[String(d3.select(this).data()[0])].splitBys).length;
                    if (splitBysCount > minSplitByForFlexGrow) {
                        d3.select(this).style("flex-grow", 1);
                    }
                });
            } else {
                this.legendElement.classed("tsi-flexLegend", false);
            }
        }

        seriesLabels.exit().remove();
	}
}

export default Legend;
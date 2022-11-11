import * as d3 from 'd3';
import * as d3Voronoi from 'd3-voronoi';
import './ScatterPlot.scss';
import { ChartVisualizationComponent } from './../../Interfaces/ChartVisualizationComponent';
import Legend from './../Legend';
import { ScatterPlotData } from '../../Models/ScatterPlotData';
import Slider from './../Slider';
import Tooltip from '../Tooltip';
import Utils from '../../Utils';
import { TooltipMeasureFormat } from "./../../Constants/Enums";

class ScatterPlot extends ChartVisualizationComponent {
    private activeDot: any = null;
    private chartHeight: number;
    private controlsOffset: number;
    private focus: any;
    private focusedAggKey: string;
    private focusedSplitBy: string;
    private focusedSite: any = null;
    private g: any;
    private height: number;
    private measures: Array<string>;
    private pointWrapper: any;
    private lineWrapper: any;
    private rMeasure: string;
    private rScale: any;
    private slider: any;
    private sliderWrapper: any;
    private targetElement: any;
    private tooltip: Tooltip;
    private voronoi: any;
    private voronoiDiagram: any;
    private voronoiGroup: any;
    private xAxis: any;
    private xMeasure: string;
    private xScale: any;
    private yAxis: any;
    private yMeasure: string;
    private yScale: any;
    private xAxisLabel: any;
    private yAxisLabel: any;

    readonly lowOpacity = 0.15; 
    readonly standardOpacity = 0.6; 
    private focusOpacity = 0.8;
    readonly standardStroke = 1;
    readonly lowStroke = 0.3;
    
    chartComponentData = new ScatterPlotData();

    constructor(renderTarget: Element){
        super(renderTarget);
        this.chartMargins = {        
            top: 40,
            bottom: 48,
            left: 70, 
            right: 60
        };
    }

    ScatterPlot(){}
    public render(data: any, options: any, aggregateExpressionOptions: any, fromSlider: boolean = false) {
        super.render(data, options, aggregateExpressionOptions);
        // If measure options not set, or less than 2, return
        if(this.chartOptions["spMeasures"] == null || (this.chartOptions["spMeasures"] != null && this.chartOptions["spMeasures"].length < 2)){
            let invalidMessage = "spMeasures not correctly specified or has length < 2: " + this.chartOptions["spMeasures"] + 
            "\n\nPlease add the following chartOption: {spMeasures: ['example_x_axis_measure', 'example_y_axis_measure', 'example_radius_measure']} " +
            "where the measures correspond to the data key names."
            console.log(invalidMessage);
            return;
        }

        this.chartMargins.top = (this.chartOptions.legend === 'compact') ? 84 : 40;
        if(!this.chartOptions.hideChartControlPanel)
            this.chartMargins.top += 20;
        this.chartMargins.left = (this.chartOptions.spAxisLabels != null && this.chartOptions.spAxisLabels.length >= 2) ? 120 : 70;

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.chartOptions.timestamp, this.aggregateExpressionOptions);
        this.chartComponentData.setExtents(this.chartOptions.spMeasures, !fromSlider);
        
        // Check measure validity
        if(!this.checkExtentValidity()) return;

        this.controlsOffset = (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0)
        this.setWidthAndHeight();

        /******** STATIC INITIALIZATION ********/   
        if (this.svgSelection == null) {
            // Initialize extents
            //this.chartComponentData.setExtents(this.chartOptions.spMeasures);
            this.targetElement = d3.select(this.renderTarget)
                .classed("tsi-scatterPlot", true);
           
            this.svgSelection = this.targetElement.append("svg")
                .attr("class", "tsi-scatterPlotSVG tsi-chartSVG")
                .attr('title', this.getString('Scatter plot'))
                .attr("height", this.height)

            this.g = this.svgSelection.append("g")
                .classed("tsi-svgGroup", true)

            this.lineWrapper = this.g.append("g")
                .classed("tsi-lineWrapper", true);

            this.pointWrapper = this.g.append("g")
                .classed("tsi-pointWrapper", true);

            // Create temporal slider div
            this.sliderWrapper = d3.select(this.renderTarget).append('div').classed('tsi-sliderWrapper', true);
                
            this.tooltip = new Tooltip(d3.select(this.renderTarget));

            // Initialize voronoi
            this.voronoiGroup = this.g.append("rect")
                .attr("class", "tsi-voronoiWrap")
                .attr("fill", "transparent");

            // Initialize focus crosshair lines
            this.focus = this.pointWrapper.append("g")
                .attr("transform", "translate(-100,-100)")
                .attr("class", "tsi-focus")
                .style("display", "none");
            
            this.focus.append("line")
                .attr("class", "tsi-focusLine tsi-vLine")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", this.chartOptions.aggTopMargin)
                .attr("y2", this.chartHeight);

            this.focus.append("line")
                .attr("class", "tsi-focusLine tsi-hLine")
                .attr("x1", 0)
                .attr("x2", this.chartWidth)
                .attr("y1", 0)
                .attr("y2", 0);
            
            // Initialize focus axis data boxes
            let hHoverG: any = this.focus.append("g")
                .attr("class", 'hHoverG')
                .style("pointer-events", "none")
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            hHoverG.append("rect")
                .style("pointer-events", "none")
                .attr("class", 'hHoverBox')
                .attr("x", 0)
                .attr("y", 4)
                .attr("width", 0)
                .attr("height", 0);
            hHoverG.append("text")
                .style("pointer-events", "none")
                .attr("class", "hHoverText")
                .attr("dy", ".71em")
                .attr("transform", "translate(0,9)")
                .text((d: string) => d);

            let vHoverG: any = this.focus.append("g")
                .attr("class", 'vHoverG')
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            vHoverG.append("rect")
                .attr("class", 'vHoverBox')
                .attr("x", -5)
                .attr("y", 0)
                .attr("width", 0)
                .attr("height", 0)
            vHoverG.append("text")
                .attr("class", "vHoverText")
                .attr("dy", ".32em")
                .attr("x", -10)
                .text((d: string) => d);

            // Add Window Resize Listener
            window.addEventListener("resize", (event) => {
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw(true, event);
                }
            });

            // Temporal slider
            this.slider = new Slider(<any>d3.select(this.renderTarget).select('.tsi-sliderWrapper').node());

            // Legend
            this.legendObject = new Legend(this.draw.bind(this), this.renderTarget, this.CONTROLSWIDTH);
        }

        // Draw scatter plot
        this.draw();
        this.gatedShowGrid();
        
        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.ellipsisContainer && event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });
        
        this.legendPostRenderProcess(this.chartOptions.legend, this.svgSelection, false);
    }
    
    private getSliderWidth () {
        return this.chartWidth + this.chartMargins.left + this.chartMargins.right - 16;
    }

    protected tooltipFormat (d: any, text: any, measureFormat: TooltipMeasureFormat, xyrMeasures: any) {
        super.tooltipFormat(d, text, measureFormat, xyrMeasures);
        if (!this.chartOptions.isTemporal) {
            let titleGroup = text.select('.tsi-tooltipTitleGroup');
            if (d.timestamp) {
                titleGroup.append('h4')
                    .attr('class', 'tsi-tooltipSubtitle tsi-tooltipTimeStamp')
                    .text(this.formatDate(d.timestamp, this.chartComponentData.getTemporalShiftMillis(d.aggregateKey)));
            }    
        }
    }

    /******** DRAW UPDATE FUNCTION ********/   
    public draw = (isFromResize = false, event?: any) => {
        this.activeDot = null;
        this.chartComponentData.updateTemporalDataArray(this.chartOptions.isTemporal);
        
        // Update extents to fit data if not temporal
        this.chartComponentData.updateExtents(this.chartOptions.spMeasures);

        this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")

        // If only one data series visible, do not highlight on hover
        let visibleSplitBys = 0;
        Object.keys(this.chartComponentData.displayState).forEach(aggKey => {
            if(this.chartComponentData.displayState[aggKey].visible)
                Object.keys(this.chartComponentData.displayState[aggKey].splitBys).forEach(splitBy => {
                    if(this.chartComponentData.displayState[aggKey].splitBys[splitBy].visible)
                        visibleSplitBys++
                });
        })

        if(visibleSplitBys == 1) this.focusOpacity = this.standardOpacity;
        // Determine the number of timestamps present, add margin for slider
        if(this.chartComponentData.allTimestampsArray.length > 1 && this.chartOptions.isTemporal){
            this.chartMargins.bottom = 88;
        }
        else{
            this.chartMargins.bottom = 48;
        }
           
        this.setWidthAndHeight(isFromResize);
        this.svgSelection
            .attr("height", this.height)
            .style("width", `${this.getSVGWidth()}px`);

        this.g
            .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
        
        this.voronoiGroup
            .attr("width", this.chartWidth)
            .attr("height", this.chartHeight)

        super.themify(this.targetElement, this.chartOptions.theme);

        // Draw control panel
        if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel === null) {
            this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, this.chartMargins.top, this.chartOptions);
        } else  if (this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null){
            this.removeControlPanel();
        }
        if (this.chartControlsPanel !== null && this.ellipsisItemsExist()) {
            this.drawEllipsisMenu();
            this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 44), 0) + 'px');
        } else {
            this.removeEllipsisMenu();
        }

        // Resize focus line
        this.focus.select('.tsi-hLine').attr("x2", this.chartWidth);
        this.focus.select('.tsi-vLine').attr("y2", this.chartHeight);
        this.measures = this.chartOptions.spMeasures;
        
        this.xMeasure = this.measures[0];
        this.yMeasure = this.measures[1];
        this.rMeasure = this.measures[2] !== undefined ? this.measures[2] : null;

        let xExtentRange = this.chartComponentData.extents[this.xMeasure][1] - this.chartComponentData.extents[this.xMeasure][0];
        let yExtentRange = this.chartComponentData.extents[this.yMeasure][1] - this.chartComponentData.extents[this.yMeasure][0];

        // Pad extents
        let xOffset = (20 / this.chartWidth) * (xExtentRange == 0 ? 1 : xExtentRange);
        let yOffset = (20 / this.chartHeight) * (yExtentRange == 0 ? 1: yExtentRange);

        let rOffset = null;

        if(this.rMeasure){
            let rExtentRange = this.chartComponentData.extents[this.rMeasure][1] - this.chartComponentData.extents[this.rMeasure][0];
            rOffset = (20 / this.chartHeight) * (rExtentRange == 0 ? 1 : rExtentRange);
        }

        // Check measure validity
        if(!this.checkExtentValidity()) return;
        
        // Init scales
        this.yScale = d3.scaleLinear()
            .range([this.chartHeight, 0])
            .domain([this.chartComponentData.extents[this.yMeasure][0] - yOffset,this.chartComponentData.extents[this.yMeasure][1] + yOffset]);

        this.xScale = d3.scaleLinear()
            .range([0, this.chartWidth])
            .domain([this.chartComponentData.extents[this.xMeasure][0] - xOffset,this.chartComponentData.extents[this.xMeasure][1] + xOffset]); 

        this.rScale = d3.scaleLinear()
            .range(this.chartOptions.scatterPlotRadius.slice(0,2))
            .domain(this.rMeasure === null ? [0, 0] : [this.chartComponentData.extents[this.rMeasure][0] - rOffset,this.chartComponentData.extents[this.rMeasure][1] + rOffset]);
        
        // Draw axis
        this.drawAxis();

        // Draw axis labels
        this.drawAxisLabels();

        // Draw connecting lines (if toggled on)
        this.drawConnectingLines();

        // Draw data
        let scatter = this.pointWrapper.selectAll(".tsi-dot")
            .data(this.cleanData(this.chartComponentData.temporalDataArray),  (d) => {
                if(this.chartOptions.isTemporal){
                    return d.aggregateKey + d.splitBy + d.splitByI;
                } else{
                    return d.aggregateKey + d.splitBy + d.timestamp;
                }
            });
        
        scatter
            .enter()
            .append("circle")
            .attr("class", "tsi-dot")
            .attr("r", (d) => this.rScale(d.measures[this.rMeasure]))
            .attr("cx", (d) => this.xScale(d.measures[this.xMeasure]))
            .attr("cy", (d) => this.yScale(d.measures[this.yMeasure]))
            .merge(scatter)
            .attr("id", (d) => this.getClassHash(d.aggregateKey, d.splitBy, d.splitByI, d.timestamp))
            .transition()
            .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
            .ease(d3.easeExp)
            .attr("r", (d) => this.rScale(d.measures[this.rMeasure]))
            .attr("cx", (d) => this.xScale(d.measures[this.xMeasure]))
            .attr("cy", (d) => this.yScale(d.measures[this.yMeasure]))
            .attr("fill", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke-opacity", this.standardStroke)
            .attr("fill-opacity", this.standardOpacity)
            .attr("stroke-width", "1px")

        scatter.exit().remove();
        
        // Draw voronoi
        this.drawVoronoi();

        // Resize controls
        this.setControlsPanelWidth();

        /******************** Temporal Slider ************************/
        if(this.chartComponentData.allTimestampsArray.length > 1 && this.chartOptions.isTemporal){
            d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', false);
            this.slider.render(this.chartComponentData.allTimestampsArray.map(ts => {
                var action = () => {
                    this.chartOptions.timestamp = ts;
                    this.render(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions, true);
                }
                return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, this.chartOptions.offset, 
                    this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(ts)), action: action};
            }), this.chartOptions, this.getSliderWidth(),  Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(this.chartComponentData.timestamp)));
        }
        else{
            if(this.slider)
                this.slider.remove();
            d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', true);
        }

        // Draw Legend
        this.legendObject.draw(
            this.chartOptions.legend,
            this.chartComponentData,
            this.labelMouseOver.bind(this), 
            this.svgSelection,
            this.chartOptions,
            this.labelMouseOut.bind(this),
            this.stickySeries,
            event);

        this.sliderWrapper
            .style("width", `${this.svgSelection.node().getBoundingClientRect().width + 10}px`);
    }

    /******** DRAW CONNECTING LINES BETWEEN POINTS ********/
    private drawConnectingLines(){
        // Don't render connecting lines on temporal mode
        if(this.chartOptions.isTemporal){
            this.lineWrapper.selectAll("*").remove();
            return;
        }

        let dataSet = this.cleanData(this.chartComponentData.temporalDataArray);
        let connectedSeriesMap = {};

        // Find measure by which to connect series of points
        const getPointConnectionMeasure = (point => {
            let pConMes = this.aggregateExpressionOptions[point.aggregateKeyI]?.pointConnectionMeasure;
            return pConMes && pConMes in point.measures ? pConMes : null;
        })

        // Map data into groups of connected points, if connectedPoints enabled for agg
        dataSet.forEach(point => {
            if(point.aggregateKeyI !== null && point.aggregateKeyI < this.aggregateExpressionOptions.length && 
                this.aggregateExpressionOptions[point.aggregateKeyI].connectPoints){
                let series = point.aggregateKey + "_" + point.splitBy;
                if(series in connectedSeriesMap){
                    connectedSeriesMap[series].data.push(point);
                } else{
                    connectedSeriesMap[series] = {
                        data: [point],
                        pointConnectionMeasure: getPointConnectionMeasure(point)
                    }
                }
            }
        })

        // Sort connected series by pointConnectionMeasure
        for(let key of Object.keys(connectedSeriesMap)){
            let sortMeasure = connectedSeriesMap[key].pointConnectionMeasure;
            // If sort measure specified, sort by that measure
            if(sortMeasure){
                connectedSeriesMap[key].data.sort((a,b) => {
                    if(a.measures[sortMeasure] < b.measures[sortMeasure]) return -1;
                    if(a.measures[sortMeasure] > b.measures[sortMeasure]) return 1;
                    return 0;
                })
            }
        }

        let line = d3.line()
            .x((d:any) => this.xScale(d.measures[this.xMeasure]))
            .y((d:any) => this.yScale(d.measures[this.yMeasure]))
            .curve(this.chartOptions.interpolationFunction); // apply smoothing to the line

        // Group lines by aggregate
        let connectedGroups = this.lineWrapper.selectAll(`.tsi-lineSeries`).data(Object.keys(connectedSeriesMap));

        let self = this; 

        connectedGroups.enter()
            .append("g")
            .attr("class", 'tsi-lineSeries')
            .merge(connectedGroups)
            .each(function(seriesName){
                let series = d3.select(this).selectAll<SVGPathElement, unknown>(`.tsi-line`).data([connectedSeriesMap[seriesName].data], d => d[0].aggregateKeyI+d[0].splitBy);

                series.exit().remove();

                series
                    .enter()
                    .append("path")
                    .attr("class", `tsi-line`)
                    .merge(series)
                    .attr("fill", "none")
                    .transition()
                    .duration(self.chartOptions.noAnimate ? 0 : self.TRANSDURATION)
                    .ease(d3.easeExp)
                    .attr("stroke", (d) => Utils.colorSplitBy(self.chartComponentData.displayState, d[0].splitByI, d[0].aggregateKey, self.chartOptions.keepSplitByColor))
                    .attr("stroke-width", 2.5)
                    .attr("stroke-linejoin", "round")
                    .attr("stroke-linecap", "round")
                    .attr("d", line)
            })

        connectedGroups.exit().remove()
    }

    /******** CHECK VALIDITY OF EXTENTS ********/
    private checkExtentValidity(){
        if(this.chartComponentData.allValues == 0){
            return true;
        }
        let testExtent = {};
        this.chartOptions.spMeasures.forEach(measure => {
            testExtent[measure] = d3.extent(this.chartComponentData.allValues, (v:any) => {
                if(!v.measures)
                    return null
                return measure in v.measures ? v.measures[measure] : null
            });
        });
        Object.keys(testExtent).forEach(extent => {
            testExtent[extent].forEach(el => {
                if(el == undefined){
                    console.log("Undefined Measure: ", extent)
                    return false;
                }
            });
        });
        return true;
    }

    /******** CREATE VORONOI DIAGRAM FOR MOUSE EVENTS ********/
    private drawVoronoi(){
        let voronoiData = this.getVoronoiData(this.chartComponentData.temporalDataArray);
        let self = this;

        // Create random offset to solve colinear data issue
        const getRandomInRange = (min, max) => {
            return Math.random() * (max - min) + min;
        }
        const getOffset = () => (Math.random() < 0.5 ? -1 : 1) * getRandomInRange(0, .01);
        
        this.voronoi = d3Voronoi.voronoi()
            .x((d:any) => this.xScale(d.measures[this.xMeasure]) + getOffset())
            .y((d:any) => this.yScale(d.measures[this.yMeasure]) + getOffset())
            .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

        this.voronoiDiagram = this.voronoi(voronoiData);

        this.voronoiGroup
            .on("mousemove", function(event){
                let mouseEvent = d3.pointer(event);
                self.voronoiMouseMove(mouseEvent);
            })
            .on("mouseover", function(event){
                let mouseEvent = d3.pointer(event);
                self.voronoiMouseMove(mouseEvent);
                let site = self.voronoiDiagram.find(mouseEvent[0],  mouseEvent[1]);
                if(site != null)
                    self.labelMouseOver(site.data.aggregateKey, site.data.splitBy);
            })
            .on("mouseout", function(){
                self.voronoiMouseOut();
            }) 
            .on("click", function(event){
                let mouseEvent = d3.pointer(event);
                self.voronoiClick(mouseEvent);
            });
    }

    /******** STICKY/UNSTICKY DATA GROUPS ON VORONOI DIAGRAM CLICK ********/
    private voronoiClick(mouseEvent: any){
        let site = this.voronoiDiagram.find(mouseEvent[0], mouseEvent[1]);
        if(site == null) return;      
        // Unsticky all
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
        
        if (this.chartComponentData.stickiedKey != null) {
            this.chartComponentData.stickiedKey = null;
            // Recompute Voronoi
            this.voronoiDiagram = this.voronoi(this.getVoronoiData(this.chartComponentData.temporalDataArray));
            site = this.voronoiDiagram.find(mouseEvent[0], mouseEvent[1]);
            this.voronoiMouseMove(mouseEvent);
            this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy)
            return;
        }

        this.stickySeries(site.data.aggregateKey, site.data.splitBy);
        this.chartOptions.onSticky(site.data.aggregateKey, site.data.splitBy);
    }

    /******** UPDATE STICKY SPLITBY  ********/
    public stickySeries  = (aggregateKey: string, splitBy: string = null) => {
        let filteredValues = this.getVoronoiData(this.chartComponentData.temporalDataArray);
        if (filteredValues == null || filteredValues.length == 0)
            return;

        this.chartComponentData.stickiedKey = {
            aggregateKey: aggregateKey,
            splitBy: (splitBy == null ? null : splitBy)
        };

        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: any)  {
            return (d3.select(this.parentNode).datum() == aggregateKey) && (filteredSplitBy == splitBy);
        })).classed("stickied", true);

        this.voronoiDiagram = this.voronoi(this.getVoronoiData(this.chartComponentData.temporalDataArray));
    }

    /******** HIGHLIGHT DOT TARGETED BY CROSSHAIRS WITH BLACK / WHITE STROKE BORDER ********/
    private highlightDot(site){
        
        //If dot is active, unhighlight
        this.unhighlightDot();
        // Add highlight border to newly focused dot
        let highlightColor = this.chartOptions.theme == "light" ? "black": "white";
        let idSelector = "#" + this.getClassHash(site.data.aggregateKey, site.data.splitBy, site.data.splitByI, site.data.timestamp);

        this.activeDot = this.svgSelection.select(idSelector);
       
        this.activeDot
            .attr("stroke", highlightColor)
            .attr("stroke-width", "2px")
            // Raise active dot above crosshair
            .raise().classed("active", true);
          
    }

    /******** GET UNIQUE STRING HASH ID FOR EACH DOT USING DATA ATTRIBUTES ********/   
    private getClassHash(aggKey: string, splitBy: string, splitByI: number, timestamp: string){
        return String("dot"+Utils.hash(aggKey + splitBy + splitByI.toString() + timestamp));
    }

    /******** UNHIGHLIGHT ACTIVE DOT ********/
    private unhighlightDot(){
        if(this.activeDot){
            this.activeDot
                    .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
                    .attr("stroke-width", "1px")
        }
        this.activeDot = null;
    }

    /******** EFFICIENTLY SWAP NEW FOCUSED GROUP WITH OLD FOCUSED GROUP ********/   
    private labelMouseMove(aggKey: string, splitBy: string){
        if (aggKey !== this.focusedAggKey || splitBy !== this.focusedSplitBy) {
            let selectedFilter = Utils.createValueFilter(aggKey, splitBy);
            let oldFilter = Utils.createValueFilter(this.focusedAggKey, this.focusedSplitBy);
          
            this.svgSelection.selectAll(".tsi-dot")
                .filter(selectedFilter)
                .attr("stroke-opacity", this.standardStroke)
                .attr("fill-opacity", this.focusOpacity)
            
            this.svgSelection.selectAll(".tsi-dot")
                .filter(oldFilter)
                .attr("stroke-opacity", this.lowStroke)
                .attr("fill-opacity", this.lowOpacity)

            let lineSelectedFilter = (d: any) => {
                return (d[0].aggregateKey === aggKey && d[0].splitBy === splitBy)
            }
    
            this.svgSelection.selectAll(".tsi-line")
                .filter((d: any) => lineSelectedFilter(d))
                .attr("stroke-opacity", this.standardStroke)
            
            this.svgSelection.selectAll(".tsi-line")
                .filter((d: any) => !lineSelectedFilter(d))
                .attr("stroke-opacity", this.lowStroke)

            this.focusedAggKey = aggKey;
            this.focusedSplitBy = splitBy;
        }
        // Raise crosshair to top
        this.focus.raise().classed("active", true);
        // Raise highlighted dot above crosshairs
        if(this.activeDot != null)
            this.activeDot.raise().classed("active", true);

        // Highlight legend group
        (this.legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: string) {
            return (d3.select(this.parentNode).datum() == aggKey) && (filteredSplitBy == splitBy);
        })).classed("inFocus", true);
    }

    /******** DRAW CROSSHAIRS, TOOLTIP, AND LEGEND FOCUS ********/
    private voronoiMouseMove(mouseEvent: any){
        let mouse_x = mouseEvent[0];
        let mouse_y = mouseEvent[1];
        let site = this.voronoiDiagram.find(mouse_x, mouse_y);
        if(site == null) return;

        // Short circuit mouse move if focused site has not changed
        if(this.focusedSite == null)
            this.focusedSite = site;
        else if(this.focusedSite == site) return;

        this.focusedSite = site;

        this.drawTooltip(site.data, [site[0], site[1]]);
        this.labelMouseMove(site.data.aggregateKey, site.data.splitBy);
        this.highlightDot(site);
        
        // Draw focus cross hair
        this.focus.style("display", "block");
        this.focus.attr("transform", "translate(" + site[0] + "," + site[1] + ")");
        this.focus.select('.tsi-hLine').attr("transform", "translate(" + (-site[0]) + ",0)");
        this.focus.select('.tsi-vLine').attr("transform", "translate(0," + (-site[1]) + ")");

        // Draw horizontal hover box 
        this.focus.select('.hHoverG')
        .attr("transform", "translate(0," + (this.chartHeight - site[1]) + ")")
        .select("text")
        .text((Utils.formatYAxisNumber(site.data.measures[this.xMeasure])));
        let textElemDimensions = (<any>this.focus.select('.hHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".hHoverG").select("rect")
            .attr("x", -(textElemDimensions.width / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 5);

        // Draw vertical hover box
        this.focus.select('.vHoverG')
            .attr("transform", "translate(" + (-site[0]) + ",0)")
            .select("text")
            .text(Utils.formatYAxisNumber(site.data.measures[this.yMeasure]))
        textElemDimensions = (<any>this.focus.select('.vHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".vHoverG").select("rect")
            .attr("x", -(textElemDimensions.width) - 13)
            .attr("y", -(textElemDimensions.height / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 4);

        this.legendObject.triggerSplitByFocus(site.data.aggregateKey, site.data.splitBy);
    }

    /******** HIDE TOOLTIP AND CROSSHAIRS ********/
    private voronoiMouseOut(){
        this.focusedSite = null;
        this.focus.style("display", "none");
        this.tooltip.hide();
        this.labelMouseOut();
        this.unhighlightDot();
    }

    /******** FILTER DATA BY VISIBLE AND STICKIED ********/
    private getVoronoiData(rawData: Array<any>){
        let cleanData = this.cleanData(rawData);

        let filteredValues =  cleanData.filter((d) => {
            return (this.chartComponentData.displayState[d.aggregateKey].visible && 
                this.chartComponentData.displayState[d.aggregateKey].splitBys[d.splitBy].visible)
        });

        if (this.chartComponentData.stickiedKey == null) return filteredValues;

        let stickiedValues = filteredValues.filter((d: any) => {
            return d.aggregateKey == this.chartComponentData.stickiedKey.aggregateKey &&
                ((this.chartComponentData.stickiedKey.splitBy == null) ? true : 
                d.splitBy == this.chartComponentData.stickiedKey.splitBy);
        });
        return stickiedValues;
    }

    /******** HIGHLIGHT FOCUSED GROUP ********/
    private labelMouseOver(aggKey: string, splitBy: string = null){
        // Remove highlight on previous legend group
        <any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);

        // Filter selected
        let selectedFilter = (d: any) => {
            let currAggKey = null, currSplitBy = null;
            if(d.aggregateKey != null) currAggKey = d.aggregateKey
            if(d.splitBy != null) currSplitBy = d.splitBy

            if(splitBy == null)
                return currAggKey == aggKey;

            if(currAggKey == aggKey && currSplitBy == splitBy)
                return false;
            return true;
        }

        //Highlight active group
        this.svgSelection.selectAll(".tsi-dot")
            .filter((d: any) => !selectedFilter(d))
            .attr("stroke-opacity", this.standardStroke)
            .attr("fill-opacity", this.focusOpacity)
        
        // Decrease opacity of unselected
        this.svgSelection.selectAll(".tsi-dot")
            .filter(selectedFilter)
            .attr("stroke-opacity", this.lowStroke)
            .attr("fill-opacity", this.lowOpacity)

        // Decrease opacity of unselected line
        this.svgSelection.selectAll(".tsi-line")
            .filter((d: any) => !(d[0].aggregateKey === aggKey && d[0].splitBy === splitBy))
            .attr("stroke-opacity", this.lowStroke)

    }

    /******** UNHIGHLIGHT FOCUSED GROUP ********/
    private labelMouseOut(){
         // Remove highlight on legend group
         <any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);

        this.g.selectAll(".tsi-dot")
            .attr("stroke-opacity", this.standardStroke)
            .attr("fill-opacity", this.standardOpacity)
            .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("fill", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke-width", "1px");

        this.g.selectAll(".tsi-line")
            .attr("stroke-opacity", this.standardStroke)
    }

    /******** FILTER DATA, ONLY KEEPING POINTS WITH ALL REQUIRED MEASURES ********/
    private cleanData(data: Array<any>){
        // Exclude any data which does not contain the specified
        // chart option measure
        let filtered = data.filter((value) => {
            let valOk = true;            
            this.chartOptions.spMeasures
            .forEach((measure) => {
                if(value.measures == null) valOk = false
                else if(!(measure in value.measures)){
                    valOk = false;
                }
            });
            return valOk;
        })
        return filtered;
    }

    /******** UPDATE CHART DIMENSIONS ********/
    private setWidthAndHeight(isFromResize = false){
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
        this.chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
        this.width = this.getWidth();
        if (!isFromResize) {
            this.chartWidth = this.getChartWidth();
        }
    }

    /******** SCALE AND DRAW AXIS ********/
    private drawAxis(){
        // Draw dynamic x axis and label
        this.xAxis = this.pointWrapper.selectAll(".xAxis").data([this.xScale]); 
        this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + (this.chartHeight) + ")")
            .call(d3.axisBottom(this.xScale).ticks(Math.max(2,Math.floor(this.chartWidth / 150))));
        
        this.xAxis.exit().remove();

        // Draw dynamic y axis and label
        this.yAxis = this.pointWrapper.selectAll(".yAxis").data([this.yScale]);
        this.yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(this.yAxis)
            .call(d3.axisLeft(this.yScale).ticks(Math.max(2, Math.floor(this.chartHeight / 90))));
            
        this.yAxis.exit().remove()
    }

    /******** DRAW X AND Y AXIS LABELS ********/
    private drawAxisLabels(){
        let self = this;
        let xLabelData, yLabelData;

        const truncateTextLength = (textSelection,  maxTextLengthPx: number) => {
            if(textSelection.node() && textSelection.node().getComputedTextLength) {
                var textLength = textSelection.node().getComputedTextLength();
                var text = textSelection.text();
                while ( textLength > maxTextLengthPx && text.length > 0) {
                    text = text.slice(0, -1);
                    textSelection.text(text + '...');
                    textLength = textSelection.node().getComputedTextLength();
                }
            }
        }
        
        // Associate axis label data
        (this.chartOptions.spAxisLabels != null && this.chartOptions.spAxisLabels.length >= 1) ?
          xLabelData = [this.chartOptions.spAxisLabels[0]] : xLabelData = [];

        (this.chartOptions.spAxisLabels != null && this.chartOptions.spAxisLabels.length >= 2) ?
        yLabelData = [this.chartOptions.spAxisLabels[1]] : yLabelData = [];

        this.xAxisLabel = this.pointWrapper.selectAll('.tsi-xAxisLabel').data(xLabelData);
        let xAxisLabel = this.xAxisLabel
            .enter()
            .append("text")
            .attr("class", "tsi-xAxisLabel tsi-AxisLabel")
            .merge(this.xAxisLabel)
            .style("text-anchor", "middle")
            .attr("transform", "translate(" + (this.chartWidth / 2) + " ," + (this.chartHeight + 42) + ")")
            .text(null);
        xAxisLabel.each(function(d) {
            let label = d3.select(this);
            Utils.appendFormattedElementsFromString(label, d, {inSvg: true});
        });
        //text is either in tspans or just in text. Either truncate text directly or through tspan
        if (xAxisLabel.selectAll("tspan").size() == 0)
            truncateTextLength(xAxisLabel, this.chartWidth)
        else {
            xAxisLabel.selectAll("tspan").each(function() {
                var tspanTextSelection = d3.select(this);
                truncateTextLength(tspanTextSelection, self.chartWidth / xAxisLabel.selectAll("tspan").size());
            });
        }
        this.xAxisLabel.exit().remove();

        this.yAxisLabel = this.pointWrapper.selectAll('.tsi-yAxisLabel').data(yLabelData);
        let yAxisLabel = this.yAxisLabel
            .enter()
            .append("text")
            .attr("class", "tsi-yAxisLabel tsi-AxisLabel")
            .merge(this.yAxisLabel)
            .style("text-anchor", "middle")
            .attr("transform", "translate(" + ( -70 ) + " ," + (this.chartHeight / 2) + ") rotate(-90)")
            .text(null);
        yAxisLabel.each(function(d) {
            let label = d3.select(this);
            Utils.appendFormattedElementsFromString(label, d, {inSvg: true});
        });
        //text is either in tspans or just in text. Either truncate text directly or through tspan
        if (yAxisLabel.selectAll("tspan").size() == 0)
            truncateTextLength(yAxisLabel, this.chartHeight)
        else {
            yAxisLabel.selectAll("tspan").each(function() {
                var tspanTextSelection = d3.select(this);
                truncateTextLength(tspanTextSelection, self.chartHeight / yAxisLabel.selectAll("tspan").size());
            });
        }
        this.yAxisLabel.exit().remove();
    }

    /******** DRAW TOOLTIP IF ENABLED ********/
    private drawTooltip (d: any, mousePosition) {
        let self = this;
        if (this.chartOptions.tooltip){
            let xPos = mousePosition[0];
            let yPos = mousePosition[1];

            let xyrMeasures = [this.xMeasure, this.yMeasure];
            if (this.rMeasure !== null) {
                xyrMeasures.push(this.rMeasure);
            }

            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, yPos, this.chartMargins, (text) => {
                d.aggregateName = this.chartComponentData.displayState[d.aggregateKey].name;
                this.tooltipFormat(d, text, TooltipMeasureFormat.Scatter, xyrMeasures);
            }, null, 20, 20, Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor));
        }
    }

    /******** HELPERS TO FORMAT TIME DISPLAY ********/
    private labelFormatUsesSeconds () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesSeconds;
    }

    private labelFormatUsesMillis () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesMillis;
    }

}

export default ScatterPlot

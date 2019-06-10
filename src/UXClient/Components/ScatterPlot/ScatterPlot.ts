import * as d3 from 'd3';
import './ScatterPlot.scss';
import { ChartComponent } from './../../Interfaces/ChartComponent';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { Legend } from './../Legend/Legend';
import { ScatterPlotData } from '../../Models/ScatterPlotData';
import {Slider} from './../Slider/Slider';
import { Tooltip } from '../Tooltip/Tooltip';
import { Utils } from './../../Utils';

class ScatterPlot extends ChartComponent {
    private activeDot: any = null;
    private chartHeight: number;
    private chartWidth: number;
    private controlsOffset: number;
    private focus: any;
    private focusedAggKey: string;
    private focusedSplitBy: string;
    private g: any;
    private height: number;
    private legendObject: Legend;
    private measures: Array<string>;
    private pointWrapper: any;
    private rMeasure: string;
    private rScale: any;
    private slider: any;
    private sliderWrapper: any;
    private svgSelection: any;
    private targetElement: any;
    private tooltip: Tooltip;
    private voronoi: any;
    private voronoiDiagram: any;
    private voronoiGroup: any;
    private width: number;
    private xAxis: any;
    private xMeasure: string;
    private xScale: any;
    private yAxis: any;
    private yMeasure: string;
    private yScale: any;
    
    chartComponentData = new ScatterPlotData();

    public chartMargins: any = {        
        top: 40,
        bottom: 48,
        left: 70, 
        right: 60
    };
  
    constructor(renderTarget: Element){
        super(renderTarget);
    }

    ScatterPlot(){}
    public render(data: any, options: any, aggregateExpressionOptions: any, fromSlider: boolean = false) {
        
        this.chartOptions.setOptions(options);
        // If measure options not set, or less than 2, return
        if(this.chartOptions["spMeasures"] == null || (this.chartOptions["spMeasures"] != null && this.chartOptions["spMeasures"].length < 2)){
            let invalidMessage = "spMeasures not correctly specified or has length < 2: " + this.chartOptions["spMeasures"] + 
            "\n\nPlease add the following chartOption: {spMeasures: ['example_x_axis_measure', 'example_y_axis_measure', 'example_radius_measure']} " +
            "where the measures correspond to the data key names."
            console.log(invalidMessage);
            return;
        }

        this.chartMargins.top = (this.chartOptions.legend === 'compact') ? 84 : 52;
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.chartOptions.timestamp, aggregateExpressionOptions);
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
                .attr("height", this.height)

            this.g = this.svgSelection.append("g")
                .classed("tsi-svgGroup", true)

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
                .attr("class", "tsi-focus");
            
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
            window.addEventListener("resize", () => {
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                }
            });

            // Temporal slider
            this.slider = new Slider(<any>d3.select(this.renderTarget).select('.tsi-sliderWrapper').node());

            // Legend
            this.legendObject = new Legend(this.draw.bind(this), this.renderTarget, this.CONTROLSWIDTH);
        }

        // Draw scatter plot
        this.draw();
        
        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.ellipsisContainer && d3.event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });
    }

    /******** DRAW UPDATE FUNCTION ********/   
    private draw(){
        this.chartComponentData.updateTemporalDataArray(this.chartOptions.isTemporal);
        
        // Update extents to fit data if not temporal
        this.chartComponentData.updateExtents(this.chartOptions.spMeasures);

        this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")

        // Determine the number of timestamps present, add margin for slider
        if(this.chartComponentData.allTimestampsArray.length > 1 && this.chartOptions.isTemporal){
            this.chartMargins.bottom = 88;
        }
        else{
            this.chartMargins.bottom = 48;
        }
           
        this.setWidthAndHeight();
        this.svgSelection
            .attr("height", this.height)
            .attr("width", this.width);

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
            this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 24), 0) + 'px');
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

        // Pad extents
        let xOffset = (20 / this.chartWidth) * (this.chartComponentData.extents[this.xMeasure][1] - this.chartComponentData.extents[this.xMeasure][0]);
        let yOffset = (20 / this.chartHeight) * (this.chartComponentData.extents[this.yMeasure][1] - this.chartComponentData.extents[this.yMeasure][0]);

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
            .domain(this.rMeasure === null ? [0, 0] : [this.chartComponentData.extents[this.rMeasure][0],this.chartComponentData.extents[this.rMeasure][1]]);
        
        // Draw axis
        this.drawAxis();

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
            .interrupt()
            .transition()
            .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
            .ease(d3.easeExp)
            .attr("r", (d) => this.rScale(d.measures[this.rMeasure]))
            .attr("cx", (d) => this.xScale(d.measures[this.xMeasure]))
            .attr("cy", (d) => this.yScale(d.measures[this.yMeasure]))
            .attr("fill", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke-opacity", 1)
            .attr("fill-opacity", .6)
            .attr("stroke-width", "1px")

        scatter.exit().remove();
        
        // Draw voronoi
        this.drawVoronoi();

        // Resize controls
        if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
            let controlPanelWidth = Utils.getControlPanelWidth(this.renderTarget, this.CONTROLSWIDTH, this.chartOptions.legend === 'shown');
            this.chartControlsPanel.style("width", controlPanelWidth + "px");
        }

        /******************** Temporal Slider ************************/
        if(this.chartComponentData.allTimestampsArray.length > 1 && this.chartOptions.isTemporal){
            d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', false);
            this.slider.render(this.chartComponentData.allTimestampsArray.map(ts => {
                var action = () => {
                    this.chartOptions.timestamp = ts;
                    this.render(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions, true);
                }
                return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, this.chartOptions.offset, this.chartOptions.is24HourTime)(new Date(ts)), action: action};
            }), this.chartOptions, this.width - 10,  Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, this.chartOptions.offset, this.chartOptions.is24HourTime)(new Date(this.chartComponentData.timestamp)));
        }
        else{
            if(this.slider)
                this.slider.remove();
            d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', true);
        }

        // Draw Legend
        this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, this.labelMouseOver.bind(this), 
            this.svgSelection, this.chartOptions, this.labelMouseOut.bind(this), this.stickySeries);

        this.sliderWrapper
            .style("width", `${this.svgSelection.node().getBoundingClientRect().width + 10}px`);
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
        
        this.voronoi = d3.voronoi()
            .x((d:any) => this.xScale(d.measures[this.xMeasure]))
            .y((d:any) => this.yScale(d.measures[this.yMeasure]))
            .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

        this.voronoiDiagram = this.voronoi(voronoiData);

        this.voronoiGroup
            .on("mousemove", function(){
                let mouseEvent = d3.mouse(this);
                self.voronoiMouseMove(mouseEvent);
            })
            .on("mouseover", function(){
                let mouseEvent = d3.mouse(this);
                self.voronoiMouseMove(mouseEvent);
                let site = self.voronoiDiagram.find(mouseEvent[0],  mouseEvent[1]);
                if(site != null)
                    self.labelMouseOver(site.data.aggregateKey, site.data.splitBy);
            })
            .on("mouseout", function(){
                self.voronoiMouseOut();
            }) 
            .on("click", function(){
                let mouseEvent = d3.mouse(this);
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
        if(this.activeDot != null){
        this.activeDot
                .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
                .attr("stroke-width", "1px")
        }
        this.activeDot = null;
    }

    /******** EFFICIENTLY SWAP NEW FOCUSED GROUP WITH OLD FOCUSED GROUP ********/   
    private labelMouseMove(aggKey: string, splitBy: string){
        if (aggKey !== this.focusedAggKey || splitBy !== this.focusedSplitBy) {
            let selectedFilter = this.createValueFilter(aggKey, splitBy);
            let oldFilter = this.createValueFilter(this.focusedAggKey, this.focusedSplitBy);

            this.svgSelection.selectAll(".tsi-dot")
                .filter(selectedFilter)
                .attr("stroke-opacity", 1)
                .attr("fill-opacity", 1)
            
            this.svgSelection.selectAll(".tsi-dot")
                .filter(oldFilter)
                .attr("stroke-opacity", .3)
                .attr("fill-opacity", .15)

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

    /******** HELPER TO CREATE SELECTION FILTER BASED ON AGGKEY AND SPLITBY ********/
    private createValueFilter (aggregateKey, splitBy) {
        return (d: any, j: number ) => {
            var currAggKey: string;
            var currSplitBy: string;
            if (d.aggregateKey) {
                currAggKey = d.aggregateKey;
                currSplitBy = d.splitBy;
            } else  if (d && d.length){
                currAggKey = d[0].aggregateKey;
                currSplitBy = d[0].splitBy
            } else 
                return true;
            return (currAggKey == aggregateKey && (splitBy == null || splitBy == currSplitBy));
        }     
    }

    /******** DRAW CROSSHAIRS, TOOLTIP, AND LEGEND FOCUS ********/
    private voronoiMouseMove(mouseEvent: any){
        let mouse_x = mouseEvent[0];
        let mouse_y = mouseEvent[1];
        let site = this.voronoiDiagram.find(mouse_x, mouse_y);
        if(site == null) return;

        // Return if focused data point has not changed
        if(site.data.aggregateKey == this.focusedAggKey && site.data.splitBy == this.focusedSplitBy) return;
           
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
            if(d.aggregateKey) currAggKey = d.aggregateKey
            if(d.splitBy) currSplitBy = d.splitBy

            if(splitBy == null)
                return currAggKey == aggKey;

            if(currAggKey == aggKey && currSplitBy == splitBy)
                return false;
            return true;
        }

        //Highlight active group
        this.svgSelection.selectAll(".tsi-dot")
            .filter((d: any) => !selectedFilter(d))
            .attr("stroke-opacity", 1)
            .attr("fill-opacity", 1)
        
        // Decrease opacity of unselected
        this.svgSelection.selectAll(".tsi-dot")
            .filter(selectedFilter)
            .attr("stroke-opacity", .3)
            .attr("fill-opacity", .15)
    }

    /******** UNHIGHLIGHT FOCUSED GROUP ********/
    private labelMouseOut(){
         // Remove highlight on legend group
         <any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);

        this.g.selectAll(".tsi-dot")
            .interrupt()
            .attr("stroke-opacity", 1)
            .attr("fill-opacity", .6)
            .attr("stroke", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("fill", (d) => Utils.colorSplitBy(this.chartComponentData.displayState, d.splitByI, d.aggregateKey, this.chartOptions.keepSplitByColor))
            .attr("stroke-width", "1px");
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
    private setWidthAndHeight(){
        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH) - this.controlsOffset;
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        this.chartWidth = this.width - this.chartMargins.left  - this.chartMargins.right;
        this.chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
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
            .call(d3.axisBottom(this.xScale));
        
        this.xAxis.exit().remove();

        // Draw dynamic y axis and label
        this.yAxis = this.pointWrapper.selectAll(".yAxis").data([this.yScale]);
        this.yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(this.yAxis)
            .call(d3.axisLeft(this.yScale));
            
        this.yAxis.exit().remove()
    }

    /******** DRAW TOOLTIP IF ENABLED ********/
    private drawTooltip (d: any, mousePosition) {
        let self = this;
        if (this.chartOptions.tooltip){
            let xPos = mousePosition[0];
            let yPos = mousePosition[1];

            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, yPos, this.chartMargins, (text) => {
                text.append("div")
                    .attr("class", "title")
                    .text(self.chartComponentData.displayState[d.aggregateKey].name);  
                text.append("div")
                    .attr("class", "value")
                    .text(d.splitBy);

                // Display datetime if scatter plot is not temporal
                if(!this.chartOptions.isTemporal){
                    text.append("div")
                        .attr("class", "value")
                        .text(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis(), this.chartOptions.offset, this.chartOptions.is24HourTime)(new Date(d.timestamp)));
                }

                let valueGroup = text.append('div').classed('valueGroup', true);
                Object.keys(d.measures).forEach((measureType) => {
                    if(measureType in this.chartComponentData.extents){
                        valueGroup.append("div")
                        .attr("class",  "value")
                        .text(measureType + ": " + Utils.formatYAxisNumber(d.measures[measureType]));
                    }
                });
            });
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

export {ScatterPlot}

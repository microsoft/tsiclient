import * as d3 from 'd3';
import './ScatterPlot.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {ContextMenu} from './../ContextMenu/ContextMenu';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { Slider } from '../Slider/Slider';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';
import { ChartDataOptions } from '../../Models/ChartDataOptions';

class ScatterPlot extends ChartComponent {
    private svgSelection: any;
    private measures: any;
    private extents: any = {}
    private width: number;
    private height: number;
    public draw: any;
    


    chartComponentData = new ChartComponentData();

    public chartMargins: any = {        
        top: 40,
        bottom: 50,
        left: 70, 
        right: 60
    };
    
    constructor(renderTarget: Element){
        super(renderTarget);
    }

    ScatterPlot(){}
    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.chartOptions.setOptions(options);
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.chartOptions.timestamp, aggregateExpressionOptions);
        let timestamp = (options && options.timestamp != undefined) ? options.timestamp : this.chartComponentData.allTimestampsArray[0];

        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        if (this.svgSelection == null) {  
            let targetElement = d3.select(this.renderTarget)
                .classed("tsi-scatterPlot", true);

            this.svgSelection = targetElement.append("svg")
                .attr("class", "tsi-scatterPlotSVG tsi-chartSVG")
                .attr("height", this.height)
                .attr("width", this.width);

            let g = this.svgSelection.append("g")
                .classed("svgGroup", true)
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
            
            let tooltip = new Tooltip(d3.select(this.renderTarget));

            this.draw = () => {

                let chartWidth = this.width - this.chartMargins.left  - this.chartMargins.right;
                let chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
                g
                .attr("width", chartWidth)
                .attr("height", chartHeight)
                
                super.themify(targetElement, this.chartOptions.theme);

                this.measures = Object.keys(this.chartComponentData.allValues[0].measures);
                
                this.measures.forEach(measure => {
                    this.extents[measure] = d3.extent(this.chartComponentData.allValues, (v:any) => measure in v.measures ? v.measures[measure] : null );
                })

                let yMeasure = this.measures[0], xMeasure = this.measures[1];

                 // Print data to test
                 console.log('Chart Data', this.chartComponentData, 
                    '\nChart Options', this.chartOptions, 
                    '\nChart aggregateExpressionOptions', this.aggregateExpressionOptions,
                    '\nExtents', this.extents);

                //Init Scales
                let yScale = d3.scaleLinear()
                    .range([chartHeight, 0])
                    .domain([this.extents[yMeasure][0],this.extents[yMeasure][1]])

                let xScale = d3.scaleLinear()
                    .range([0, chartWidth])
                    .domain([this.extents[xMeasure][0],this.extents[xMeasure][1]])

                //Init Axis
                let xAxis = d3.axisBottom(xScale);
                let yAxis = d3.axisLeft(yScale);

                g.append("g")
                    .attr("class", "x axis")
                    .attr("transform", "translate(0," + (chartHeight) + ")")
                    .call(xAxis)

                g.append("g")
                    .attr("class", "y axis")                    
                    .call(yAxis)

            }

            // Add Window Resize Listener -- not working
            window.addEventListener("resize", () => {
                var self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                }
            });
            this.draw();
        }                               
    }

    private getYExtent(vals){
        
    }

}

export {ScatterPlot}

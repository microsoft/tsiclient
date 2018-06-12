import {Utils} from "./../Utils";
import {Component} from "./Component";
import * as d3 from 'd3';
import { ChartOptions } from "../Models/ChartOptions";

class TimelineComponent extends Component {
	readonly TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;
	readonly MINWIDTH = 20;		

	protected targetElement: any;
	protected g: any;
	protected tooltip: any;
	protected xAxis: any;
	protected xScale: any;

	protected width: number;
	protected margins: any;
	protected chartOptions: ChartOptions;
	
	constructor(renderTarget: Element){
		super(renderTarget);
    }
    
    protected orderData (data: any): any {
        return data.sort((a, b) => {
			if ((new Date(Object.keys(a)[0])) < (new Date(Object.keys(b)[0])))
				return -1;
			return 1;
		});
	}
	
	protected formatData (data: any): any {
		data = this.orderData(data);
		return data.map(eventData => {
			var time = Object.keys(eventData)[0];
			return {
				"time" : time,
				"color" : eventData[time].color,
				"description" : eventData[time].description
			};
		});
	}

	protected createElements (options) {
		var chartOptions = new ChartOptions(options);
		var margins = {
			left: (chartOptions.xAxisHidden == true) ? 10 : 40,
			right: (chartOptions.xAxisHidden == true) ? 10 : 40
		}
		if(this.targetElement == null){
			this.targetElement = d3.select(this.renderTarget);	
			this.targetElement.html("");	
			if(this.targetElement.style("position") == "static")
				this.targetElement.style("position", "relative");
			
			this.targetElement.classed("tsi-eventSeries", true);
			var height = (chartOptions.xAxisHidden == true) ? 10 : 40;
			var width: number = Math.max((this.targetElement.node()).clientWidth, this.MINWIDTH);
			var svg = this.targetElement.append("svg")
				.attr("width", width)
				.attr("height", height);
			this.g = svg.append('g').attr("transform", 'translate(' + margins.left + ', 0)');
	
			this.tooltip =  this.g.append("g")
				.classed("tooltip", true)
				.attr("display", "none")
				.attr("transform", "translate(0,0)")
			
			this.tooltip.append("rect").attr("x", 0).attr("y", 0).attr("width", 20).attr("height", 20)
			this.tooltip.append("text").text("").attr("text-anchor", "start").attr("x", 0).attr("y", 0);
			
			this.xAxis = this.g.append("g")
					.attr("class", "xAxis")
					.attr("transform", "translate(0,10)")
        }
	}

	protected elementMouseover = (d, i, timeFormatFunction) => {
		var selectedTime = new Date(d.time);
		var xPos = this.xScale(selectedTime);
		
		var tooltipText = this.tooltip.select("text").html('');
		tooltipText.append('tspan')
			.text(timeFormatFunction(d, i))
			.classed('title', true)
			.attr("y", 17)
			.attr("x", 5)
			.attr("text-anchor", "start");
		tooltipText.append('tspan')
			.text(d.description)
			.classed('value', true)
			.attr("y", 38)
			.attr("x", 5)
			.attr("text-anchor", "start");
		
		this.tooltip.attr("transform", "translate(" + xPos + ",0)")
			.attr("display", "block");

		var textElemDimensions = (<any>this.tooltip.select('text').node())
			.getBoundingClientRect();
		
		var newXTranslate = xPos;
		// check to see if tooltipG is too far right
		var diffWithRight = xPos + (textElemDimensions.width) - (this.width - (this.margins.left + 3));
		if (diffWithRight > 0) {
			newXTranslate = xPos - diffWithRight;
		}

		this.tooltip.attr("transform", "translate(" + newXTranslate + "," + (-8 - textElemDimensions.height ) +")");

		this.tooltip.select("rect")
			.attr("height", textElemDimensions.height + 5)
			.attr("y", 0)
			.attr("x",  0)
			.attr("width",  (textElemDimensions.width + 10));
	}
}
export {TimelineComponent}

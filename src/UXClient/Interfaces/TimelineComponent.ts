import {Component} from "./Component";
import * as d3 from 'd3';
import { ChartOptions } from "../Models/ChartOptions";

class TimelineComponent extends Component {
	readonly TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;
	readonly MINWIDTH = 20;		

	protected targetElement: any;
	protected g: any;
	protected xAxis: any;
	protected xScale: any;

	protected width: number;
	protected margins: any;

	protected svgPaddingLeft;
	protected svgPaddingRight;
	
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
	protected cursorStyle (d) {
		return (d.onClick === null) ? 'inherit' : 'pointer';
	}
	
	protected formatData (data: any): any {
		data = this.orderData(data);
		return data.map(eventData => {
			var time = Object.keys(eventData)[0];
			return {
				"time" : time,
				"color" : eventData[time].color,
				"description" : eventData[time].description,
				'onClick': eventData[time].onClick ? eventData[time].onClick : null
			};
		});
	}

	protected createElements (options) {
		var chartOptions = new ChartOptions();
		chartOptions.setOptions(options);
		var margins = {
			left: (chartOptions.xAxisHidden == true) ? 8 : 40,
			right: (chartOptions.xAxisHidden == true) ? 10 : 40
		};

		this.svgPaddingLeft = (this.chartOptions.xAxisHidden === true) ? 10 : 40;
		this.svgPaddingRight = (this.chartOptions.xAxisHidden === true) ? 14 : 40;

		if(this.targetElement == null){
			this.targetElement = d3.select(this.renderTarget);	
			this.targetElement.html("");	
			if(this.targetElement.style("position") == "static")
				this.targetElement.style("position", "relative");
			
			this.targetElement.classed("tsi-eventSeries", true);
			var height = (chartOptions.xAxisHidden == true) ? 10 : 40;
			var svg = this.targetElement.append("svg")
				.attr("height", height)
				.attr("class", "tsi-chartSVG");
			this.g = svg.append('g').attr("transform", 'translate(' + margins.left + ', 0)');
	
			this.xAxis = this.g.append("g")
					.attr("class", "xAxis")
					.attr("transform", "translate(0,10)");
		}
		var width: number = Math.max((this.targetElement.node()).clientWidth, this.MINWIDTH);
		this.targetElement.select('svg').attr('width', width);
	}
}
export {TimelineComponent}

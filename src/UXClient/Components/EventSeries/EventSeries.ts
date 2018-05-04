import * as d3 from 'd3';
import './EventSeries.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { TimelineComponent } from '../../Interfaces/TimelineComponent';

const MINWIDTH = 20;
const TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;

class EventSeries extends TimelineComponent{

	constructor(renderTarget: Element){
		super(renderTarget);
	}

	EventSeries() {
	}
	
	public render(namedData: Array<any>, options: any = {}){
		this.margins = {
			left: (options.xAxis == "hidden") ? 10 : 40,
			right: (options.xAxis == "hidden") ? 10 : 40
		}
		this.createElements(options);
		var seriesName = Object.keys(namedData)[0];
		var data = namedData[seriesName];
		data = this.formatData(data);

		this.width  = Math.max((this.targetElement.node()).clientWidth, MINWIDTH);

		var seriesWidth: number = this.width - this.margins.left - this.margins.right;
		var fromTime = (options.timeFrame != undefined && options.timeFrame.from != undefined) ? 
						options.timeFrame.from : data[0].time;
		var toTime = (options.timeFrame != undefined && options.timeFrame.to != undefined) ? 
					options.timeFrame.to : data[data.length - 1].time;
		this.xScale = !(this.xScale) ? d3.scaleTime().domain([fromTime, toTime]).range([0, seriesWidth]) : this.xScale;

		var rectGs = this.g.selectAll("g.tsi-eventRectG").data(data, d => d.time + d.color + d.description);		
		var enteredRectGs = rectGs.enter().append("g")
			.classed("tsi-eventRectG", true)
			.attr("transform", d => "translate(" + this.xScale(new Date(d.time)) + ",0)")
			.attr("display", d => (this.xScale(new Date(d.time)) < 0 || this.xScale(new Date(d.time)) > this.width) ? "none" : "block");
		enteredRectGs
			.html("")
			.append("rect")
			.classed('tsi-eventRect', true)
			.attr("width", 7)
			.attr("height", 7)
			.attr("fill", d => d.color)
			.attr("transform", "rotate(45)");
				
		this.xScale = d3.scaleTime().domain([fromTime, toTime]).range([0, seriesWidth]);
		enteredRectGs = enteredRectGs.merge(rectGs);
		enteredRectGs
			.transition()
			.duration(TRANSDURATION)
				.attr("transform", d => "translate(" + this.xScale(new Date(d.time)) + ",0)")
				.attr("display", d => (this.xScale(new Date(d.time)) < 0 || this.xScale(new Date(d.time)) > this.width) ? "none" : "block")
		var rects = enteredRectGs.select("rect");
		rects.on("mouseover", (dRect, iRect) => this.elementMouseover(dRect, iRect, (d, i) => { 
			return Utils.timeFormat(this.usesSeconds, this.usesMillis)(new Date(d.time));
		}))
			.on("mouseout", () => {
				this.tooltip.attr("display", "none");
			});
				
		rectGs.exit().remove();
		super.themify(this.targetElement, options.theme);

		if (options.xAxis != "hidden") {
			this.xAxis.style('display', 'block')
			this.xAxis.transition()
				.duration(TRANSDURATION)
				.call(d3.axisBottom(this.xScale).tickFormat(Utils.timeFormat(this.usesSeconds, this.usesMillis)))
				.tween("", () => {
					return () => {
						this.g.selectAll('.xAxis').selectAll('text').call(Utils.splitTimeLabel);
					}
				});
		}
		else
			this.xAxis.style('display', 'none');
	}
}
export {EventSeries}
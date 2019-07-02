import * as d3 from 'd3';
import './EventSeries.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { TimelineComponent } from '../../Interfaces/TimelineComponent';
import { ChartOptions } from '../../Models/ChartOptions';
import { Tooltip } from '../Tooltip/Tooltip';

const MINWIDTH = 20;
const TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;

class EventSeries extends TimelineComponent{

	constructor(renderTarget: Element){
		super(renderTarget);
	}

	EventSeries() {
	}
	
	public render(namedData: Array<any>, options: any = {}){
		this.chartOptions.setOptions(options);
		this.margins = {
			left: (this.chartOptions.xAxisHidden === true) ? 10 : 40,
			right: (this.chartOptions.xAxisHidden === true) ? 10 : 40
		}
		this.createElements(this.chartOptions);
		var tooltip = new Tooltip(d3.select(this.renderTarget));
		var seriesName = Object.keys(namedData)[0];
		var data = namedData[seriesName];
		data = this.formatData(data);

		this.width  = Math.max((this.targetElement.node()).clientWidth, MINWIDTH);

		var seriesWidth: number = this.width - this.margins.left - this.margins.right;
		var fromTime = (this.chartOptions.timeFrame != undefined && this.chartOptions.timeFrame.from != undefined) ? 
						this.chartOptions.timeFrame.from : data[0].time;
		var toTime = (this.chartOptions.timeFrame != undefined && this.chartOptions.timeFrame.to != undefined) ? 
					this.chartOptions.timeFrame.to : data[data.length - 1].time;
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
		var self = this;
		rects.on("mouseover", function (dRect, iRect) { 
			self.elementMouseover(dRect, iRect, (d, i) => { 
				return Utils.timeFormat(this.usesSeconds, this.usesMillis, self.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(new Date(d.time));
			});
			var mousePos = d3.mouse(<any>self.g.node());
			tooltip.render(self.chartOptions.theme);
			tooltip.draw (dRect, {}, mousePos[0], mousePos[1], {top: 0, bottom: 0, left: 0, right: 0}, (text) => {
				text.text(null);
				text.append('div')
					.text(Utils.timeFormat(self.usesSeconds, self.usesMillis, self.chartOptions.offset, true, null, null, this.chartOptions.dateLocale)(new Date(dRect.time)))
					.classed('title', true);
				text.append('div')
					.text(dRect.description)
					.classed('value', true);
			});
		}).on("mouseout", () => {
			tooltip.hide();
		});
				
		rectGs.exit().remove();
		super.themify(this.targetElement, this.chartOptions.theme);

		if (this.chartOptions.xAxisHidden !== true) {
			this.xAxis.style('display', 'block')
			this.xAxis.transition()
				.duration(TRANSDURATION)
				.call(d3.axisBottom(this.xScale).tickFormat(Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)))
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
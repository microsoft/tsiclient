import * as d3 from 'd3';
import './StateSeries.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { TimelineComponent } from '../../Interfaces/TimelineComponent';
import { ChartOptions } from '../../Models/ChartOptions';
import { Tooltip } from '../Tooltip/Tooltip';


class StateSeries extends TimelineComponent { 

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
		this.createElements(this.chartOptions.toObject());
		var tooltip = new Tooltip(d3.select(this.renderTarget));
		var seriesName = Object.keys(namedData)[0];
		var data = namedData[seriesName];
		data = this.formatData(data);

		this.width  = Math.max((this.targetElement.node()).clientWidth, this.MINWIDTH);

		var seriesWidth: number = this.width - this.margins.left - this.margins.right;
		var fromTime = this.chartOptions.timeFrame.from;
		var toTime = this.chartOptions.timeFrame.to;
		this.xScale = !(this.xScale) ? d3.scaleTime().domain([fromTime, toTime]).range([0, seriesWidth]) : this.xScale;

        var rects = this.g.selectAll("rect.tsi-stateRects").data(data, d => d.time + d.color + d.description);
        var getWidth = (d, i) => {
            var xPos1 = Math.max(Math.min(this.xScale(new Date(d.time)), seriesWidth), 0);
            var xPos2;
            if (i + 1 < data.length) {
                xPos2 = Math.max(Math.min(this.xScale(new Date(data[i+1].time)), seriesWidth), 0); 
            } else {
                xPos2 = seriesWidth;
            }
            return xPos2 - xPos1;
        }	
		var enteredRects = rects.enter().append("rect")
			.classed("tsi-stateRects", true)
			.attr("display", d => (this.xScale(new Date(d.time)) < 0 || this.xScale(new Date(d.time)) > this.width) ? "none" : "block")
            .attr("x", d => this.xScale(new Date(d.time)))
            .attr("y", 0)
			.attr("height", 10)
			.attr("fill", d => d.color)
			.on('click', d => {
				d.onClick();
			});
        this.xScale = d3.scaleTime().domain([fromTime, toTime]).range([0, seriesWidth]);
		enteredRects = enteredRects.merge(rects);
		enteredRects
			.transition()
            .duration(this.TRANSDURATION)
                .attr("x", d => this.xScale(new Date(d.time)))
                .attr("width", getWidth)
				.attr("display", d => (this.xScale(new Date(d.time)) < 0 || this.xScale(new Date(d.time)) > this.width) ? "none" : "block")
		
		var timeFormat = (d, i) => { 
			var startTime = new Date(d.time);
			var endTime = (i + 1 < data.length) ? (new Date(data[i+1].time)) : (new Date(toTime));
			return Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(startTime) + " - " + 
				   Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(endTime);
		}

		var self = this;
		enteredRects.on("mousemove", function (dRect, iRect) { 
			self.elementMouseover(dRect, iRect, (d, i) => { 
				return Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(new Date(d.time));
			});
			var mousePos = d3.mouse(<any>self.g.node());
			tooltip.render(self.chartOptions.theme);
			tooltip.draw (dRect, {}, mousePos[0], mousePos[1], {top: 0, bottom: 0, left: 0, right: 0}, (text) => {
				text.text(null);
				text.append('div')
					.text(timeFormat(dRect, iRect))
					.classed('title', true);
				text.append('div')
					.text(dRect.description)
					.classed('value', true);
			});
		}).on("mouseout", () => {
			tooltip.hide();
		});
		rects.exit().remove();
		super.themify(this.targetElement, this.chartOptions.theme);

		if (this.chartOptions.xAxisHidden != true) {
			this.xAxis.style('display', 'block')
			this.xAxis.transition()
				.duration(this.TRANSDURATION)
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
export {StateSeries}
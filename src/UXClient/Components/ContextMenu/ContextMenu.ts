import * as d3 from 'd3';
import './ContextMenu.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";

class ContextMenu extends Component {
    public drawChart: any;
    public contextMenuElement: any;
    public actions: any;
    public contextMenuVisible: boolean = false;
    public startTime;
    public endTime;

	constructor(drawChart: any, renderTarget: Element) {
        super(renderTarget);
        this.drawChart = drawChart;
        this.contextMenuElement = d3.select(renderTarget).insert("div", ":first-child")
                                .attr("class", "tsi-contextMenu")
                                .style("left", "0px")
                                .style("top", "0px");
    }

	public draw(chartComponentData, renderTarget, options, mousePosition, aggKey, splitBy, onClick = null, startTime = null, endTime = null, event = null) {
        this.contextMenuVisible = true;

        if (!endTime) {
            this.actions = chartComponentData.displayState[aggKey].contextMenuActions;
            var ae = chartComponentData.displayState[aggKey].aggregateExpression;
        } else {
            this.actions = options.brushContextMenuActions;
        }

        this.startTime = startTime;
        this.endTime = endTime;
        d3.select(this.renderTarget).on("click", () => {
            this.hide();
            if (onClick)
                onClick();
        });

        super.themify(this.contextMenuElement, options.theme);
        this.contextMenuElement.style("display", "block");
        var actionElements = this.contextMenuElement.selectAll(".tsi-actionElement")
            .data(this.actions);
        var actionElementsEntered = actionElements.enter()
            .append("div")
            .attr("class", "tsi-actionElement")
            .merge(actionElements)
            .html(d => d.name)
            .on("click", (d) => {
                if (this.endTime) { // if endTime is present, this is a brush action
                    var startTime = this.startTime ?  this.startTime.toISOString().slice(0,-5)+"Z" : null;
                    var endTime = this.endTime ?  this.endTime.toISOString().slice(0,-5)+"Z" : null;
                    d.action(startTime, endTime);
                } else {
                    var timestamp = this.startTime ?  this.startTime.toISOString().slice(0,-5)+"Z" : null;
                    d.action(ae, splitBy, timestamp, event);
                }
            });

        var left = mousePosition[0];
        var contextMenuWidth = this.contextMenuElement.node().getBoundingClientRect().width; 
        var renderTargetWidth = this.renderTarget.getBoundingClientRect().width;
        var right = contextMenuWidth + mousePosition[0];
        if (right > renderTargetWidth) {
            left = renderTargetWidth - contextMenuWidth;
        }

        var top = mousePosition[1];
        var contextMenuHeight = this.contextMenuElement.node().getBoundingClientRect().height; 
        var renderTargetHeight = this.renderTarget.getBoundingClientRect().height;
        var bottom = contextMenuHeight + mousePosition[1];
        if (bottom > renderTargetHeight) {
            top = renderTargetHeight - contextMenuHeight;
        }

        this.contextMenuElement
            .style('left', left + 'px')
            .style('top', top + 'px');

        actionElements.exit().remove();
    }
    public hide () {
        this.contextMenuElement.style("display", "none");
        this.contextMenuVisible = false;
    }
}

export {ContextMenu}
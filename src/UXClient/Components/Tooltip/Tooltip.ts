import * as d3 from 'd3';
import './Tooltip.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponentData } from '../../Models/ChartComponentData';

class Tooltip extends Component {

    public renderTarget;
    private tooltipDiv;
    private tooltipText;
    public draw;

	constructor(renderTarget) {
        super(renderTarget);
    }

    public hide () {
        if (this.tooltipDiv) {
            this.tooltipDiv.style("display", "none");
        }
    }

    private getLeftOffset (chartMargins) {
        //NOTE - this assumes that the svg's right border is the same as the render target's
        var renderTargetWidth = this.renderTarget.node().getBoundingClientRect().width;
        var svgWidth = this.renderTarget.select('.tsi-chartSVG').node().getBoundingClientRect().width;
        return (renderTargetWidth - svgWidth + chartMargins.left);
    }

    private getTopOffset(chartMargins) {
        //NOTE - this assumes that the svg's bottom border is the same as the render target's
        var renderTargetHeight = this.renderTarget.node().getBoundingClientRect().height;
        var svgHeight = this.renderTarget.select('.tsi-chartSVG').node().getBoundingClientRect().height;
        return (renderTargetHeight - svgHeight + chartMargins.top);
    }

    private isRightOffset (tooltipWidth, xPos, chartMarginLeft) {
        //NOTE - this assumes that the svg's right border is the same as the render target's
        var renderTargetWidth = this.renderTarget.node().getBoundingClientRect().width;
        var svgWidth = this.renderTarget.select('.tsi-chartSVG').node().getBoundingClientRect().width;
        return svgWidth > (xPos + tooltipWidth + 20 + chartMarginLeft);
    }

    private isTopOffset (tooltipHeight, yPos, chartMarginBottom) {
        //NOTE - this assumes that the svg's right border is the same as the render target's
        var renderTargetHeight = this.renderTarget.node().getBoundingClientRect().height;
        return renderTargetHeight > (yPos + tooltipHeight + 20 + chartMarginBottom);
    }

    public render(theme) {
        this.renderTarget.selectAll(".tsi-tooltip").remove();

        this.tooltipDiv = this.renderTarget.append("div")
            .attr("class", "tsi-tooltip");
        this.tooltipDiv.text(d => d);

        super.themify(this.tooltipDiv, theme);

        this.draw = (d: any, chartComponentData: ChartComponentData, xPos, yPos, chartMargins, addText) => {
            this.tooltipDiv.style("display", "block")
                .text(null);

            var leftOffset = this.getLeftOffset(chartMargins);
            var topOffset = this.getTopOffset(chartMargins)
            addText(this.tooltipDiv);

            this.tooltipDiv.style("left", Math.round(xPos + leftOffset) + "px")
                .style("top", Math.round(yPos) + topOffset + "px");
        
            var tooltipWidth = this.tooltipDiv.node().getBoundingClientRect().width;
            var tooltipHeight = this.tooltipDiv.node().getBoundingClientRect().height;
            var translateX = this.isRightOffset(tooltipWidth, xPos, chartMargins.left) ? 20 : (-Math.round(tooltipWidth) - 20); 
            var translateY = this.isTopOffset(tooltipHeight, yPos, chartMargins.bottom) ? 20 :  (-Math.round(tooltipHeight) - 20);
            this.tooltipDiv.style("transform", "translate(" + translateX + "px," + translateY + "px)");

        }
    }

}

export {Tooltip}
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
    private borderColor;

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
        //NOTE - this assumes that the svg's bottom border is the same as the render target's
        var renderTargetHeight = this.renderTarget.node().getBoundingClientRect().height;
        return renderTargetHeight > (yPos + tooltipHeight + 20 + chartMarginBottom);
    }

    public render(theme) {
        this.renderTarget.selectAll(".tsi-tooltip").remove();

        this.tooltipDiv = this.renderTarget.append("div")
            .attr("class", "tsi-tooltip");
        this.tooltipDiv.text(d => d);

        super.themify(this.tooltipDiv, theme);
        
        //  element width is an optional parameter which ensurea that the tooltip doesn't interfere with the element
        //when positioning to the right
        this.draw = (d: any, chartComponentData: ChartComponentData, xPos, yPos, chartMargins, addText, elementWidth: number = null, xOffset = 20, yOffset = 20, borderColor: string = null) => {
            this.tooltipDiv.style("display", "block")
                .text(null);

            this.borderColor = borderColor;

            var leftOffset = this.getLeftOffset(chartMargins);
            var topOffset = this.getTopOffset(chartMargins)
            addText(this.tooltipDiv);

            this.tooltipDiv.style("left", Math.round(xPos + leftOffset) + "px")
                .style("top", Math.round(yPos) + topOffset + "px");
        
            var tooltipWidth = this.tooltipDiv.node().getBoundingClientRect().width;
            var tooltipHeight = this.tooltipDiv.node().getBoundingClientRect().height;
            var translateX = this.isRightOffset(tooltipWidth, xPos, chartMargins.left) ? xOffset : 
                (-Math.round(tooltipWidth) - xOffset - (elementWidth !== null ? elementWidth : 0));             
            translateX = Math.max(0 - xPos, translateX);
            var translateY = this.isTopOffset(tooltipHeight, yPos, chartMargins.bottom) ? yOffset :  (-Math.round(tooltipHeight) - yOffset);
            this.tooltipDiv.style("transform", "translate(" + translateX + "px," + translateY + "px)");
            if (this.borderColor) {
                this.tooltipDiv.style('border-left-color', this.borderColor)
                    .style('border-left-width', '5px');
            } else {
                this.tooltipDiv.style('border-left-width', '1px');
            }
        }
    }

}

export {Tooltip}
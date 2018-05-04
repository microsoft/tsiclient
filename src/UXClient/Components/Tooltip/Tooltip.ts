import * as d3 from 'd3';
import './Tooltip.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponentData } from '../../Models/ChartComponentData';

class Tooltip extends Component {

    public renderTarget;
    private tooltipG;
    private tooltipBox;
    private tooltipText;
    public draw;

	constructor(renderTarget) {
        super(renderTarget);
    }

    public hide () {
        if (this.tooltipG) {
            this.tooltipG.style("display", "none");
        }
    }

    public render(theme) {
        if (this.renderTarget.selectAll(".tsi-tooltip").empty()) {
            this.tooltipG = this.renderTarget.append("g")
                .attr("class", "tsi-tooltip")
                .attr("transform", "translate(20,20)");
            this.tooltipBox = this.tooltipG.append("rect")            
                .attr("x", 0)
                .attr("y", 1)
                .attr("width", 0)
                .attr("height", 0);
            this.tooltipText = this.tooltipG.append("text")
                .attr("x", 0)
                .attr("y", 10)
                .attr("alignment-baseline", "hanging")
                .text(d => d);
        }

        super.themify(this.tooltipG, theme);

        this.draw = (d: any, chartComponentData: ChartComponentData, xPos, yPos, chartWidth, chartHeight, addText) => {
            this.tooltipG.style("display", "block");
            this.tooltipG.attr("transform", "translate(20,20)");
            this.tooltipText.text(null);
            
            addText(this.tooltipText);

            var tooltipTextDimensions = this.tooltipText.node().getBoundingClientRect();
            this.tooltipBox.attr("x", -10)
                .attr("y", -10)
                .attr("width", tooltipTextDimensions.width + 20)
                .attr("height", tooltipTextDimensions.height + 10);

            // check to see if tooltipG is too low
            var newYTranslate = 20;
            var diffWithBottom = (yPos + 20 + tooltipTextDimensions.height) - chartHeight;
            if (diffWithBottom > 0) {
                var newYTranslate = 20 - diffWithBottom;
            }

            //check to see if tooltipG is too far to the right
            var newXTranslate = 20;
            var diffWithRight = (xPos + 20 + tooltipTextDimensions.width) - chartWidth;
            if (diffWithRight > 0) {
                var newXTranslate = -20 - tooltipTextDimensions.width; 
                if (newXTranslate + xPos < 0) {
                    newXTranslate = 20;
                }
            }
            this.tooltipG.attr("transform", "translate(" + newXTranslate + "," + newYTranslate + ")");
        }
    }

}

export {Tooltip}
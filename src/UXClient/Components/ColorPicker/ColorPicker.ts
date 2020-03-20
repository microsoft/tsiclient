import * as d3 from 'd3';
import { Component } from '../../Interfaces/Component';
import { Utils } from '../../Utils';
import './ColorPicker.scss';
import { KeyCodes } from '../../Constants/Enums';

class ColorPicker extends Component{
    private colorPickerElem;
    private selectedColor;
    private isColorGridVisible;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render (options: any = {}) {
        this.chartOptions.setOptions(options);
        this.selectedColor = this.chartOptions.defaultColor;

        this.colorPickerElem = d3.select(this.renderTarget).classed("tsi-colorPicker", true);
        this.colorPickerElem.text(''); 
        super.themify( this.colorPickerElem, this.chartOptions.theme);

        // color selection button
        let colorPickerButton = this.colorPickerElem.append('button').classed("tsi-colorPickerButton", true)
                    .attr("title", this.getString('Select color'))
                    .attr("aria-label", this.getString('Select color'))
                    .attr("aria-describedby", "tsi-selectedColorValue")
                    .attr("aria-controls", "tsi-colorGrid")
                    .on('click', (e) => {
                        if (this.isColorGridVisible) {
                            this.hideColorGrid(true);
                        } else {
                            this.chartOptions.onClick(e); this.showColorGrid();
                        }
                    });
        if (this.selectedColor) {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).style("background-color", this.selectedColor);
        } else {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).classed("tsi-noColor", true);
        }

        colorPickerButton.append('span').classed("tsi-selectedColorValue", true).classed("hidden", this.chartOptions.isColorValueHidden)
                            .attr("id", "tsi-selectedColorValue")
                            .text(this.selectedColor ? this.selectedColor : this.getString('No color'));

        // color grid
        let colorGridElem =  this.colorPickerElem.append('div').classed("tsi-colorGrid", true).attr("id", "tsi-colorGrid").attr("role", "grid");
        let colorGridRowElem = colorGridElem.append('div').classed("tsi-colorGridRow", true).attr("role", "row");
        this.chartOptions.colors.forEach((c, idx) => {
            let gridItem = colorGridRowElem.append('div').classed("tsi-colorItem", true).classed("tsi-selected", c === this.selectedColor)
                    .attr("tabindex", 0)
                    .attr("role", "gridcell")
                    .attr("aria-label", c)
                    .attr("aria-selected", c === this.selectedColor)
                    .style("background-color", c)
                    .on('click', () => {
                        d3.event.preventDefault();
                        d3.event.stopPropagation();
                        this.chartOptions.onSelect(c); this.hideColorGrid(true); this.setSelectedColor(c, gridItem);
                    })
                    .on('keydown', () => {
                        if (d3.event.keyCode === KeyCodes.Tab && !d3.event.shiftKey && idx === this.chartOptions.colors.length - 1) { // tab
                            d3.event.preventDefault();
                            this.colorPickerElem.selectAll(".tsi-colorItem").nodes()[0].focus();
                        } else if (d3.event.keyCode === KeyCodes.Enter) {
                            d3.event.preventDefault();
                            d3.event.stopPropagation();
                            this.chartOptions.onSelect(c); 
                            this.hideColorGrid(true); 
                            this.setSelectedColor(c, gridItem);
                        } else if (d3.event.keyCode === KeyCodes.Esc) {
                            d3.event.preventDefault();
                            d3.event.stopPropagation();
                            this.hideColorGrid(true);
                        }
                    });
        });

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.colorPickerElem.select(".tsi-colorPickerButton").filter(Utils.equalToEventTarget).empty() && 
                this.colorPickerElem.select(".tsi-colorPickerButton").selectAll("*").filter(Utils.equalToEventTarget).empty() &&
                this.colorPickerElem.selectAll(".tsi-colorGrid").filter(Utils.equalToEventTarget).empty()) {
                    this.hideColorGrid();
            }
        });
    }

    public getSelectedColorValue = () => {
        return this.selectedColor;
    }

    private showColorGrid = () => {
        this.colorPickerElem.select(".tsi-colorGrid").style("display", "flex");
        this.isColorGridVisible = true;
        this.colorPickerElem.selectAll(".tsi-colorItem").nodes()[0].focus();
        this.colorPickerElem.select(".tsi-colorPickerButton").attr("aria-expanded", true);
    }

    public hideColorGrid = (withFocusBackToPickerButton: boolean = false) => {
        this.colorPickerElem.select(".tsi-colorGrid").style("display", "none");
        this.isColorGridVisible = false;
        this.colorPickerElem.select(".tsi-colorPickerButton").attr("aria-expanded", false);
        if (withFocusBackToPickerButton) {
            this.colorPickerElem.select(".tsi-colorPickerButton").node().focus();
        }
    }

    private setSelectedColor = (cStr, gridItem) => {
        this.colorPickerElem.select(".tsi-selectedColor").classed("tsi-noColor", false);
        this.colorPickerElem.select(".tsi-selectedColor").style("background-color", cStr);
        this.colorPickerElem.select(".tsi-selectedColorValue").text(cStr);
        this.colorPickerElem.select(".tsi-colorItem.tsi-selected").classed("tsi-selected", false);
        this.colorPickerElem.select(".tsi-colorItem.tsi-selected").attr("aria-selected", false);
        gridItem.classed("tsi-selected", true);
        gridItem.attr("aria-selected", true);
        this.selectedColor = cStr;
    }
}

export {ColorPicker};
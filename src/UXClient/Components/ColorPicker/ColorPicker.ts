import * as d3 from 'd3';
import { Component } from '../../Interfaces/Component';
import Utils from '../../Utils';
import './ColorPicker.scss';
import { KeyCodes } from '../../Constants/Enums';

interface ColorPickerOptions {
    theme?: string,
    numberOfColors?: number,
    colors?: Array<string>,
    defaultColor?: string,
    isColorValueHidden?: boolean,
    onSelect?: (colorHex: string) => void,
    onClick?: (event: any) => void
};

class ColorPicker extends Component{
    private colorPickerElem: any;
    private selectedColor: string | null;
    private isColorGridVisible: boolean;
    private componentId: string;

    constructor(renderTarget: Element, componentId: string = Utils.guid()){
        super(renderTarget);
        this.componentId = componentId;
    }

    public render (options: ColorPickerOptions = {}) {
        this.chartOptions.setOptions(options);
        this.selectedColor = this.chartOptions.defaultColor;
        if (this.chartOptions.colors.indexOf(this.selectedColor) === -1) {
            this.chartOptions.colors.push(this.selectedColor);
        }

        this.colorPickerElem = d3.select(this.renderTarget).classed("tsi-colorPicker", true);
        this.colorPickerElem.text(''); 
        super.themify( this.colorPickerElem, this.chartOptions.theme);

        // color selection button
        let colorPickerButton = this.colorPickerElem.append('button').classed("tsi-colorPickerButton", true)
            .attr("title", this.getString('Select color'))
            .attr("aria-label", (this.selectedColor ? this.selectedColor : this.getString('No color')) + ' ' + this.getString('Select color'))
            .attr("aria-controls", `tsi-colorGrid_${this.componentId}`)
            .on('click', (event) => {
                if (this.isColorGridVisible) {
                    this.hideColorGrid(true);
                } else {
                    this.chartOptions.onClick(event); this.showColorGrid();
                }
            });
        if (this.selectedColor) {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).style("background-color", this.selectedColor);
        } else {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).classed("tsi-noColor", true);
        }

        colorPickerButton.append('span').classed("tsi-selectedColorValue", true).classed("hidden", this.chartOptions.isColorValueHidden)
            .attr("id", `tsi-selectedColorValue_${this.componentId}`)
            .text(this.selectedColor ? this.selectedColor : this.getString('No color'));

        // color grid
        let colorGridElem =  this.colorPickerElem.append('div').classed("tsi-colorGrid", true).attr("id", `tsi-colorGrid_${this.componentId}`).attr("role", "grid");
        let colorGridRowElem = colorGridElem.append('div').classed("tsi-colorGridRow", true).attr("role", "row");
        this.chartOptions.colors.forEach((c, idx) => {
            let gridItem = colorGridRowElem.append('div').classed("tsi-colorItem", true).classed("tsi-selected", c === this.selectedColor)
                .attr("tabindex", 0)
                .attr("role", "gridcell")
                .attr("aria-label", c)
                .attr("aria-selected", c === this.selectedColor)
                .style("background-color", c)
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.chartOptions.onSelect(c); this.hideColorGrid(true); this.setSelectedColor(c, gridItem);
                })
                .on('keydown', (event) => {
                    if (event.keyCode === KeyCodes.Tab && !event.shiftKey && idx === this.chartOptions.colors.length - 1) { // tab
                        event.preventDefault();
                        this.colorPickerElem.selectAll(".tsi-colorItem").nodes()[0].focus();
                    } else if (event.keyCode === KeyCodes.Enter) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.chartOptions.onSelect(c); 
                        this.hideColorGrid(true); 
                        this.setSelectedColor(c, gridItem);
                    } else if (event.keyCode === KeyCodes.Esc) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.hideColorGrid(true);
                    }
                });
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
        this.colorPickerElem.select(".tsi-colorPickerButton").attr("aria-label", (this.selectedColor ? this.selectedColor : this.getString('No color')) + ' ' + this.getString('Select color'));
        gridItem.classed("tsi-selected", true);
        gridItem.attr("aria-selected", true);
        this.selectedColor = cStr;
    }

    public getColorPickerElem = () => {
        return this.colorPickerElem;
    }
}

export default ColorPicker
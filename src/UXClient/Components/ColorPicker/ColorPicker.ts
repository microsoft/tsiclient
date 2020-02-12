import * as d3 from 'd3';
import { Component } from '../../Interfaces/Component';
import { Utils } from '../../Utils';
import './ColorPicker.scss';

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
                    .on('click', (e) => {
                        if (this.isColorGridVisible) {
                            this.hideColorGrid();
                        } else {
                            this.chartOptions.onClick(e); this.showColorGrid();
                        }
                    });
        if (this.selectedColor) {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).style("background-color", this.selectedColor);
        } else {
            colorPickerButton.append('div').classed("tsi-selectedColor", true).classed("tsi-noColor", true);
        }

        colorPickerButton.append('span').classed("tsi-selectedColorValue", true).classed("hidden", this.chartOptions.isColorValueHidden).text(this.selectedColor ? this.selectedColor : this.getString('No color'));

        // color grid
        let colorGridElem =  this.colorPickerElem.append('div').classed("tsi-colorGrid", true);
        this.chartOptions.colors.forEach(c => {
            let gridItem = colorGridElem.append('div').classed("tsi-colorItem", true).classed("tsi-selected", c === this.selectedColor)
                    .style("background-color", c)
                    .on('click', () => {this.chartOptions.onSelect(c); this.hideColorGrid(); this.setSelectedColor(c, gridItem)});
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
    }

    public hideColorGrid = () => {
        this.colorPickerElem.select(".tsi-colorGrid").style("display", "none");
        this.isColorGridVisible = false;
    }

    private setSelectedColor = (cStr, gridItem) => {
        this.colorPickerElem.select(".tsi-selectedColor").classed("tsi-noColor", false);
        this.colorPickerElem.select(".tsi-selectedColor").style("background-color", cStr);
        this.colorPickerElem.select(".tsi-selectedColorValue").text(cStr);
        this.colorPickerElem.select(".tsi-colorItem.tsi-selected").classed("tsi-selected", false);
        gridItem.classed("tsi-selected", true);
        this.selectedColor = cStr;
    }
}

export {ColorPicker};
import * as d3 from 'd3';
import { Component } from '../../Interfaces/Component';
import { Utils } from '../../Utils';
import './ColorPicker.scss';

class ColorPicker extends Component{
    private colorPickerOptions = new ColorPickerOptions();
    private colorPickerElem;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render (colorPickerOptions: any) {
        this.colorPickerOptions.setOptions(colorPickerOptions);
        let colors = Utils.generateColors(this.colorPickerOptions.numberOfColors);

        this.colorPickerElem = d3.select(this.renderTarget).classed("tsi-colorPicker", true);
        super.themify( this.colorPickerElem, this.colorPickerOptions.theme);

        // color selection button
        let colorPickerButton =  this.colorPickerElem.append('button').classed("tsi-colorPickerButton", true)
                    .on('click', this.showColorGrid);
        colorPickerButton.append('div').classed("tsi-selectedColor", true).style("background-color", colors[0]);
        colorPickerButton.append('span').classed("tsi-selectedColorValue", true).classed("hidden", this.colorPickerOptions.isColorValueHidden).text(colors[0]);

        // color grid
        let colorGridElem =  this.colorPickerElem.append('div').classed("tsi-colorGrid", true);
        colors.forEach(c => {
            let gridItem = colorGridElem.append('div').classed("tsi-colorItem", true)
                    .style("background-color", c)
                    .on('click', () => {this.colorPickerOptions.onColorClick(c); this.hideColorGrid(); this.setSelectedColor(c, gridItem)});
        });

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.colorPickerElem.select(".tsi-colorPickerButton").filter(Utils.equalToEventTarget).empty() && 
                this.colorPickerElem.select(".tsi-colorPickerButton").selectAll("*").filter(Utils.equalToEventTarget).empty() &&
                this.colorPickerElem.selectAll(".tsi-colorGrid").filter(Utils.equalToEventTarget).empty()) {
                this.hideColorGrid();
            }
        });
    }

    private showColorGrid = () => {
        this.colorPickerElem.select(".tsi-colorGrid").style("display", "flex");
    }

    private hideColorGrid = () => {
        this.colorPickerElem.select(".tsi-colorGrid").style("display", "none");
    }

    private setSelectedColor = (cStr, gridItem) => {
        this.colorPickerElem.select(".tsi-selectedColor").style("background-color", cStr);
        this.colorPickerElem.select(".tsi-selectedColorValue").text(cStr);
        this.colorPickerElem.select(".tsi-colorItem.selected").classed("selected", false);
        gridItem.classed("selected", true);
    }
}

class ColorPickerOptions {
    public numberOfColors = 10;
    public theme = Theme.light;
    public isColorValueHidden = false;
    public onColorClick = colorHex => {};

    public setOptions = (options) => {
        this.numberOfColors = options.hasOwnProperty('numberOfColors') ? options.numberOfColors : this.numberOfColors;
        this.theme = options.hasOwnProperty('theme') && options.theme in Theme ? options.theme : this.theme;
        this.isColorValueHidden = options.hasOwnProperty('isColorValueHidden') ? options.isColorValueHidden : this.isColorValueHidden;
        if (options.hasOwnProperty('onColorClick')) {
            this.onColorClick = options.onColorClick;
        } 
    }
}

export enum Theme {light = "light", dark = "dark"};

export {ColorPicker};
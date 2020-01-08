import * as d3 from 'd3';
import './DateTimeButtonSingle.scss';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';
import { Utils } from '../../Utils';
import { SingleDateTimePicker } from '../SingleDateTimePicker/SingleDateTimePicker';

class DateTimeButtonSingle extends DateTimeButton {    

    private selectedMillis: number;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private sDTPOnSet = (millis) => {
        this.dateTimeButton.text(this.buttonDateTimeFormat(millis));
        this.dateTimePickerContainer.style("display", "none");
        this.selectedMillis = millis;
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, selectedMillis: number = null, onSet = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);
        this.selectedMillis = selectedMillis;
        d3.select(this.renderTarget).classed('tsi-dateTimeContainerSingle', true);
        this.dateTimeButton.text(this.buttonDateTimeFormat(selectedMillis));
        if (!this.dateTimePicker) {
            this.dateTimePicker = new SingleDateTimePicker(this.dateTimePickerContainer.node());
        }

        let targetElement = <any>d3.select(this.renderTarget);
        var dateTimeTextChildren = (targetElement.select(".tsi-dateTimePickerContainer")).selectAll("*");
        d3.select("html").on("click." + Utils.guid(), () => {
            let pickerContainerChildren = this.dateTimePickerContainer.selectAll("*");
            var outside = dateTimeTextChildren.filter(Utils.equalToEventTarget).empty() 
                && targetElement.selectAll(".tsi-dateTimePickerContainer").filter(Utils.equalToEventTarget).empty()
                && targetElement.selectAll(".tsi-dateTimeButton").filter(Utils.equalToEventTarget).empty()
                && targetElement.selectAll(".tsi-saveButton").filter(Utils.equalToEventTarget).empty();
            var inClickTarget = pickerContainerChildren.filter(Utils.equalToEventTarget).empty();
            if (outside && inClickTarget && (this.dateTimePickerContainer.style('display') !== 'none')) {
                this.sDTPOnSet(this.dateTimePicker.getMillis());
            }
        });

        this.dateTimeButton.on("click", () => {
                this.dateTimePickerContainer.style("display", "block");
                this.dateTimePicker.render(this.chartOptions, this.minMillis, this.maxMillis, this.selectedMillis, this.sDTPOnSet);
            });       
    }
  
}
export {DateTimeButtonSingle}

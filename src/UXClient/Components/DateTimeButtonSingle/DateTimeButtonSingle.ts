import * as d3 from 'd3';
import './DateTimeButtonSingle.scss';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';
import SingleDateTimePicker from '../SingleDateTimePicker/SingleDateTimePicker';

class DateTimeButtonSingle extends DateTimeButton {    

    private selectedMillis: number;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private closeSDTP () {
        this.dateTimePickerContainer.style("display", "none");
        this.dateTimeButton.node().focus();
    }

    private sDTPOnSet = (millis: number = null) => {
        if (millis !== null) {
            this.dateTimeButton.text(this.buttonDateTimeFormat(millis));
            this.selectedMillis = millis;
            this.onSet(millis);
        }
        this.closeSDTP();
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

        this.dateTimeButton.on("click", () => {
                this.chartOptions.dTPIsModal = true;
                this.dateTimePickerContainer.style("display", "block");
                this.dateTimePicker.render(this.chartOptions, this.minMillis, this.maxMillis, this.selectedMillis, this.sDTPOnSet);
            });       
    }
  
}
export default DateTimeButtonSingle

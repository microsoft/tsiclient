import * as d3 from 'd3';
import {Utils} from "./../Utils";
import {ChartComponent} from "./ChartComponent";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';
import { DateTimePicker } from '../Components/DateTimePicker/DateTimePicker';

class DateTimeButton extends ChartComponent {

    protected dateTimePicker: DateTimePicker;
    private pickerIsVisible: boolean = false;
    protected minMillis: number;
    protected maxMillis: number;
    protected dateTimeButton: any;

	constructor(renderTarget: Element){
        super(renderTarget);
        this.dateTimePicker = new DateTimePicker(renderTarget);
    }

    protected buttonDateTimeFormat (millis) {
        return Utils.timeFormat(!this.chartOptions.minutesForTimeLabels, !this.chartOptions.minutesForTimeLabels, 
            this.chartOptions.offset, this.chartOptions.is24HourTime, 0, null, this.chartOptions.dateLocale)(millis);
    }

    public render (chartOptions, minMillis, maxMillis, onSet) {
        let self = this;
        this.chartOptions.setOptions(chartOptions);
        let dateTimeContainer = d3.select(this.renderTarget).classed('tsi-dateTimeContainer', true);
        let dateTimePickerContainer = dateTimeContainer.append('div').classed('tsi-dateTimePickerContainer', true);
        this.dateTimeButton = dateTimeContainer.append("button")
            .classed('tsi-dateTimeButton', true);
            // .node().innerHTML = Utils.timeFormat(true, true, 0, true, 0, null, null)(selectedMillis);
            // .on("click", function () {
            //     dateTimePickerContainer.style("display", "block");
            //     var minMillis = self.fromMillis + (Utils.getOffsetMinutes(self.chartOptions.offset, self.fromMillis) * 60 * 1000);
            //     var maxMillis = self.toMillis + (Utils.getOffsetMinutes(self.chartOptions.offset, self.toMillis) * 60 * 1000);
            //     var startMillis = self.selectedFromMillis + (Utils.getOffsetMinutes(self.chartOptions.offset, self.selectedFromMillis) * 60 * 1000);
            //     var endMillis = self.selectedToMillis + (Utils.getOffsetMinutes(self.chartOptions.offset, self.selectedFromMillis) * 60 * 1000);
            //     self.dateTimePicker.render({'theme': self.chartOptions.theme, offset: self.chartOptions.offset, is24HourTime: self.chartOptions.is24HourTime, strings: self.chartOptions.strings.toObject(), dateLocale: self.chartOptions.dateLocale}, 
            //                                 minMillis, maxMillis, startMillis, endMillis, (fromMillis, toMillis, offset) => {
            //                                     self.chartOptions.offset = offset;
            //                                     self.timePickerLineChart.chartOptions.offset = offset;
            //                                     self.sparkLineChart.chartOptions.offset = offset;
            //                                     self.dateTimePickerAction(fromMillis - (Utils.getOffsetMinutes(self.chartOptions.offset, fromMillis) * 60 * 1000), 
            //                                                               toMillis -  (Utils.getOffsetMinutes(self.chartOptions.offset, toMillis) * 60 * 1000));
            //                                     (<any>d3.select(self.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
            //                                 },
            //                                 () => {
            //                                     self.dateTimePicker.updateFromAndTo(startMillis, endMillis);
            //                                     self.dateTimePickerContainer.style("display", "none");
            //                                     (<any>d3.select(self.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
            //                                 });

            // });        
    }
}
export {DateTimeButton}

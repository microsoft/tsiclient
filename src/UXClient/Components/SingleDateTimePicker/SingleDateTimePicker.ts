import * as d3 from 'd3';
import * as Pikaday from '../../../packages/pikaday/pikaday';
import * as moment from 'moment';
import './SingleDateTimePicker.scss';
import '../../../packages/pikaday/css/pikaday.css';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { TimezonePicker } from '../TimezonePicker/TimezonePicker';
import { entries } from 'd3';
import { Utils } from "./../../Utils";


class SingleDateTimePicker extends ChartComponent{
    private calendar: any;
    private calendarPicker: any;
    private timeControls: any;
    private minMillis: number;
    private maxMillis: number;
    private millis: number;
    private minutes: number;
    private hours: number;
    private onSet: any;
    private targetElement: any;
    private isValid: boolean = true;
    private offsetName: string;
    private date: Date;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private setNewOffset (oldOffset: any) {
        var valuesToUpdate = ["minMillis", "maxMillis"];
        valuesToUpdate.forEach((currValue: string) => {
            var oldOffsetMinutes = Utils.getMinutesToUTC(oldOffset, this[currValue]);
            var utcMillis = this[currValue] + (oldOffsetMinutes * 60 * 1000);
            this[currValue] = utcMillis + Utils.getOffsetMinutes(this.chartOptions.offset, utcMillis) * 60 * 1000;
        });   
        
        this.updateDisplayedDateTime();

        this.date = new Date(this.millis);

        this.calendarPicker.config({minDate: this.roundDay(this.offsetFromUTC(new Date(this.minMillis)))});
        this.calendarPicker.config({maxDate: this.roundDay(this.offsetFromUTC(new Date(this.maxMillis)))});

        this.calendarPicker.draw();

        // var rangeErrorCheck = this.rangeIsValid(this.fromMillis, this.toMillis);
        // this.setIsValid(rangeErrorCheck.rangeIsValid);
        // this.displayRangeErrors(rangeErrorCheck.errors);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
                   millis: number = null, onSet = null) {
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        if (chartOptions.offset && (typeof chartOptions.offset == "string")) {
            this.offsetName = chartOptions.offset;
        }

        if (millis == null) {
            millis = this.maxMillis;
        }
      
        this.chartOptions.setOptions(chartOptions);
        moment.locale(this.chartOptions.dateLocale);
        this.millis = millis;
        this.onSet = onSet;
        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-singleDateTimePicker", true);
        this.targetElement.node().innerHTML = "";
        super.themify(this.targetElement, this.chartOptions.theme);
        this.calendar = this.targetElement.append("div").classed("tsi-calendarPicker", true);
        this.timeControls = this.targetElement.append("div").classed("tsi-timeControlsContainer", true);
        var saveButtonContainer = this.targetElement.append("div").classed("tsi-saveButtonContainer", true);
        var self = this;
        var saveButton = saveButtonContainer.append("button").classed("tsi-saveButton", true).html(this.getString("Save"))
            .on("click", () =>  {
                //TODO take the check out of here and put it on input value change
                let dateTime = new Date(self.millis);
                let dateString = dateTime.getUTCFullYear() + '-' + (dateTime.getUTCMonth() + 1) + '-' + dateTime.getUTCDate();
                let parsedDate = new Date(dateString + ' ' + this.timeControls.select(".tsi-timeInput").node().value);
                
                let errorCheck = this.dateTimeIsValid(parsedDate.valueOf());
                this.displayRangeErrors(errorCheck.errors);
                if (errorCheck.rangeIsValid) {
                    this.setMillis(parsedDate.valueOf());
                    self.onSet(parsedDate.valueOf(), self.chartOptions.offset);
                } 
            });
        
        this.targetElement.append("div").classed("tsi-errorMessageContainer", true);
        this.createCalendar();
        this.calendarPicker.draw();
        this.createTimePicker();

        this.updateDisplayedDateTime();

        this.date = new Date(this.millis);
        this.calendarPicker.draw();
        return;
    }

    //zero out everything but year, month and day
    private roundDay (d: Date) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    private setSelectedDate (d: Date) {
        this.calendarPicker.setDate(d, true);
        this.setDate(d);
    }

    private createCalendar () {
        var i18nOptions = {
            previousMonth : this.getString('Previous Month'),
            nextMonth     : this.getString('Next Month'),
            months        : moment.localeData()._months,
            weekdays      : moment.localeData()._weekdays,
            weekdaysShort : moment.localeData()._weekdaysMin
        };

        this.calendarPicker = new Pikaday({ 
            bound: false,
            container: this.calendar.node(),
            field: this.calendar.node(),
            i18n: i18nOptions,
            numberOfMonths: 1,
            onSelect: (d) => {
                this.setSelectedDate(d);
                this.calendarPicker.draw();
            },
            onDraw: (d) => {
                var self = this;
            },
            minDate: this.offsetFromUTC(new Date(this.minMillis)),
            maxDate: this.offsetFromUTC(new Date(this.maxMillis)),
            defaultDate: this.offsetFromUTC(new Date(this.millis))
        });
    }

    private setDate (d: Date) {
        var date = new Date(this.millis);
        date.setUTCFullYear(d.getFullYear());
        date.setUTCMonth(d.getMonth());
        date.setUTCDate(d.getDate());
        this.setMillis(date.valueOf());
    }

    private setIsValid (isValid: boolean){
        this.isValid = isValid;
    }

    //line up the seconds and millis with the second and millis of the max date
    private adjustSecondsAndMillis (rawMillis) {
        var currDate = new Date(rawMillis);
        var maxDate = new Date(this.maxMillis);
        currDate.setUTCSeconds(maxDate.getUTCSeconds());
        currDate.setUTCMilliseconds(maxDate.getUTCMilliseconds());
        return currDate.valueOf();
    }

    private setMillis (millis: number) {
        var adjustedMillis = this.adjustSecondsAndMillis(millis);
        // var rangeErrorCheck = this.rangeIsValid(millis, this.toMillis);
        this.millis = adjustedMillis;
        // this.setIsValid(rangeErrorCheck.rangeIsValid);
        // this.displayRangeErrors(rangeErrorCheck.errors);
    } 

    private displayRangeErrors (rangeErrors) {
        this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessage").remove();
        if (rangeErrors.length != 0) {
            this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessages")
                .data(rangeErrors)
                .enter()
                .append("div")
                .classed("tsi-errorMessage", true)
                .html(d => d);
        }
    }

    private dateTimeIsValid (prospectiveMillis: number) {
        var accumulatedErrors = [];
        if (isNaN(prospectiveMillis)) {
            accumulatedErrors.push('*time is invalid');
        } else {
            var firstDateTime = new Date(this.minMillis);
            var firstTimeText = Utils.getUTCHours(firstDateTime, this.chartOptions.is24HourTime) + ":" + 
                                (firstDateTime.getUTCMinutes() < 10 ? "0" : "") + String(firstDateTime.getUTCMinutes()) +
                                (this.chartOptions.is24HourTime ? "" : (firstDateTime.getUTCHours() < 12 ? " AM" : " PM"));
            var lastDateTime = new Date(this.maxMillis);
            var lastTimeText = Utils.getUTCHours(lastDateTime, this.chartOptions.is24HourTime) + ":" + 
                               (lastDateTime.getUTCMinutes() < 10 ? "0" : "") + String(lastDateTime.getUTCMinutes()) + 
                               (this.chartOptions.is24HourTime ? "" : (lastDateTime.getUTCHours() < 12 ? " AM" : " PM"));
    
            if (prospectiveMillis < this.minMillis) {
                accumulatedErrors.push("*date/time is before first possible time (" + firstTimeText + ")");
            }
            if (prospectiveMillis > this.maxMillis) {
                accumulatedErrors.push("*date/time is after last possible time (" + lastTimeText + ")");
            }
        }

        return {
            rangeIsValid : (accumulatedErrors.length == 0),
            errors: accumulatedErrors
        };
    }

    private updateDisplayedDateTime () {
        var selectedDate = new Date(this.millis);
        this.calendarPicker.setDate(this.roundDay(this.offsetFromUTC(selectedDate)));
        let timeInput = this.timeControls.select(".tsi-timeInput");
        debugger;
        timeInput.node().value = this.createTimeString(selectedDate);
    }

    private createTimeString (currDate: Date) {
        var formatTwoDecimals = (val: number) => ('0' + String(val)).slice(-2);
        var formatThreeDecimals = (val: number) => ('00' + String(val)).slice(-3);
        let offsetDate = this.offsetFromUTC(currDate);
        return offsetDate.getUTCHours() + ':' +  
            formatTwoDecimals(offsetDate.getUTCMinutes()) + ':' + 
            formatTwoDecimals(offsetDate.getUTCSeconds()) + '.' + 
            formatThreeDecimals(offsetDate.getUTCMilliseconds()); 
    }

    private convert

    private offsetUTC (date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime( dateCopy.getTime() - dateCopy.getTimezoneOffset()*60*1000 );
        return dateCopy;
    }

    private offsetFromUTC(date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime( dateCopy.getTime() + dateCopy.getTimezoneOffset()*60*1000 );
        return dateCopy;    
    }

    private createTimePicker () {
        var self = this;
        let timeLabel = this.timeControls.append("h4").classed("tsi-timeLabel", true).html(this.getString('time'));
        this.timeControls.append('input').classed('tsi-timeInput', true);
    }
}

export {SingleDateTimePicker};
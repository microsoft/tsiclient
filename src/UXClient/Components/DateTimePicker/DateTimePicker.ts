import * as d3 from 'd3';
import * as Pikaday from 'pikaday';
import './DateTimePicker.scss';
import 'pikaday/css/pikaday.css';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { TimezonePicker } from '../TimezonePicker/TimezonePicker';
import { entries } from 'd3';
import { Utils } from "./../../Utils";


class DateTimePicker extends ChartComponent{
    private calendar: any;
    private calendarPicker: any;
    private timeControls: any;
    private minMillis: number;
    private maxMillis: number;
    private fromMillis: number;
    private toMillis: number;
    private fromMinutes: number;
    private fromHours: number;
    private toMinutes: number;
    private toHours: number;
    private onSet: any;
    private targetElement: any;
    private isValid: boolean = true;

    private isSettingStartTime: boolean = true;
    private startRange;
    private endRange;
    private anchorDate;
    private offsetName: string;

    private monthOfFirstCal;

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
        this.setFromMillis(this.fromMillis);
        this.setToMillis(this.toMillis);
        
        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);

        this.calendarPicker.config({minDate: this.roundDay(this.offsetFromUTC(new Date(this.minMillis)))});
        this.calendarPicker.config({maxDate: this.roundDay(this.offsetFromUTC(new Date(this.maxMillis)))});

        this.calendarPicker.draw();

        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, this.toMillis);
        this.setIsValid(rangeErrorCheck.rangeIsValid);
        this.displayRangeErrors(rangeErrorCheck.errors);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
                   fromMillis: number = null, toMillis: number = null, onSet = null) {
        this.isSettingStartTime = true;
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        if (chartOptions.offset && (typeof chartOptions.offset == "string")) {
            this.offsetName = chartOptions.offset;
        }

        if (toMillis == null) {
            toMillis = this.maxMillis;
        }
        if (fromMillis == null) {
            fromMillis = Math.max(toMillis - (24 * 60 * 60 * 1000), minMillis);
        }
        this.chartOptions.setOptions(chartOptions);

        this.fromMillis = fromMillis;
        this.toMillis = toMillis;
        this.onSet = onSet;
        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-dateTimePicker", true);
        this.targetElement.node().innerHTML = "";
        super.themify(this.targetElement, this.chartOptions.theme);
        this.calendar = this.targetElement.append("div").classed("tsi-calendarPicker", true);
        this.timeControls = this.targetElement.append("div").classed("tsi-timeControlsContainer", true);
        var saveButtonContainer = this.targetElement.append("div").classed("tsi-saveButtonContainer", true);
        var self = this;
        var saveButton = saveButtonContainer.append("button").classed("tsi-saveButton", true).html("Save")
            .on("click", function () {
                self.onSet(self.fromMillis, self.toMillis, self.chartOptions.offset);
            });

        //originally set toMillis to last possible time
        this.toMillis = this.maxMillis;
        this.setFromMillis(fromMillis);
        this.setToMillis(toMillis);
        
        this.targetElement.append("div").classed("tsi-errorMessageContainer", true);
        this.createCalendar();
        // this.calendarPicker.draw();
        this.createTimePicker();
        this.createTimezonePicker();

        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);
        this.calendarPicker.draw();
        return;
    }

    private createTimezonePicker () {
        const offset = this.chartOptions.offset;
        if (this.chartOptions.includeTimezones && (typeof offset == "string" || offset == 0)) {
            var timezoneContainer = this.timeControls.append("div").attr("class", "tsi-timezoneContainer");
            timezoneContainer.append("h4").classed("tsi-timeLabel", true).html("Time Zone");
            var timezonePickerContainer = timezoneContainer.append("div").classed("tsi-timezonePickerContainer", true);
            var timezonePicker = new TimezonePicker(timezonePickerContainer.node());
            timezonePicker.render((newOffset) => {
                var oldOffset = this.chartOptions.offset;
                this.chartOptions.offset = newOffset;
                this.setNewOffset(oldOffset);
            }, (typeof offset == "string" ? offset : "UTC"));
        }
    }

    //zero out everything but year, month and day
    private roundDay (d: Date) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    private setTimeRange (d: Date, isFromSelect: boolean) {
        if (this.isSettingStartTime) {
            this.calendarPicker.setStartRange(d, true);
            this.calendarPicker.setEndRange(null, true);
            this.startRange = d;
            this.anchorDate = d;
        }
        else {
            if (d.valueOf() > this.anchorDate.valueOf()) {
                if (isFromSelect) {
                    this.setFromDate(this.anchorDate);
                    this.setToDate(d);
                }
                this.calendarPicker.setEndRange(d, true);
                this.calendarPicker.setStartRange(this.anchorDate, true);
                this.startRange = this.anchorDate;
                this.endRange = d;
            } else {
                if (isFromSelect) {
                    this.setFromDate(d);
                    this.setToDate(this.anchorDate);
                }
                this.calendarPicker.setStartRange(d, true);
                this.calendarPicker.setEndRange(this.anchorDate, true);
                this.endRange = this.anchorDate;
                this.startRange = d;
            }
        }
    }

    private createCalendar () {
        var i18nOptions = {
            previousMonth : 'Previous Month',
            nextMonth     : 'Next Month',
            months        : ['January','February','March','April','May','June','July','August','September','October','November','December'],
            weekdays      : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
            weekdaysShort : ['S','M','T','W','T','F','S']
        };

        this.calendarPicker = new Pikaday({ 
            bound: false,
            container: this.calendar.node(),
            field: this.calendar.node(),
            i18n: i18nOptions,
            numberOfMonths: 2,
            onSelect: (d) => {
                console.log("onSelect triggered");
                this.setTimeRange(d, true);
                this.isSettingStartTime = !this.isSettingStartTime;
                this.calendarPicker.draw();
            },
            onOpen: (d) => {
                if (this.monthOfFirstCal !== d.calendars[0].month && this.monthOfFirstCal !== undefined) {
                    console.log("month changed");
                    console.log("old: " + this.monthOfFirstCal);
                    console.log("new: " + d.calendars[0].month);
                }
                this.monthOfFirstCal = d.calendars[0].month;
                if (this.isSettingStartTime)
                    return; 
                var self = this;
                this.calendar.select(".pika-single").selectAll(".pika-day").on("mouseover", function (d) { 
                    var date = new Date( Number(d3.select(this).attr("data-pika-year")),
                                         Number(d3.select(this).attr("data-pika-month")), 
                                         Number(d3.select(this).attr("data-pika-day")));
                    if (!self.isSettingStartTime) {
                        if (date.valueOf() < self.anchorDate.valueOf() && self.startRange.valueOf() != date.valueOf()) {
                            self.setTimeRange(date, false);
                            self.calendarPicker.draw();
                            return;
                        }
                        if (date.valueOf() >= self.anchorDate.valueOf() && (self.endRange == undefined || self.endRange.valueOf() != date.valueOf())) {
                            self.setTimeRange(date, false);
                            self.calendarPicker.draw();
                            return;
                        }
                    }
                });
            },
            minDate: this.offsetFromUTC(new Date(this.minMillis)),
            maxDate: this.offsetFromUTC(new Date(this.maxMillis)),
            defaultDate: this.offsetFromUTC(new Date(this.fromMillis))
        });
    }

    private setFromDate (d: Date) {
        var fromDate = new Date(this.fromMillis);
        fromDate.setUTCFullYear(d.getFullYear());
        fromDate.setUTCMonth(d.getMonth());
        fromDate.setUTCDate(d.getDate());
        this.setFromMillis(fromDate.valueOf());
    }

    private setToDate (d: Date) {
        var toDate = new Date(this.toMillis);
        toDate.setUTCFullYear(d.getFullYear());
        toDate.setUTCMonth(d.getMonth());
        toDate.setUTCDate(d.getDate());
        this.setToMillis(toDate.valueOf());
    }

    private setIsValid (isValid: boolean){
        this.isValid = isValid;

        // For now, lets allow users to save the time even in the presence of errors
        // this.targetElement.select(".tsi-saveButtonContainer").select(".tsi-saveButton")
        //     .attr("disabled", this.isValid ? null : true)
        //     .classed("tsi-buttonDisabled", !this.isValid);

    }

    //line up the seconds and millis with the second and millis of the max date
    private adjustSecondsAndMillis (rawMillis) {
        var currDate = new Date(rawMillis);
        var maxDate = new Date(this.maxMillis);
        currDate.setUTCSeconds(maxDate.getUTCSeconds());
        currDate.setUTCMilliseconds(maxDate.getUTCMilliseconds());
        return currDate.valueOf();
    }

    private setFromMillis (millis: number) {
        var adjustedMillis = this.adjustSecondsAndMillis(millis);
        var rangeErrorCheck = this.rangeIsValid(millis, this.toMillis);
        this.fromMillis = adjustedMillis;
        this.setIsValid(rangeErrorCheck.rangeIsValid);
        this.displayRangeErrors(rangeErrorCheck.errors);
    } 

    private setToMillis (millis: number) {
        var adjustedMillis = this.adjustSecondsAndMillis(millis);
        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, adjustedMillis);
        this.toMillis = adjustedMillis;
        this.setIsValid(rangeErrorCheck.rangeIsValid);
        this.displayRangeErrors(rangeErrorCheck.errors);
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

    private rangeIsValid (prospectiveFromMillis: number, prospectiveToMillis: number) {
        var accumulatedErrors = [];
        var firstDateTime = new Date(this.minMillis);
        var firstTimeText = Utils.getUTCHours(firstDateTime, this.chartOptions.is24HourTime) + ":" + 
                            (firstDateTime.getUTCMinutes() < 10 ? "0" : "") + String(firstDateTime.getUTCMinutes()) +
                            (this.chartOptions.is24HourTime ? "" : (firstDateTime.getUTCHours() < 12 ? " AM" : " PM"));
        var lastDateTime = new Date(this.maxMillis);
        var lastTimeText = Utils.getUTCHours(lastDateTime, this.chartOptions.is24HourTime) + ":" + 
                           (lastDateTime.getUTCMinutes() < 10 ? "0" : "") + String(lastDateTime.getUTCMinutes()) + 
                           (this.chartOptions.is24HourTime ? "" : (lastDateTime.getUTCHours() < 12 ? " AM" : " PM"));

        if (prospectiveFromMillis > prospectiveToMillis) {
            accumulatedErrors.push("*Start time must be before end time");
        }
        if (prospectiveFromMillis < this.minMillis) {
            accumulatedErrors.push("*Start time is before first possible time (" + firstTimeText + ")");
        }
        if (prospectiveFromMillis > this.maxMillis) {
            accumulatedErrors.push("*Start time is after last possible time (" + lastTimeText + ")");
        }
        if (prospectiveToMillis > this.maxMillis) {
            accumulatedErrors.push("*End time is after last possible time (" + lastTimeText + ")");            
        }
        if (prospectiveToMillis < this.minMillis) {
            accumulatedErrors.push("*End time is before first possible time (" + firstTimeText + ")");
        }
        return {
            rangeIsValid : (accumulatedErrors.length == 0),
            errors: accumulatedErrors
        };
    }

    private updateDisplayedFromDateTime () {
        var fromDate = new Date(this.fromMillis);
        this.calendarPicker.setStartRange(this.roundDay(this.offsetFromUTC(fromDate)), true);
        var inputContainer = this.timeControls.select(".tsi-timeInputContainer").select(".tsi-startTimeInputContainer");
        var hours = Utils.getUTCHours(fromDate, this.chartOptions.is24HourTime);
        inputContainer.select(".tsi-hoursInput").selectAll("option").filter((d) => d == hours).attr("selected", true);    
        var minutesString = (fromDate.getUTCMinutes() < 10 ? "0" : "") + String(fromDate.getUTCMinutes());
        inputContainer.select(".tsi-minutesInput").selectAll("option").filter((d) => d == minutesString).attr("selected", true);
        if (!this.chartOptions.is24HourTime) {
            var amPM = fromDate.getUTCHours() < 12 ? "AM" : "PM";
            inputContainer.select(".tsi-AMPMInput").selectAll("option").filter((d) => d == amPM).attr("selected", true);
        }
    }

    private updateDisplayedToDateTime () {
        var toDate = new Date(this.toMillis);
        this.calendarPicker.setEndRange(this.roundDay(this.offsetFromUTC(toDate)), true);
        var inputContainer = this.timeControls.select(".tsi-timeInputContainer").select(".tsi-endTimeInputContainer");
        var hours = Utils.getUTCHours(toDate, this.chartOptions.is24HourTime);
        inputContainer.select(".tsi-hoursInput").selectAll("option").filter((d) => d == hours).attr("selected", true);    
        var minutesString = (toDate.getUTCMinutes() < 10 ? "0" : "") + String(toDate.getUTCMinutes());
        inputContainer.select(".tsi-minutesInput").selectAll("option").filter((d) => d == minutesString).attr("selected", true);
        if (!this.chartOptions.is24HourTime) {
            var amPM = toDate.getUTCHours() < 12 ? "AM" : "PM";
            inputContainer.select(".tsi-AMPMInput").selectAll("option").filter((d) => d == amPM).attr("selected", true);
        }
    }

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
        var timeInputContainer = this.timeControls.append("div").attr("class", "tsi-timeInputContainer");
        var createTimePicker = (startOrEnd) => {
            var self = this;
            var minutes = [];
            for (var i = 0; i < 60; i++) {
                var stringMinute = String(i);
                if (i < 10) {
                    stringMinute = "0" + stringMinute;
                }
                minutes.push(stringMinute);
            }
            var hours = [];
            if (this.chartOptions.is24HourTime) {
                for (var i = 0; i < 24; i++) {
                    hours.push(String(i));
                }    
            } else {
                for (var i = 1; i <= 12; i++) {
                    hours.push(String(i));
                }    
            }
            var amPm = ["AM", "PM"];
            var fromOrToContainer = timeInputContainer.append("div").classed("tsi-" + startOrEnd + "Container", true);
            fromOrToContainer.append("h4").classed("tsi-timeLabel", true).html(startOrEnd);
            var startOrEndTimeContainer = fromOrToContainer.append("div").classed("tsi-" + startOrEnd + "TimeInputContainer", true);
            startOrEndTimeContainer.append("select").attr("class", "tsi-hoursInput tsi-select")
                .on("change", function (d) {
                    var rawHours = Number(d3.select(this).property("value"));
                    var hours = rawHours;
                    if (!self.chartOptions.is24HourTime) {
                        var isPM = startOrEndTimeContainer.select(".tsi-AMPMInput").property("value") == "PM";
                        hours = isPM ? (rawHours + 12) : rawHours;
                        hours = (hours == 12 || hours == 24) ? hours - 12 : hours;
                    }
                    if (startOrEnd == "start") {
                        var startDate = new Date(self.fromMillis);
                        startDate.setUTCHours(hours);
                        self.setFromMillis(startDate.valueOf());
                    } else {
                        var endDate = new Date(self.toMillis);
                        endDate.setUTCHours(hours);
                        self.setToMillis(endDate.valueOf());
                    }
                })
                .selectAll("option")
                .data(hours)
                .enter()
                .append('option')
                .text(d => d)
                .property("value", function (d) { return Number(d); });

            startOrEndTimeContainer.append("select")
                .attr("class", "tsi-minutesInput tsi-select")    
                .on("change", function (d) {
                    var minutes = Number(d3.select(this).property("value"));
                    if (startOrEnd == "start") {
                        var startDate = new Date(self.fromMillis);
                        startDate.setUTCMinutes(minutes);
                        self.setFromMillis(startDate.valueOf());
                    } else {
                        var endDate = new Date(self.toMillis);
                        endDate.setUTCMinutes(minutes);
                        self.setToMillis(endDate.valueOf());
                    }
                })
                .selectAll("option")
                .data(minutes)
                .enter()
                .append('option')
                .text(d => d)
                .property("value", function (d) { return Number(d); });

            if (!this.chartOptions.is24HourTime) {
                var amPmSelect = startOrEndTimeContainer.append("select");
                amPmSelect.attr("class", "tsi-AMPMInput tsi-select")
                    .on("change", function (d) {
                        var isPM = startOrEndTimeContainer.select(".tsi-AMPMInput").property("value") == "PM";
                        var rawHours = Number(startOrEndTimeContainer.select(".tsi-hoursInput").property("value"));
                        var isPM = d3.select(this).property("value") == "PM";
                        var hours = isPM ? (rawHours + 12) : rawHours;
                        hours = (hours == 12 || hours == 24) ? hours - 12 : hours;
                        if (startOrEnd == "start") {
                            var startDate = new Date(self.fromMillis);
                            startDate.setUTCHours(hours);
                            self.setFromMillis(startDate.valueOf());
                        } else {
                            var endDate = new Date(self.toMillis);
                            endDate.setUTCHours(hours);
                            self.setToMillis(endDate.valueOf());
                        }
                    })
                    .selectAll("option")
                    .data(amPm)
                    .enter()
                    .append('option')
                    .text(d => d)
                    .property("value", d => d);
            } 
        }

        createTimePicker("start");
        createTimePicker("end");
    }
}

export {DateTimePicker};
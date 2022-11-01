import * as d3 from 'd3';
import moment from 'moment-timezone';
import Grid from "../Components/Grid/Grid";
import { ChartOptions } from '../Models/ChartOptions';
import { ChartComponentData } from '../Models/ChartComponentData';
import { CharactersToEscapeForExactSearchInstance, nullTsidDisplayString, GRIDCONTAINERCLASS, NONNUMERICTOPMARGIN } from '../Constants/Constants';
import { YAxisStates, valueTypes } from '../Constants/Enums';

export default class Utils { 
    static guidForNullTSID = Utils.guid();

    static formatYAxisNumber (val: number) {
        if (Math.abs(val) < 1000000) {
            if (Math.abs(val) < .0000001)
                return d3.format('.2n')(val); // scientific for less than 1 billionth
            else {
                // grouped thousands with 7 significant digits, trim insginificant trailing 0s
                var formatted = d3.format(',.7r')(val); 
                if (formatted.indexOf('.') != -1) {
                    var lastChar = formatted[formatted.length - 1]
                    while (lastChar == '0') {
                        formatted = formatted.slice(0, -1);
                        lastChar = formatted[formatted.length - 1]
                    }
                    if (lastChar == '.')
                        formatted = formatted.slice(0, -1);
                }
                return formatted;
            }
        }
        else if (Math.abs(val) >= 1000000 && Math.abs(val) < 1000000000)
            return d3.format('.3s')(val); // suffix of M for millions
        else if (Math.abs(val) >= 1000000000 && Math.abs(val) < 1000000000000)
            return d3.format('.3s')(val).slice(0, -1) + 'B'; // suffix of B for billions
        return d3.format('.2n')(val); // scientific for everything else
    }

    static getStackStates() {
        return YAxisStates;
    }
    
    // format [0-9]+[ms|s|m|h|d], convert to millis
    static parseTimeInput (inputString: string) {
        inputString = inputString.toLowerCase();
        let getNumber = (inputString, charsFromEnd) => {
            let startAt = inputString.indexOf('pt') !== -1 ? 2 : (inputString.indexOf('p') !== -1 ? 1 : 0);
            return Number(inputString.slice(startAt, inputString.length - charsFromEnd));
        }
        if (inputString.indexOf('ms') == inputString.length - 2) {
            return getNumber(inputString, 2);
        }
        if (inputString.indexOf('s') == inputString.length - 1) {
            return getNumber(inputString, 1) * 1000;
        }
        if (inputString.indexOf('m') == inputString.length - 1) {
            return getNumber(inputString, 1) * 60 * 1000;
        }
        if (inputString.indexOf('h') == inputString.length - 1) {
            return getNumber(inputString, 1) * 60 * 60 * 1000;
        }
        if (inputString.indexOf('d') == inputString.length - 1) {
            return getNumber(inputString, 1) * 24 * 60 * 60 * 1000;
        }
        return -1;
    }

    static findClosestTime (prevMillis: number, timeMap: any): number {
        var minDistance = Infinity;
        var closestValue = null;
        Object.keys(timeMap).forEach((intervalCenterString) => {
            var intervalCenter = Number(intervalCenterString);
            if (Math.abs(intervalCenter - prevMillis) < minDistance) {
                minDistance = Math.abs(intervalCenter - prevMillis);
                closestValue = intervalCenter;
            }
        });
        return closestValue;
    }


    static getValueOfVisible (d: any, visibleMeasure: string) {
        if (d.measures) {
            if (d.measures[visibleMeasure] != null || d.measures[visibleMeasure] != undefined)
                return d.measures[visibleMeasure];
        } 
        return null;
    }

    static isStartAt (startAtString: string = null, searchSpan: any = null) {
        return (startAtString !== null && searchSpan !== null && searchSpan.from !== null);
    }
    
    static parseShift (shiftString: string, startAtString: any = null, searchSpan: any = null) {
        if (this.isStartAt(startAtString, searchSpan)) {
            return (new Date(startAtString)).valueOf() - (new Date(searchSpan.from)).valueOf();
        }
        
        if (shiftString === undefined || shiftString === null || shiftString.length === 0) {
            return 0;
        }
        let millis: number;
        if (shiftString[0] === '-' || shiftString[0] === '+') {
            millis = (shiftString[0] === '-' ? -1 : 1) * this.parseTimeInput(shiftString.slice(1,shiftString.length));
        } else {
            millis = this.parseTimeInput(shiftString);
        }
        return -millis;
    }

    static adjustStartMillisToAbsoluteZero (fromMillis, bucketSize) {
        let epochAdjustment = 62135596800000;
        return Math.floor((fromMillis + epochAdjustment) / bucketSize) * bucketSize - epochAdjustment;
    }

    static bucketSizeToTsqInterval (bucketSize: string) {
        if (!bucketSize) {return null;}
        let bucketSizeInMillis = Utils.parseTimeInput(bucketSize);
        let padLeadingZeroes = (number) => {
            let numberAsString = String(number);
            if(numberAsString.length < 3) 
                numberAsString = (numberAsString.length === 2 ? '0' : '00') + numberAsString;
            return numberAsString
        }
        if (bucketSizeInMillis < 1000) {
            bucketSize = (bucketSize.toLowerCase().indexOf('d') !== -1) ? 'd.' : '.' + padLeadingZeroes(bucketSizeInMillis) + "s"; 
        }
        let prefix = bucketSize.toLowerCase().indexOf('d') !== -1 ? 'P' : 'PT';
        return (prefix + bucketSize).toUpperCase();
    }

    static createEntityKey (aggName: string, aggIndex: number) {
        return encodeURIComponent(aggName).split(".").join("_") + "_" + aggIndex;
    }

    static getColorForValue (chartDataOptions, value) {
        if (chartDataOptions.valueMapping && (chartDataOptions.valueMapping[value] !== undefined)) {
            return chartDataOptions.valueMapping[value].color;
        }
        return null;
    }

    static rollUpContiguous (data) {
        let areEquivalentBuckets = (d1, d2) => {
            if (!d1.measures || !d2.measures) {
                return false;
            }
            if (Object.keys(d1.measures).length !== Object.keys(d2.measures).length) {
                return false;
            }
            return Object.keys(d1.measures).reduce((p, c, i) => {
                return p && (d1.measures[c] === d2.measures[c]);
            }, true);
        }

        return data.filter((d, i) => {
            if (i !== 0) {
                return !areEquivalentBuckets(d, data[i - 1]);
            }
            return true;
        });
    }

    static formatOffsetMinutes (offset) {
        return (offset < 0 ? '-' : '+') + 
            Math.floor(offset / 60) + ':' + 
            (offset % 60 < 10 ? '0' : '') + (offset % 60) + ''; 

    }

    static getOffsetMinutes(offset: any, millis: number) {
        if (offset == 'Local') {
            return -moment.tz.zone(moment.tz.guess()).parse(millis);
        }
        if (typeof offset == 'string' && isNaN(offset as any)) {
            return -moment.tz.zone(offset).parse(millis);
        } else {
            return offset;
        }
    }

    static offsetUTC (date: Date) {
        let offsettedDate = new Date(date.valueOf() - date.getTimezoneOffset()*60*1000);
        return offsettedDate; 
    }

    // inverse of getOffsetMinutes, this is the conversion factor of an offsettedTime to UTC in minutes 
    static getMinutesToUTC (offset: any, millisInOffset: number) {
        if (offset == 'Local') {
            return moment.tz.zone(moment.tz.guess()).utcOffset(millisInOffset);
        }
        if (typeof offset == 'string' && isNaN(offset as any)) {
            return moment.tz.zone(offset).utcOffset(millisInOffset);
        } else {
            return -offset;
        }
    }

    static addOffsetGuess (timezoneName) {
        let timezone = moment.tz(new Date(), timezoneName.split(' ').join('_'));
        let formatted = timezone.format('Z');
        return "UTC" + formatted;
    }

    static timezoneAbbreviation (timezoneName) {
        let abbr = moment.tz(new Date(), timezoneName).format('z');
        if (abbr[0] === '-' || abbr[0] === '+')
            return '';
        return abbr;
    } 

    static createTimezoneAbbreviation (offset) {
        let timezone = Utils.parseTimezoneName(offset);
        let timezoneAbbreviation = Utils.timezoneAbbreviation(timezone);
        return (timezoneAbbreviation.length !== 0 ? timezoneAbbreviation : Utils.addOffsetGuess(timezone));
    }

    static parseTimezoneName (timezoneRaw: any) {
        if (!isNaN(timezoneRaw)) {
            if (timezoneRaw === 0) {
                return 'UTC';
            }
            return '';
        }
        if (timezoneRaw == 'Local') {
            return moment.tz.guess();
        } 
        return timezoneRaw !== null ? timezoneRaw.split(' ').join('_'): '';
    }

    static convertTimezoneToLabel (timezone , locdLocal = 'Local') {
        let timezoneName = this.parseTimezoneName(timezone);
        let localPrefix = '';
        let offsetPrefix = '';
        if (timezone == 'Local') {
            localPrefix = locdLocal + ' - ';
        } 
        if (timezone !== 'UTC') {
            offsetPrefix = ' (' + this.addOffsetGuess(timezoneName) + ')';
        }
        let timezoneAbbreviation = this.timezoneAbbreviation(timezoneName);
        let timezoneSuffix = (timezoneAbbreviation && timezoneAbbreviation.length !== 0 && timezoneAbbreviation !== 'UTC') ? ': ' + timezoneAbbreviation : '';
        return offsetPrefix + " " + localPrefix + timezoneName.replace(/_/g, ' ') + timezoneSuffix;
    }

    static rangeTimeFormat (rangeMillis: number) {
        var rangeText = "";
        var oneSecond = 1000;
        var oneMinute = 60 * 1000;
        var oneHour = oneMinute * 60;
        var oneDay = oneHour * 24;

        var days = Math.floor(rangeMillis / oneDay);
        var hours = Math.floor(rangeMillis / oneHour) % 24;
        var minutes = Math.floor(rangeMillis / oneMinute) % 60;
        var seconds = Math.floor(rangeMillis / oneSecond) % 60;
        var millis = Math.floor(rangeMillis % 1000);

        if (rangeMillis >= oneDay) {
            return days + "d " + (hours > 0 ? (hours + "h") : "");
        } else if (rangeMillis >= oneHour) {
            return hours + "h " + (minutes > 0 ? (minutes + "m") : "");
        } else if (rangeMillis >= oneMinute) {
            return minutes + "m " + (seconds > 0 ? (seconds + "s") : "");
        }
        else if (rangeMillis >= oneSecond) {
            return seconds + (millis != 0 ? "." + millis : "") + "s";
        }
        return millis + "ms";
    }

    static subDateTimeFormat (is24HourTime, usesSeconds ,usesMillis) {
        return (is24HourTime ? "HH" : "hh") + ":mm" + (usesSeconds ? (":ss" + (usesMillis ? ".SSS" : "")) : "") + (is24HourTime ? "" : " A");
    };
    
    static timeFormat(usesSeconds = false, usesMillis = false, offset: any = 0, is24HourTime: boolean = true, shiftMillis: number = null, timeFormat: string = null, locale='en') {
        return (d) => {
            if (shiftMillis !== 0) {
                d = new Date(d.valueOf() + shiftMillis);
            }
            let stringFormat;
            if (timeFormat !== null) {
                stringFormat = timeFormat;
            } else {
                stringFormat = "L " + this.subDateTimeFormat(is24HourTime, usesSeconds, usesMillis);
            }
            if (typeof offset == 'string' && isNaN(offset as any)) {
                return moment.tz(d, 'UTC').tz(offset === 'Local' ? moment.tz.guess() : offset).locale(locale).format(stringFormat);
            } else {
                return moment.tz(d, "UTC").utcOffset(offset).locale(locale).format(stringFormat);
            }
        }
    }

    static splitTimeLabel (text: any) {

        let shouldSplit = (str) => {
            let splitLines = str.split(' ');
            return !((splitLines.length === 1) || (splitLines.length === 2 && (splitLines[1] === 'AM' || splitLines[1] === 'PM')));
        }

        text.each(function () {
            if(this.children == undefined || this.children.length == 0){  // don't split already split labels
                var text = d3.select(this);
                var lines = text.text().split(" ");
                var dy = parseFloat(text.attr("dy"));
                if (shouldSplit(text.text())) {
                    let newFirstLine = lines[0] + (lines.length === 3 ? (' ' + lines[1]) : '');
                    let newSecondLine = lines[lines.length - 1];
                    text.text(null).append("tspan")
                        .attr("x", 0)
                        .attr("y", text.attr("y"))
                        .attr("dy", dy + "em")
                        .text(newFirstLine);
                    text.append("tspan")
                        .attr("x", 0)
                        .attr("y", text.attr("y"))
                        .attr("dy", (dy + dy * 1.4) + "em")
                        .text(newSecondLine);    
                }
            }
        });
    }
    
    static getUTCHours (d: Date, is24HourTime: boolean = true) {
        var hours = d.getUTCHours();
        if (!is24HourTime) {
            if (hours == 0) 
                hours = 12;
            if (hours > 12) 
                hours = hours - 12;
        }
        return hours;
    }

    static UTCTwelveHourFormat (d: Date) {
        var hours: string = String(this.getUTCHours(d));
        var minutes: string = (d.getUTCMinutes() < 10 ? "0" : "") + String(d.getUTCMinutes());
        var amPm: string = (d.getUTCHours() < 12) ? "AM" : "PM";
        return hours + ":" + minutes + " " + amPm;
    }
    
    static getAgVisible(displayState: any, aggI: string, splitBy: string) {
        return (displayState[aggI].visible) ? displayState[aggI].splitBys[splitBy].visible : false;
    }
    static getAgVisibleMeasure(displayState: any, aggI: string, splitBy: string) {
        return displayState[aggI].splitBys[splitBy].visibleType;
    }

    static createSeriesTypeIcon(seriesType: string, selection: any): void {
        var g = selection.append("g")
            .style("position", "absolute");
        if (seriesType == "event") {
            g.attr("transform", "translate(7.5,0)")
                .append("rect")
                .attr("width", 7)
                .attr("height", 7)
                .attr("transform", "rotate(45)");
        } 
        else if (seriesType == "state") {
            g.append("rect")
                .attr("width", 15)
                .attr("height", 10);
        }
        else { // fxn
            g.append("path")
                .attr("d", "M0 5 Q 4 0, 8 5 T 16 5")
                .attr("fill", "none");
        }
    }

    static strip(text) {
        var div = document.createElement('div');
        div.innerHTML = text;
        var textContent = div.textContent || div.innerText || '';
        return textContent;
    }

    static stripForConcat(text) {
        var specialCharacters = ['"', "'", '?', '<', '>', ';'];
        specialCharacters.forEach(c => { text = text.split(c).join('') });
        return text;
    }

    static setSeriesLabelSubtitleText (subtitle, isInFocus: boolean = false) {
        let subtitleDatum = subtitle.data()[0];
        if (!subtitle.select('.tsi-splitBy').empty()) {
            let textAfterSplitByExists = subtitleDatum.timeShift !== '' || subtitleDatum.variableAlias;
            let splitByString = `${subtitleDatum.splitBy}${(textAfterSplitByExists && !isInFocus) ? ', ' : ''}`;
            Utils.appendFormattedElementsFromString(subtitle.select('.tsi-splitBy'), splitByString);
        }
        if (subtitle.select('.tsi-timeShift')) {
            subtitle.select('.tsi-timeShift')
                .text(d => {
                    return `${subtitleDatum.timeShift}${(subtitleDatum.variableAlias && !isInFocus) ? ', ' : ''}`;
                });
        }
        if (subtitle.select('.tsi-variableAlias')) {
            subtitle.select('.tsi-variableAlias')
                .text(d => subtitleDatum.variableAlias);
        }
    }

    static revertAllSubtitleText (markerValues, opacity = 1) {
        let self = this;
        markerValues.classed('tsi-isExpanded', false)
            .style('opacity', opacity)
            .each(function () {
                self.setSeriesLabelSubtitleText(d3.select(this).selectAll('.tsi-tooltipSubtitle'), false);
            });
    }

    static generateColors (numColors: number, includeColors: string[] = null) {
        let defaultColors = ['#008272', '#D869CB', '#FF8C00', '#8FE6D7', '#3195E3', '#F7727E', '#E0349E', '#C8E139', '#60B9AE', 
                             '#93CFFB', '#854CC7', '#258225', '#0078D7', '#FF2828', '#FFF100'];
        var postDefaultColors = d3.scaleSequential(d3.interpolateCubehelixDefault).domain([defaultColors.length -.5, numColors - .5]);
        var colors = [];
        let colorsIndex = 0;
        if(includeColors) {//add the colors we want to include first
            for(let i = 0; i < includeColors.length && colorsIndex < numColors; i++) {
                let color = includeColors[i];
                if (colors.indexOf(color) === -1) {
                    colors.push(color);
                    colorsIndex++;
                }
            }  
        } 
        for(let i = 0; colorsIndex < numColors; i++) {
            if (i < defaultColors.length) {
                if(colors.indexOf(defaultColors[i]) === -1) {
                    colors.push(defaultColors[i]);
                    colorsIndex++;
                }
            }
            else if(colors.indexOf(postDefaultColors(i)) === -1) {
                colors.push(postDefaultColors(i));
                colorsIndex++;
            }
        }
        return colors;
    }

    static convertFromLocal (date: Date) {
        return new Date(date.valueOf() - date.getTimezoneOffset() * 60 * 1000);
    }

    static adjustDateFromTimezoneOffset (date: Date) {
        let dateCopy = new Date(date.valueOf());
        dateCopy.setTime(dateCopy.getTime() + dateCopy.getTimezoneOffset()*60*1000 );
        return dateCopy;    
    }

    static offsetFromUTC (date: Date, offset = 0) {
        let offsetMinutes = Utils.getOffsetMinutes(offset, date.valueOf());
        var dateCopy = new Date(date.valueOf() + offsetMinutes * 60 * 1000);
        return dateCopy;    
    }

    static offsetToUTC (date: Date, offset = 0) {
        let offsetMinutes = Utils.getOffsetMinutes(offset, date.valueOf())
        var dateCopy = new Date(date.valueOf() - offsetMinutes * 60 * 1000);
        return dateCopy;    
    }


    static parseUserInputDateTime (timeText, offset) {
        let dateTimeFormat = "L " + this.subDateTimeFormat(true,true, true);
        let parsedDate = moment(timeText, dateTimeFormat).toDate();
        let utcDate = this.offsetToUTC(this.convertFromLocal(parsedDate), offset);
        return utcDate.valueOf();
    }
    
    static getBrighterColor (color: string) {
        let hclColor = <any>d3.hcl(color);
        if (hclColor.l < 80) {
            return hclColor.brighter().toString();
        } 
        return hclColor.toString();

    }

    static createSplitByColors(displayState: any, aggKey: string, ignoreIsOnlyAgg: boolean = false) {
        if (Object.keys(displayState[aggKey]["splitBys"]).length == 1) 
            return [displayState[aggKey].color];
        var isOnlyAgg: boolean = Object.keys(displayState).reduce((accum, currAgg): boolean => {
            if (currAgg == aggKey)
                return accum;
            if (displayState[currAgg]["visible"] == false) 
                return accum && true;
            return false;
        }, true);
        if (isOnlyAgg && !ignoreIsOnlyAgg) {
            return this.generateColors(Object.keys(displayState[aggKey]["splitBys"]).length);
        }
        var aggColor = displayState[aggKey].color;
        var interpolateColor = d3.scaleLinear().domain([0,Object.keys(displayState[aggKey]["splitBys"]).length])
            .range([<any>d3.hcl(aggColor).darker(), <any>d3.hcl(aggColor).brighter()]);
        var colors = [];
        for(var i = 0; i < Object.keys(displayState[aggKey]["splitBys"]).length; i++){
            colors.push(interpolateColor(i));
        }
        return colors;
    }

    static colorSplitBy(displayState: any, splitByIndex: number, aggKey: string, ignoreIsOnlyAgg: boolean = false) {
        if (Object.keys(displayState[aggKey]["splitBys"]).length == 1) 
            return displayState[aggKey].color;

        var isOnlyAgg: boolean = Object.keys(displayState).reduce((accum, currAgg): boolean => {
                        if (currAgg == aggKey)
                            return accum;
                        if (displayState[currAgg]["visible"] == false) 
                            return accum && true;
                        return false;
                    }, true);
            
        if (isOnlyAgg && !ignoreIsOnlyAgg) {
            var splitByColors = this.generateColors(Object.keys(displayState[aggKey]["splitBys"]).length);
            return splitByColors[splitByIndex];
        }

        var aggColor = displayState[aggKey].color;
        var interpolateColor = d3.scaleLinear().domain([0,Object.keys(displayState[aggKey]["splitBys"]).length])
            .range([<any>d3.hcl(aggColor).darker(), <any>d3.hcl(aggColor).brighter()])
        return interpolateColor(splitByIndex);
    }
    
    static getTheme(theme: any){
         return theme ? 'tsi-' + theme : 'tsi-dark';
    }
    
    static clearSelection(){
        var sel = window.getSelection ? window.getSelection() : (<any>document).selection;
        if (sel) {
            if (sel.removeAllRanges) {
                sel.removeAllRanges();
            } else if (sel.empty) {
                sel.empty();
            }
        }
    }

    static mark(filter, text){
        if(filter.length == 0)
            return text;
        var regExp = new RegExp(filter, 'gi');
        return text.replace(regExp, function(m){ return '<mark>'+m+'</mark>';});
    }

    static hash(str) {
        var hash = 5381,
            i    = str.length;
      
        while(i) {
          hash = (hash * 33) ^ str.charCodeAt(--i);
        }
      
        /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
         * integers. Since we want the results to be always positive, convert the
         * signed int to an unsigned by doing an unsigned bitshift. */
        return hash >>> 0;
      }
      

    static guid () {
        var  s4 = () => {
            return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
               s4() + '-' + s4() + s4() + s4();
    }

    static createValueFilter (aggregateKey, splitBy) {
        return (d: any, j: number ) => {
            var currAggKey: string;
            var currSplitBy: string;
            if (d.aggregateKey) {
                currAggKey = d.aggregateKey;
                currSplitBy = d.splitBy;
            } else  if (d && d.length){
                currAggKey = d[0].aggregateKey;
                currSplitBy = d[0].splitBy
            } else 
                return true;
            return (currAggKey == aggregateKey && (splitBy == null || splitBy == currSplitBy));
        }     
    } 

    static downloadCSV (csvString: string, csvName: string = "Table") {
        var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        var blobURL = window.URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", blobURL);
        link.setAttribute("download", csvName + ".csv");
        link.setAttribute("tabindex", "0");
        link.innerHTML= "";
        document.body.appendChild(link);
        link.click();
    }  

    static sanitizeString (str: any, type: String) {
        if (str === null || str === undefined) {
            return "";
        }
        if (type !== valueTypes.Double && type !== valueTypes.Long) {
            let jsonifiedString = type === valueTypes.Dynamic ? JSON.stringify(str) : String(str);
            if (jsonifiedString.indexOf(',') !== -1 || jsonifiedString.indexOf('"') !== -1 || jsonifiedString.indexOf('\n') !== -1 || type === valueTypes.Dynamic) {
                let replacedString = jsonifiedString.replace(/"/g, '""');
                return '"' + replacedString + '"';
           }
        }
        return str;
    }

    static focusOnEllipsisButton (renderTarget) {
        let ellipsisContainer = d3.select(renderTarget).select(".tsi-ellipsisContainerDiv");
        if (!ellipsisContainer.empty()) {
            (<any>ellipsisContainer.select(".tsi-ellipsisButton").node()).focus();
        }
    }

    static createDownloadEllipsisOption (csvStringGenerator, action = () => {}, downloadLabel = "Download as CSV") {
        return {
            iconClass: "download",
            label: downloadLabel,
            action:() => {
                Utils.downloadCSV(csvStringGenerator());
                action();  
            },
            description: ""
        };
    }


    static createControlPanel (renderTarget: any, legendWidth: number, topChartMargin: number, chartOptions: any) {
        d3.select(renderTarget).selectAll(".tsi-chartControlsPanel").remove();
        var controlPanelWidth = Math.max(1, (<any>d3.select(renderTarget).node()).clientWidth - 
                                            (chartOptions.legend == "shown" ? legendWidth : 0));
        var chartControlsPanel = d3.select(renderTarget).append("div")
            .attr("class", "tsi-chartControlsPanel")
            .style("width", controlPanelWidth + "px")
            .style("top", Math.max((topChartMargin - 32), 0) + "px");
            
        return chartControlsPanel;
    }

    static escapeQuotesCommasAndNewlines (stringToEscape: string) {
        var escapedString = "";
        if (stringToEscape && (stringToEscape.indexOf("\"") != -1 || 
                               stringToEscape.indexOf(",") != -1 || 
                               stringToEscape.indexOf("\n") != -1)) {
            stringToEscape = stringToEscape.replace(/"/g, "\"\"");
            escapedString += "\"";
            escapedString += stringToEscape;
            escapedString += "\"";
            return escapedString;
        }
        else {
            return stringToEscape;
        }
    };

    static getNonNumericHeight (rawHeight: number) {
        return rawHeight + NONNUMERICTOPMARGIN;
    }

    static getControlPanelWidth (renderTarget, legendWidth, isLegendShown) {
        return Math.max(1, (<any>d3.select(renderTarget).node()).clientWidth -
                (isLegendShown ? legendWidth : 0));
    };

    static getValueOrDefault (chartOptionsObj, propertyName, defaultValue = null) {
        let propertyValue = chartOptionsObj[propertyName];
        if (propertyValue == undefined){
            if (this[propertyName] == undefined)
                return defaultValue;
            return this[propertyName];
        } 
        return propertyValue;  
    }

    static safeNotNullOrUndefined (valueLambda) {
        try {
            let value = valueLambda();
            return !(value === null || value === undefined); 
        }
        catch (err){
            return false;
        }
    }

    static equalToEventTarget = (function (event)  {
        return (this == event.target);
    });

    static getAggKeys (data) {
        let aggregateCounterMap = {};
        return data.map((aggregate) => {
            var aggName: string = Object.keys(aggregate)[0];            
            let aggKey;
            if (aggregateCounterMap[aggName]) {
                aggKey = Utils.createEntityKey(aggName, aggregateCounterMap[aggName]);
                aggregateCounterMap[aggName] += 1;
            } else {
                aggKey = Utils.createEntityKey(aggName, 0);
                aggregateCounterMap[aggName] = 1;
            }
            return aggKey;
        });
    }

    static roundToMillis (rawTo, bucketSize) {
        return Math.ceil((rawTo + 62135596800000) / (bucketSize)) * (bucketSize) - 62135596800000;
    }

    static mergeSeriesForScatterPlot(chartData: any, scatterMeasures: any){
        let xMeasure = chartData[scatterMeasures.X_MEASURE], yMeasure = chartData[scatterMeasures.Y_MEASURE], rMeasure = chartData[scatterMeasures.R_MEASURE];

        let measureNames = Utils.getScatterPlotMeasureNames(chartData, scatterMeasures);

        // Create data label
        let xLabel = xMeasure.additionalFields.Variable.substring(0, 15) + (xMeasure.additionalFields.Variable.length > 15 ? "... vs" : " vs");
        let yLabel = " " + yMeasure.additionalFields.Variable.substring(0, 15) + (yMeasure.additionalFields.Variable.length > 15 ? "... " : "");
        let rLabel = (rMeasure != null ? " vs " + rMeasure.additionalFields.Variable.substring(0, 15) + (rMeasure.additionalFields.Variable.length > 15 ? "... " : "") : "");
        let dataTitle =  xLabel + yLabel + rLabel;
        
        // Initialize scatter plot data object
        let scatterData = {
            [dataTitle] : {
                "": {}
            }
        };

        // Create measure types
        let measureTypes = {
            X_MEASURE_TYPE: 'avg' in xMeasure.measureTypes ? xMeasure.measureTypes['avg'] : xMeasure.measureTypes[0],
            Y_MEASURE_TYPE: 'avg' in yMeasure.measureTypes ? yMeasure.measureTypes['avg'] : yMeasure.measureTypes[0],
            R_MEASURE_TYPE: null
        }

        // Takes query and returns normalized time data
        let normalizeTimestampKeys = (query) => {
            let newTS = {}
            Object.keys(query.data[query.alias][""]).forEach((key) => {
                let oldTime = new Date(key).valueOf();
                let timeShift = query.timeShift != "" ? this.parseShift(query.timeShift, query.startAt, query.searchSpan): 0;
                // Calculate real timeshift based on bucket snapping
                let bucketShiftInMillis =  this.adjustStartMillisToAbsoluteZero(timeShift, this.parseShift(query.searchSpan.bucketSize));
                let normalizedTime = oldTime - bucketShiftInMillis;
                let timestamp = new Date(normalizedTime).toISOString();

                newTS[timestamp] = query.data[query.alias][""][key];
            })
            return newTS;
        }

        // Normalize timestamp data
        xMeasure.data[xMeasure.alias][""] = normalizeTimestampKeys(xMeasure);
        yMeasure.data[yMeasure.alias][""] = normalizeTimestampKeys(yMeasure);
        if(rMeasure){
            rMeasure.data[rMeasure.alias][""] = normalizeTimestampKeys(rMeasure);
            measureTypes.R_MEASURE_TYPE = 'avg' in rMeasure.measureTypes ? rMeasure.measureTypes['avg'] : rMeasure.measureTypes[0]
        }

        // For each timestamp in X data mix measures of other series
        Object.keys(xMeasure.data[xMeasure.alias][""]).forEach((key) => {
            if(key in yMeasure.data[yMeasure.alias][""]){
                let measures = {}
                
                measures[measureNames.X_MEASURE] = xMeasure.data[xMeasure.alias][""][key][measureTypes.X_MEASURE_TYPE];
                measures[measureNames.Y_MEASURE] = yMeasure.data[yMeasure.alias][""][key][measureTypes.Y_MEASURE_TYPE];

                // Add optional R measure
                if(rMeasure != null && key in rMeasure.data[rMeasure.alias][""]){
                    measures[measureNames.R_MEASURE] = rMeasure.data[rMeasure.alias][""][key][measureTypes.R_MEASURE_TYPE];
                }

                // Discard timestamps with null valued measures
                if(xMeasure.data[xMeasure.alias][""][key][measureTypes.X_MEASURE_TYPE] && yMeasure.data[yMeasure.alias][""][key][measureTypes.Y_MEASURE_TYPE])
                {
                    if(rMeasure != null){
                        if(key in rMeasure.data[rMeasure.alias][""] && rMeasure.data[rMeasure.alias][""][key][measureTypes.R_MEASURE_TYPE])
                            scatterData[dataTitle][""][key] = measures;
                    }
                    else{
                        scatterData[dataTitle][""][key] = measures;
                    } 
                } 
            }
        });
        return scatterData;
    }

    static getScatterPlotMeasureNames(chartData: any, scatterMeasures: any){
        let uniqueNameMap = {}
        
        let xMeasureName = chartData[scatterMeasures.X_MEASURE].alias + " " + chartData[scatterMeasures.X_MEASURE].additionalFields.Variable + 
            (chartData[scatterMeasures.X_MEASURE].timeShift == "" ? "" : " " + chartData[scatterMeasures.X_MEASURE].timeShift);
        uniqueNameMap[xMeasureName] = 1;
        
        let yMeasureName = chartData[scatterMeasures.Y_MEASURE].alias + " " + chartData[scatterMeasures.Y_MEASURE].additionalFields.Variable + 
            (chartData[scatterMeasures.Y_MEASURE].timeShift == "" ? "" : " " + chartData[scatterMeasures.Y_MEASURE].timeShift);

        if(yMeasureName in uniqueNameMap){
            let tempName = yMeasureName;
            yMeasureName += " (" + uniqueNameMap[yMeasureName].toString() + ")";
            uniqueNameMap[tempName] = uniqueNameMap[tempName] + 1;
        } else{
            uniqueNameMap[yMeasureName] = 1;
        }

        let rMeasureName = chartData[scatterMeasures.R_MEASURE] ? chartData[scatterMeasures.R_MEASURE].alias + " " + chartData[scatterMeasures.R_MEASURE].additionalFields.Variable +
            (chartData[scatterMeasures.R_MEASURE].timeShift == "" ? "" : " " + chartData[scatterMeasures.R_MEASURE].timeShift) : null;

        if(rMeasureName != null){
            if(rMeasureName in uniqueNameMap){
                rMeasureName += " (" + uniqueNameMap[rMeasureName].toString() + ")";
            }
        }

        return {
            X_MEASURE: xMeasureName,
            Y_MEASURE: yMeasureName,
            R_MEASURE: rMeasureName ? rMeasureName : null
        }
    }

    static isKeyDownAndNotEnter = (e) => {
        if (e && e.type && e.type === 'keydown') {
            let key = e.which || e.keyCode;
            if (key !== 13) {
                return true;
            } else {
                e.preventDefault();
            }
        }
        return false;
    }

    static getMinWarmTime (warmStoreFrom, retentionString) {
        let minWarmTime = new Date(warmStoreFrom);
        if (retentionString !== null) {
            let retentionPeriod = Utils.parseTimeInput(retentionString);
            minWarmTime = new Date(Math.max(minWarmTime.valueOf(), (Date.now() - retentionPeriod)));
        }
        return minWarmTime;
    }

    static standardizeTSStrings (rawData) {
        let convertedData = [];
        rawData.forEach((dG, i) => {
            let dGName = Object.keys(dG)[0];
            let dataGroup = dG[dGName];
            let convertedDataGroup = {};
            let dataGroupKeyedObject = {};
            dataGroupKeyedObject[dGName] = convertedDataGroup;
            convertedData.push(dataGroupKeyedObject);
            if (dataGroup) {
                Object.keys(dataGroup).forEach((seriesName) => {
                    convertedDataGroup[seriesName] = {};
                    if (dataGroup[seriesName]) {
                        Object.keys(dataGroup[seriesName]).forEach((rawTS: string) => {
                            let isoString: string;
                            try {
                                isoString = (new Date(rawTS)).toISOString();
                                convertedDataGroup[seriesName][isoString] = dataGroup[seriesName][rawTS];
                            } catch(RangeError) {
                                console.log(`${rawTS} is not a valid ISO time`);
                            }
                        });
                    }
                });
            }
        });
        return convertedData;
    }

    // takes in an availability distribution and a min and max date, returns a tuple, where the first is the new distribution 
    // excluding values out of the range, and the second is all excluded values
    static cullValuesOutOfRange (availabilityDistribution: any, minDateString: string, maxDateString: string) {
        const dateZero = '0000-01-01T00:00:00Z';
        let minDateValue = new Date(minDateString).valueOf();
        let maxDateValue = new Date(maxDateString).valueOf();

        if (new Date(availabilityDistribution.range.from).valueOf() < minDateValue || 
            new Date(availabilityDistribution.range.to).valueOf() > maxDateValue) {

            let inRangeValues = {};
            let outOfRangeValues = {};
                    
            let highestNotOverMaxString = dateZero;
            let highestNotOverMaxValue = (new Date(highestNotOverMaxString)).valueOf();
            let lowestAboveMinValue = Infinity; 

            Object.keys(availabilityDistribution.distribution).forEach((bucketKey: string) => {
                let bucketValue = (new Date(bucketKey)).valueOf();
                if (bucketValue > maxDateValue || bucketValue < minDateValue) {
                    outOfRangeValues[bucketKey] = availabilityDistribution.distribution[bucketKey]; 
                } else {
                    inRangeValues[bucketKey] = availabilityDistribution.distribution[bucketKey];
                    if (bucketValue > highestNotOverMaxValue) {
                        highestNotOverMaxValue = bucketValue;
                        highestNotOverMaxString = bucketKey;
                    }
                    if (bucketValue < lowestAboveMinValue) {
                        lowestAboveMinValue = bucketValue
                    }
                }
            });

            const bucketSize = this.parseTimeInput(availabilityDistribution.intervalSize);
            
            if (highestNotOverMaxString !== dateZero) { // a value exists 
                let nowMillis = new Date().valueOf();
                if(highestNotOverMaxValue < nowMillis && (highestNotOverMaxValue + bucketSize) > nowMillis){
                    // the new end value was before now, but after adding bucket size, its after now
                    // so we set it to now to avoid setting it to a date in the future
                    availabilityDistribution.range.to = new Date(nowMillis).toISOString();
                }
                else{
                    availabilityDistribution.range.to = new Date(highestNotOverMaxValue + bucketSize).toISOString();
                }
            } else {
                let rangeToValue: number = (new Date(availabilityDistribution.range.to)).valueOf();
                if (minDateValue > rangeToValue) { // entire window is to the right of distribution range
                    availabilityDistribution.range.to = maxDateString;
                } else {
                    let toValue = Math.min(maxDateValue + bucketSize, (new Date(availabilityDistribution.range.to)).valueOf()); //clamped to maxDateString passed in
                    availabilityDistribution.range.to = (new Date(toValue)).toISOString();    
                }
            }

            if (lowestAboveMinValue !== Infinity) { // a value exists
                availabilityDistribution.range.from = (new Date(lowestAboveMinValue)).toISOString();
            } else { 
                let rangeFromValue: number = (new Date(availabilityDistribution.range.from)).valueOf();
                if (maxDateValue < (new Date(availabilityDistribution.range.from)).valueOf()) { // entire window is to the left of distribution range
                    availabilityDistribution.range.from = minDateString;
                } else {
                    let fromValue = Math.max(minDateValue, rangeFromValue); // clamped to minDateString passed in
                    availabilityDistribution.range.from = (new Date(fromValue)).toISOString();                        
                }
            }
            availabilityDistribution.distribution = inRangeValues;
            return[availabilityDistribution, outOfRangeValues];
        }
        return [availabilityDistribution, {}];
    }
    
    static mergeAvailabilities (warmAvailability, coldAvailability, retentionString = null) {
        let warmStoreRange = warmAvailability.range;
        let minWarmTime = this.getMinWarmTime(warmStoreRange.from, retentionString);
        let warmStoreToMillis = new Date(warmStoreRange.to).valueOf();
        let coldStoreToMillis = new Date(coldAvailability.range.to).valueOf();

        // snap warm availability to cold availability if its ahead of cold
        let maxWarmTime = new Date(Math.min(warmStoreToMillis, coldStoreToMillis));

        let mergedAvailability = Object.assign({}, coldAvailability);
        mergedAvailability.warmStoreRange = [minWarmTime.toISOString(), maxWarmTime.toISOString()];
        if (retentionString !== null) {
            mergedAvailability.retentionPeriod = retentionString;
        }
        return mergedAvailability;
    }

    static languageGuess () {
        return navigator.languages && navigator.languages[0] || // Chrome / Firefox
        navigator.language; // All browsers
    }

    static getInstanceKey = (instance) => { // for keying instances using timeseriesid to be used data object to render hierarchy navigation
        return Utils.instanceHasEmptyTSID(instance) ? Utils.guid() : instance.timeSeriesId.map(id => id === null ? Utils.guidForNullTSID : id).join();
    }

    static stripNullGuid = (str) => { // for replacing guids for null tsid in alias etc. with its display string
        return str.replace(Utils.guidForNullTSID, nullTsidDisplayString);
    }

    static getTimeSeriesIdString = (instance) => { // for arialabel and title 
        return instance.timeSeriesId.map(id => id === null ? nullTsidDisplayString : id).join(', ');
    }

    static getTimeSeriesIdToDisplay = (instance, emptyDisplayString) => { // time series id to be shown in UI
        return Utils.instanceHasEmptyTSID(instance) ? emptyDisplayString : instance.timeSeriesId.map(id => id === null ? Utils.guidForNullTSID : id).join(', ');
    }

    static getHighlightedTimeSeriesIdToDisplay = (instance) => { // highlighted time series ids (including hits) to be shown in UI
        return instance.highlights?.timeSeriesId.map((id, idx) => instance.timeSeriesId[idx] === null ? Utils.guidForNullTSID : id).join(', ');
    }

    static instanceHasEmptyTSID = (instance) => {
        return !instance.timeSeriesId || instance.timeSeriesId.length === 0;
    }
    
    // appends dom elements of stripped strings including hits (for instance search results) and mono classed spans (for null tsid)
    static appendFormattedElementsFromString = (targetElem, str, options: {additionalClassName?: string, inSvg?: boolean, splitByTag?: string} = null) => {
        interface FormattedElemData {
            str: string;
            isHit?: boolean;
            isNull?: boolean;
        };

        let data : Array<FormattedElemData> = [];
        let splitByNullGuid = (str) : Array<any> => {
            let data = [];
            let splittedByNull = str.split(Utils.guidForNullTSID);
            splittedByNull.forEach((s, i) => {
                if (i === 0) { 
                    if (s) {
                        data.push({str: s});
                    }
                } else {
                    data.push({str: nullTsidDisplayString, isNull: true});
                    if (s) {
                        data.push({str: s});
                    }
                }
            });
            return data;
        }

        let splitByTag = options && options.splitByTag ? options.splitByTag : 'hit';
        let splittedByHit = str.split(`<${splitByTag}>`);
        splittedByHit.forEach((s, i) => {
            if (i === 0) {
                data = data.concat(splitByNullGuid(s));
            } else {
                let splittedByHitClose = s.split(`</${splitByTag}>`);
                data.push({str: splittedByHitClose[0], isHit: true});
                data = data.concat(splitByNullGuid(splittedByHitClose[1]));
            }
        });

        let additionalClassName = options && options.additionalClassName ? options.additionalClassName : '';
        let children = targetElem.selectAll('.tsi-formattedChildren').data(data);
        children.enter()
            .append(d => 
                d.isHit ? document.createElement('mark')
                : options && options.inSvg ? document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
                    : document.createElement('span')
            )
            .classed('tsi-formattedChildren', true)
            .merge(children)
            .classed('tsi-baseMono', d => d.isNull)
            .classed(additionalClassName, options && options.additionalClassName)
            .text(d => d.str);
        children.exit().remove();
    }

    static escapedTsidForExactSearch = (tsid: string) => {
        let escapedTsid = tsid || '';
        if (tsid) {
            CharactersToEscapeForExactSearchInstance.forEach(c => { //escaping some special characters with + for exact instance search in quotes
                escapedTsid = escapedTsid.split(c).join('+');
            });
        }
        return escapedTsid;
    }

    static memorySizeOf (obj) {
        let bytes = 0;

        let sizeOf = (obj) => {
            if (obj !== null && obj !== undefined) {
                switch (typeof obj) {
                    case 'number':
                        bytes += 8;
                        break;
                    case 'string':
                        bytes += obj.length * 2;
                        break;
                    case 'boolean':
                        bytes += 4;
                        break;
                    case 'object':
                        let objClass = Object.prototype.toString.call(obj).slice(8, -1);
                        if (objClass === 'Object' || objClass === 'Array') {
                            for (let key in obj) {
                                if (!obj.hasOwnProperty(key)) {continue; }
                                sizeOf(key);
                                sizeOf(obj[key]);
                            }
                        } else {
                            bytes += obj.toString().length * 2;
                        }
                        break;
                }
            }
            return bytes;
        };

        return sizeOf(obj);
    }
}
import * as d3 from 'd3';
import * as momentTZ from 'moment-timezone';
import {Grid} from "./Components/Grid/Grid";
import { ChartComponent } from './Interfaces/ChartComponent';

class Utils {
    static formatYAxisNumber (val: number) {
        if (Math.abs(val) < 1000000)
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
        else if (Math.abs(val) >= 1000000 && Math.abs(val) < 1000000000)
            return d3.format('.3s')(val); // suffix of M for millions
        else if (Math.abs(val) >= 1000000000 && Math.abs(val) < 1000000000000)
            return d3.format('.3s')(val).slice(0, -1) + 'B'; // suffix of B for billions
        return d3.format('.2n')(val); // scientific for everything else
    }

    // format [0-9]+[ms|s|m|h|d], convert to millis
    static parseTimeInput (inputString) {
        if (inputString.indexOf('ms') == inputString.length - 2) {
            return Number(inputString.slice(0, inputString.length - 2));
        }
        if (inputString.indexOf('s') == inputString.length - 1) {
            return Number(inputString.slice(0, inputString.length - 1)) * 1000;
        }
        if (inputString.indexOf('m') == inputString.length - 1) {
            return Number(inputString.slice(0, inputString.length - 1)) * 60 * 1000;
        }
        if (inputString.indexOf('h') == inputString.length - 1) {
            return Number(inputString.slice(0, inputString.length - 1)) * 60 * 60 * 1000;
        }
        if (inputString.indexOf('d') == inputString.length - 1) {
            return Number(inputString.slice(0, inputString.length - 1)) * 24 * 60 * 60 * 1000;
        }
        return -1;
    }

    static bucketSizeToTsqInterval (bucketSize: string) {
        return ('PT' + bucketSize).toUpperCase();
    }

    static createEntityKey (aggName: string, aggIndex: number) {
        return encodeURIComponent(aggName).split(".").join("_") + "_" + aggIndex;
    }


    static getOffsetMinutes(offset: any, millis: number) {
        if (typeof offset == "string") {
            return -momentTZ.tz.zone(offset).parse(millis);
        } else {
            return offset;
        }
    }

    // inverse of getOffsetMinutes, this is the conversion factor of an offsettedTime to UTC in minutes 
    static getMinutesToUTC (offset: any, millisInOffset: number) {
        if (typeof offset == "string") {
            return momentTZ.tz.zone(offset).utcOffset(millisInOffset);
        } else {
            return -offset;
        }
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
        var millis = rangeMillis % 1000;

        if (rangeMillis >= oneDay) {
            return days + "d " + (hours > 0 ? (hours + "h") : "");
        } else if (rangeMillis >= oneHour) {
            return hours + "h " + (minutes > 0 ? (minutes + "m") : "");
        } else if (rangeMillis >= oneMinute) {
            return minutes + "m " + (seconds > 0 ? (seconds + "s") : "");
        }
        return seconds + (millis != 0 ? "." + millis : "") + "s";
    }

    
    static timeFormat(usesSeconds = false, usesMillis = false, offset: any = 0, is24HourTime: boolean = true) {
        return (d) => {
            var stringFormat = "MM/DD/YYYY " + (is24HourTime ? "HH" : "hh") + ":mm" + 
                (usesSeconds ? (":ss" + (usesMillis ? ".SSS" : "")) : "") + (is24HourTime ? "" : " A");
            if (typeof offset == "string") {
                return momentTZ.tz(d, "UTC").tz(offset).format(stringFormat);
            } else {
                return momentTZ.tz(d, "UTC").utcOffset(offset).format(stringFormat);
            }
        }
    }

    static splitTimeLabel (text: any) {
        text.each(function () {
            if(this.children == undefined || this.children.length == 0){  // don't split already split labels
                var text = d3.select(this);
                var lines = text.text().split(" ");
                var dy = parseFloat(text.attr("dy"));
                text.text(null).append("tspan")
                    .attr("x", 0)
                    .attr("y", text.attr("y"))
                    .attr("dy", dy + "em")
                    .text(lines[0]);
                text.append("tspan")
                    .attr("x", 0)
                    .attr("y", text.attr("y"))
                    .attr("dy", (dy + dy * 1.4) + "em")
                    .text(lines[1]);
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

    static stripForConcat(text) {
        var specialCharacters = ['"', "'", '?', '<', '>', ';'];
        specialCharacters.forEach(c => { text = text.split(c).join('') });
        return text;
    }

    static generateColors (numColors: number) {
        let defaultColors = ['#008272', '#D869CB', '#FF8C00', '#8FE6D7', '#3195E3', '#F7727E', '#E0349E', '#C8E139', '#60B9AE', 
                             '#93CFFB', '#854CC7', '#258225', '#0078D7', '#FF2828', '#FFF100'];
        var postDefaultColors = d3.scaleSequential(d3.interpolateCubehelixDefault).domain([defaultColors.length -.5, numColors - .5]);
        var colors = [];
        for (var i = 0; i < numColors; i++) {
            if (i < defaultColors.length)
                colors.push(defaultColors[i])
            else
                colors.push(postDefaultColors(i));
        }
        return colors;
    }

    static createGridButton(chartControlsPanel: any, component: ChartComponent, usesSeconds: boolean = false, usesMillis: boolean = false, chartMargins: any) {
        var showGrid = () => {
            component.chartOptions.fromChart = true; 
            var gridComponent: Grid = new Grid(component.renderTarget);
            gridComponent.usesSeconds = component.chartComponentData.usesSeconds;
            gridComponent.usesMillis = component.chartComponentData.usesMillis; 
            var grid = gridComponent.renderFromAggregates(component.chartComponentData.data, component.chartOptions, component.aggregateExpressionOptions);
            grid.focus();
        }

        var gridButton = chartControlsPanel.append("div")
            .style("right", chartMargins.right + "px")
            .attr("class", "tsi-gridButton")
            .attr("tabindex", 0)
            .on("click", showGrid)
            .on("keydown", () => {
                if(d3.event.code == 'Enter')
                    showGrid();
            })
            .attr('title', 'Show a grid of values');
            
        return gridButton; 
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
        var regExp = new RegExp(filter, 'i');
        return text.replace(regExp, function(m){ return '<mark>'+m+'</mark>';});
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

    static downloadCSV (csvString: string) {
        var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        var blobURL = window.URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", blobURL);
        link.setAttribute("download", "Table.csv");
        link.innerHTML= "";
        document.body.appendChild(link);
        link.click();
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
}

export {Utils};
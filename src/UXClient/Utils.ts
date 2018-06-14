import * as d3 from 'd3';
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

    static createEntityKey (aggName: string, aggIndex: number) {
        return encodeURIComponent(aggName).split(".").join("_") + "_" + aggIndex;
    }
    
    static timeFormat(usesSeconds = false, usesMillis = false) {
        if (usesMillis)
            return d3.utcFormat("%x %H:%M:%S:%L");
        if (usesSeconds)
            return d3.utcFormat("%x %H:%M:%S")
        return d3.utcFormat("%x %H:%M");
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
 
    static createStackedButton(svgSelection: any) {
        var stackedButton = svgSelection.append("g")
            .attr("class", "stacked");
        var stackedIconG = stackedButton.append("g").attr("transform", "scale(.32), translate(-24, -20)");//, translate(-24px,-20px)"); 
        stackedIconG.append("path")
            .attr("d", "M22.33,39.28,49.61,50.92a1,1,0,0,0,.79,0L77.67,39.28a1,1,0,0,0,0-1.84L50.39,25.81a1,1,0,0,0-.79,0L22.33,37.44a1,1,0,0,0,0,1.84ZM50,27.81,74.72,38.36,50,48.91,25.28,38.36Z")
        stackedIconG.append("path")
            .attr("d", "M76.88,60.72,50,72.19,23.12,60.72a1,1,0,0,0-.79,1.84L49.61,74.19a1,1,0,0,0,.79,0L77.67,62.56a1,1,0,1,0-.79-1.84Z")
        stackedIconG.append("path")
            .attr("d", "M78.19,49.61a1,1,0,0,0-1.31-.53L50,60.55,23.12,49.08a1,1,0,1,0-.79,1.84L49.61,62.56a1,1,0,0,0,.79,0L77.67,50.92A1,1,0,0,0,78.19,49.61Z")
        stackedButton.append("rect")
            .attr('width', 20)
            .attr('height', 20)
            .attr('transform', 'translate(-1,-1)');
        return stackedButton;
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

    static createGridButton(svgSelection: any, component: ChartComponent, usesSeconds: boolean = false, usesMillis: boolean = false) {                
        var gridButton = svgSelection.append("g")
                                .attr("class", "tsi-gridButton");
        var gridIconG = gridButton.append("g");
        gridIconG.append("path")
                .attr("d", "M 0 1 V 15 H 16 V 1 H 0 Z M 1 6 H 3 V 8 H 1 V 6 Z M 12 8 H 10 V 6 h 2 V 8 Z M 7 9 H 9 v 2 H 7 V 9 Z M 6 11 H 4 V 9 H 6 v 2 Z m 4 -2 h 2 v 2 H 10 V 9 Z M 9 8 H 7 V 6 H 9 V 8 Z M 6 8 H 4 V 6 H 6 V 8 Z M 1 9 H 3 v 2 H 1 V 9 Z m 0 5 V 12 H 3 v 2 H 1 Z m 3 0 V 12 H 6 v 2 H 4 Z m 3 0 V 12 H 9 v 2 H 7 Z m 3 0 V 12 h 2 v 2 H 10 Z m 5 0 H 13 V 12 h 2 v 2 Z m 0 -3 H 13 V 9 h 2 v 2 Z m 0 -3 H 13 V 6 h 2 V 8 Z M 1 5 V 2 H 15 V 5 H 1 Z")
        var showChart = () => {
            component.chartOptions['fromChart'] = true; 
            var gridComponent: Grid = new Grid(component.renderTarget);
            gridComponent.usesSeconds = usesSeconds;
            gridComponent.usesMillis = usesMillis; 
            var grid = gridComponent.renderFromAggregates(component.chartComponentData.data, component.chartOptions, component.aggregateExpressionOptions);
            grid.focus();
        }
        gridIconG.append("rect")
                .attr('width', 20)
                .attr('height', 20)
                .attr('transform', 'translate(-2,-1)')
                .attr("tabindex", 0)
                .on("click", showChart)
                .on("keydown", () => {
                    if(d3.event.code == 'Enter')
                        showChart()
                });
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
}

export {Utils};
import * as d3 from 'd3';
import './Grid.scss';
import {Utils, DataTypes} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { ChartComponentData } from '../../Models/ChartComponentData';

class Grid extends Component {
	private gridComponent: any;
	private rowLabelKey: string = "__tsiLabel__";
	private colorKey: string = "__tsiColor__";
	private aggIndexKey: string = '__tsiAggIndex__';
    private chartComponentData: ChartComponentData = new ChartComponentData();
    private draw;
    private closeButton = null;

    private table;
    private tableHeaderRow;
    private tableContentRows;

	public usesSeconds: boolean = false;
	public usesMillis:boolean = false;

	constructor(renderTarget: Element){
		super(renderTarget);
	}

	Grid() {
	}

	private cellClass = (ridx, cidx) => {
		return "tsi-table-" + ridx + '-' + cidx;
	}

	public focus = (rowIdx, colIdx) => { 
		try {
			(<any>this.gridComponent.select('.' + this.cellClass(rowIdx, colIdx)).node())
				.focus();
	 	} catch(e) {
			console.log(e);
		}
	}
	
	public renderFromAggregates(data: any, options: any, aggregateExpressionOptions: any, chartComponentData) {
		this.chartOptions.setOptions(options);
		var dataAsJson = data.reduce((p,c,i) => {
			var aeName = Object.keys(c)[0]; 
			Object.keys(c[aeName]).forEach(sbName => {
				var row = {};
				Object.keys(c[aeName][sbName]).forEach(dt => {
					row[dt] = c[aeName][sbName][dt];
				})
				row[this.rowLabelKey] = (Object.keys(c[aeName]).length == 1 && sbName == "" ? aeName : sbName);
				if(aggregateExpressionOptions[i].color)
					row[this.colorKey] = aggregateExpressionOptions[i].color;
				row[this.aggIndexKey] = i;
				p.push(row);
			})
			return p;
		},[]);
		return this.render(dataAsJson, options, aggregateExpressionOptions, chartComponentData);
    }
    
    private getRowData () {
        let rowData = [];
        Object.keys(this.chartComponentData.timeArrays).forEach((aggKey) => {
            Object.keys(this.chartComponentData.timeArrays[aggKey]).forEach((sb,sbI) => {
                rowData.push([aggKey, sb]);
            })            
        });
        return rowData;

    }

    private convertSeriesToGridData (allTimeStampMap, currSeries) {
        currSeries.map((dataPoint) => {
            allTimeStampMap[dataPoint.dateTime.toISOString()] = dataPoint;
        });

        return Object.keys(allTimeStampMap).map((ts) => {
            return allTimeStampMap[ts];
        });
    }

    private addHeaderCells () {
        let headerCellData = this.chartComponentData.allTimestampsArray;
        let headerCells = this.tableHeaderRow.selectAll('.tsi-headerCell').data(headerCellData);
        headerCells.enter()
            .append('th')
            .attr("tabindex", 1)
            .merge(headerCells)
            .attr("class", (d, i) => this.cellClass(0, i+1) + ' tsi-headerCell')
            .on("keydown", (d, i) => {this.arrowNavigate(d3.event, 0, i+1)})
            .text((h, i) => {
                var hAsDate = <any>(new Date(h));
                if(hAsDate != this.getString('Invalid Date'))
                    return Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(hAsDate);
                return h;
            });
    }

    private addValueCells () {
        let rowData = this.getRowData();
        let rows = this.table.selectAll('.tsi-gridContentRow').data(rowData);
        let self = this;
        let allTimeStampMap = self.chartComponentData.allTimestampsArray.reduce((tsMap, ts) => {
            tsMap[ts] = {};
            return tsMap;
        }, {});

        let rowsEntered = rows.enter()
            .append('tr')
            .classed('tsi-gridContentRow', true)
            .each(function(d, i) {
                let aggKey = d[0];
                let splitBy = d[1];
                let seriesData = self.convertSeriesToGridData(allTimeStampMap, self.chartComponentData.timeArrays[aggKey][splitBy]);
                let cells = d3.select(this).selectAll('.tsi-valueCell').data(seriesData);
                let measuresData = self.chartComponentData.displayState[aggKey].splitBys[splitBy].types;

                //Row header with the name of the series
                let headerCell = d3.select(this).selectAll('tsi-rowHeaderCell').data([d]);
                headerCell.enter()  
                    .append('td')
                    .attr("tabindex", 1)
                    .merge(headerCell)
                    .attr('class', (d, col) => `tsi-rowHeaderCell ${self.cellClass(i + 1, 0)}`)
                    .on("keydown", (d, col) => {self.arrowNavigate(d3.event, i + 1, 0)})
                    .each(function (d) {
                        d3.select(this).select('*').remove();
                        let container = d3.select(this).append('div').attr('class', 'tsi-rowHeaderContainer');
                        container.append('div')
                            .attr('class', 'tsi-rowHeaderSeriesName')
                            .text(`${self.chartComponentData.displayState[aggKey].name}${(splitBy !== '' ? (': ' + splitBy) : '')}`);
                        let measureContainer = container.append('div')
                            .attr('class', 'tsi-rowHeaderMeasures');

                        let measureNames = measureContainer.selectAll('.tsi-measureName').data(measuresData);
                        measureNames.enter()
                            .append('div')
                            .attr('class', 'tsi-measureName')
                            .html((d: any) => d);
                    })
                headerCell.exit().remove();

                cells.enter()
                    .append('td')
                    .merge(cells)
                    .attr('class', (d, col) => `tsi-valueCell ${self.cellClass(i + 1, col + 1)}`)
                    .on("keydown", (d, col) => {self.arrowNavigate(d3.event, i + 1, col + 1)})
                    .attr("tabindex", 1)
                    .each(function (d: any, i) {                        
                        let measures = d3.select(this).selectAll('.tsi-measureValue').data(measuresData);
                        measures.enter()
                            .append('div')
                            .attr('class', 'tsi-measureValue')
                            .html((measure: string) => d.measures ? d.measures[measure] : '&nbsp;');
                        measures.exit().remove(); 
                    });
                cells.exit().remove();
            });

        rowsEntered.exit().remove();
    }
	
	public render(data: any, options: any, aggregateExpressionOptions: any, chartComponentData: ChartComponentData = null) {
        this.chartOptions.setOptions(options);
        this.gridComponent = d3.select(this.renderTarget);
        if (chartComponentData) {
            this.chartComponentData = chartComponentData    
        } else {
            this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
        }

        super.themify(this.gridComponent, this.chartOptions.theme);        

		if(this.gridComponent.style("position") == "static")
            this.gridComponent.style("position", "relative")
        this.gridComponent
            .classed("tsi-gridComponent", true)
            .classed("tsi-fromChart", !!options.fromChart)
            .attr("aria-label", "A grid of values.  Use tab to enter, and the arrow keys to navigate the values of each cell");
		var grid = this.gridComponent
			.append('div')
			.attr("class", "tsi-gridWrapper")
			.attr("tabindex", 0)
			.on("click", () => { 
				if (this) {
					this.focus(0,0);
				} 
            });
            
		var headers = Object.keys(data.reduce((p,c) => {
			Object.keys(c).forEach(k => {
				if(k != this.rowLabelKey && k != this.colorKey)
					p[k] = true;
			})
			return p;
        }, {})).sort();
        
        if (!this.table) {
            this.table = grid.append('table').classed('tsi-gridTable', true);
            this.tableHeaderRow = this.table.append('tr').classed('tsi-gridHeaderRow', true);
            this.tableHeaderRow.append('th').attr("tabindex", 0).attr("class", "tsi-topLeft " + this.cellClass(0,0)).on("keydown", () => {this.arrowNavigate(d3.event, 0, 0)}).attr("aria-label", "A grid of values.  Use the arrow keys to navigate the values of each cell");
        }

        this.addHeaderCells();
        this.addValueCells();

        if (this.chartOptions.fromChart) {
            this.gridComponent.selectAll('.tsi-closeButton').remove();
            this.closeButton = grid.append('button')
                .attr("class", "tsi-closeButton")
                .html('&times')
                .on('keydown', () => {
                    if (d3.event.keyCode === 9) {
                        this.focus(0, 0);
                        d3.event.preventDefault();
                    }
                })
                .on("click", () => {
                    if(!!options.fromChart) {
                        Utils.focusOnEllipsisButton(this.renderTarget.parentNode);
                        this.gridComponent.remove();
                    }
                });
        } 
    }

    private arrowNavigate = (d3event: any, rowIdx: number, colIdx: number) => {
        if(d3event.keyCode === 9){
            if (this.closeButton){
                (this.closeButton.node()).focus();
                d3event.preventDefault();
            } 
            return;
        }
        var codes = [37, 38, 39, 40];
        var codeIndex = codes.indexOf(d3event.keyCode);
        if(codeIndex == -1)
            return;
        switch(codeIndex){
            case 0:
                this.focus(rowIdx, colIdx - 1);
                d3event.preventDefault();
                break;
            case 1:
                this.focus(rowIdx - 1, colIdx);
                d3event.preventDefault();
                break;
            case 2:
                this.focus(rowIdx, colIdx + 1);
                d3event.preventDefault();
                break;
            case 3:
                this.focus(rowIdx + 1, colIdx);
                d3event.preventDefault();
                break;
            default:
                break;
        }
    }
		
    private getAriaLabel = (rowLabel, colLabel, rowIdx, colIdx, valuesObject) => {
        let text = '';
        if (valuesObject) {
            text = typeof(valuesObject) != 'string' ? ('values ' + (Object.keys(valuesObject).reduce((p,c) => {
                p += ", " + c + ", " + valuesObject[c];
                return p;
            }, ""))) : valuesObject
        }
        return "Cell in row " + (rowIdx) + ", column " + colIdx + ".  " + (rowLabel.length ? ("Row is labeled " + rowLabel) : '') + " in column named " + colLabel + " with  " +
        text;
    }
}

export {Grid}

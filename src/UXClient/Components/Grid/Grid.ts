import * as d3 from 'd3';
import './Grid.scss';
import Utils from "../../Utils";
import { Component } from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { ChartComponentData } from '../../Models/ChartComponentData';
import { GRIDCONTAINERCLASS } from '../../Constants/Constants';

class Grid extends Component {
	private gridComponent: any;
	private rowLabelKey: string = "__tsiLabel__";
	private colorKey: string = "__tsiColor__";
	private aggIndexKey: string = '__tsiAggIndex__';
    private chartComponentData: ChartComponentData = new ChartComponentData();
    private draw;
    private closeButton = null;
    private filteredTimestamps;

    private table;
    private tableHeaderRow;
    private tableContentRows;

	public usesSeconds: boolean = false;
	public usesMillis:boolean = false;

	constructor(renderTarget: Element){
		super(renderTarget);
    }
    
    static hideGrid (renderTarget: any) {
        d3.select(renderTarget).selectAll(`.${GRIDCONTAINERCLASS}`).remove();
    }

    static showGrid(renderTarget: any, chartOptions: ChartOptions, aggregateExpressionOptions: any, 
            chartComponentData: ChartComponentData) {
        chartOptions.fromChart = true; 
        d3.select(renderTarget).selectAll(`.${GRIDCONTAINERCLASS}`).remove();
        let gridContainer: any = d3.select(renderTarget).append('div')
                .attr('class', GRIDCONTAINERCLASS)
                .style('width', '100%')
                .style('height', '100%');

        var gridComponent: Grid = new Grid(gridContainer.node());
        gridComponent.usesSeconds = chartComponentData.usesSeconds;
        gridComponent.usesMillis = chartComponentData.usesMillis; 
        var grid = gridComponent.renderFromAggregates(chartComponentData.data, chartOptions, aggregateExpressionOptions, chartComponentData);
        gridComponent.focus(0,0);
    }

    static createGridEllipsisOption (renderTarget: any, chartOptions: ChartOptions, aggregateExpressionOptions: any, 
                                     chartComponentData: ChartComponentData, labelText = 'Display Grid') {
        return {
            iconClass: "grid",
            label: labelText,
            action: () => { 
                this.showGrid(renderTarget, chartOptions, aggregateExpressionOptions, chartComponentData);
            },
            description: ""
        };
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
				if(aggregateExpressionOptions && aggregateExpressionOptions[i].color)
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
                if (this.chartComponentData.getSplitByVisible(aggKey, sb)) {
                    rowData.push([aggKey, sb]);
                } 
            })            
        });
        return rowData;
    }

    private convertSeriesToGridData (allTimeStampMap, currSeries) {
        Object.keys(allTimeStampMap).forEach(k => allTimeStampMap[k] = {});
        currSeries = currSeries.filter((d) => {
            return d.measures !== null;
        })
        currSeries.map((dataPoint) => {
            allTimeStampMap[dataPoint.dateTime.toISOString()] = dataPoint;
        });
        return Object.keys(allTimeStampMap).map((ts) => {
            return allTimeStampMap[ts];
        });
    }

    private getFormattedDate = (h) => {
        var hAsDate = <any>(new Date(h));
        if(hAsDate != this.getString('Invalid Date'))
            return Utils.timeFormat(this.usesSeconds, this.usesMillis, this.chartOptions.offset, null, null, null, this.chartOptions.dateLocale)(hAsDate);
        return h;
    }

    private setFilteredTimestamps = () => {
        if (this.chartComponentData.fromMillis === Infinity) {
            this.filteredTimestamps = this.chartComponentData.allTimestampsArray;
        } else {
            this.filteredTimestamps = this.chartComponentData.allTimestampsArray.filter((ts) => {
                let currMillis = (new Date(ts)).valueOf();
                return (currMillis >= this.chartComponentData.fromMillis && currMillis < this.chartComponentData.toMillis); 
            });    
        }
    }

    private addHeaderCells () {
        let headerCellData = this.filteredTimestamps;// this.chartComponentData.allTimestampsArray;
        let headerCells = this.tableHeaderRow.selectAll('.tsi-headerCell').data(headerCellData);
        let headerCellsEntered = headerCells.enter()
            .append('th')
            .attr("tabindex", 1)
            .merge(headerCells)
            .attr("class", (d, i) => this.cellClass(0, i+1) + ' tsi-headerCell')
            .on("keydown", (event, d) => {
                const e = headerCellsEntered.nodes();
                const i = e.indexOf(event.currentTarget);
                this.arrowNavigate(event, 0, i+1)
            })
            .text(this.getFormattedDate)
            .attr('aria-label', (h) => {
                return `${this.getString('column header for date')} ${this.getFormattedDate(h)}`
            });
        headerCellsEntered.exit().remove();
    }

    private addValueCells () {
        let rowData = this.getRowData();
        let rows = this.table.selectAll('.tsi-gridContentRow').data(rowData);
        let self = this;
        let allTimeStampMap = this.filteredTimestamps.reduce((tsMap, ts) => {
            tsMap[ts] = {};
            return tsMap;
        }, {});

        let headerCellData = this.filteredTimestamps;

        let rowsEntered = rows.enter()
            .append('tr')
            .classed('tsi-gridContentRow', true)
            .each(function(d, i) {
                let aggKey = d[0];
                let splitBy = d[1];
                let seriesData = self.convertSeriesToGridData(allTimeStampMap, self.chartComponentData.timeArrays[aggKey][splitBy]);
                let cells = d3.select(this).selectAll<any, unknown>('.tsi-valueCell').data(seriesData);
                let measuresData = self.chartOptions.spMeasures ? self.chartOptions.spMeasures : self.chartComponentData.displayState[aggKey].splitBys[splitBy].types;

                //Row header with the name of the series
                let headerCell = d3.select(this).selectAll<any, unknown>('tsi-rowHeaderCell').data([d]);
                
                let getRowHeaderText = (d) => {
                    return `${self.chartComponentData.displayState[aggKey].name}${(splitBy !== '' ? (': ' + splitBy) : '')}`;
                }

                headerCell.enter()  
                    .append('td')
                    .attr("tabindex", 1)
                    .merge(headerCell)
                    .attr('class', (d, col) => `tsi-rowHeaderCell ${self.cellClass(i + 1, 0)}`)
                    .on("keydown", (event, d) => {
                        self.arrowNavigate(event, i + 1, 0)
                    })
                    .attr('aria-label', d => {
                        return `${self.getString('row header for')} ${Utils.stripNullGuid(getRowHeaderText(d))}`;
                    })
                    .each(function (d) {
                        d3.select(this).select('*').remove();
                        let container = d3.select(this).append('div').attr('class', 'tsi-rowHeaderContainer');
                        let seriesName = container.append('div')
                            .attr('class', 'tsi-rowHeaderSeriesName');
                        Utils.appendFormattedElementsFromString(seriesName, getRowHeaderText(d));
                        let measureContainer = container.append('div')
                            .attr('class', 'tsi-rowHeaderMeasures');

                        let measureNames = measureContainer.selectAll('.tsi-measureName').data(measuresData);
                        measureNames.enter()
                            .append('div')
                            .attr('class', 'tsi-measureName')
                            .text((d: any) => d);
                    })
                headerCell.exit().remove();

                let cellsEntered = cells.enter()
                    .append('td')
                    .merge(cells)
                    .attr('class', (d, col) => `tsi-valueCell ${self.cellClass(i + 1, col + 1)}`)
                    .on("keydown", (event, d) => {
                        const e = cellsEntered.nodes();
                        const col = e.indexOf(event.currentTarget);
                        self.arrowNavigate(event, i + 1, col + 1)
                    })
                    .attr("tabindex", 1)
                    .attr('aria-label', (d: any, i) => {
                        if (!d.measures || Object.keys(d.measures).length === 0) {
                            return `${self.getString('no values at')} ${getRowHeaderText(d)} and ${self.getFormattedDate(new Date(headerCellData[i]))}`; 
                        }
                        let formattedValues = Object.keys(d.measures).map((measureName) => {
                            return `${measureName}: ${d.measures[measureName]}`;
                        }).join(', ');
                        return `${self.getString('values for cell at')} ${getRowHeaderText(d)} ${self.getString('and')} ${self.getFormattedDate(d.dateTime)} ${self.getString('are')} ${formattedValues}`;
                    })
                    .each(function (d: any, i) {      
                        let measures = d3.select(this).selectAll('.tsi-measureValue').data(measuresData);
                        measures.enter()
                            .append('div')
                            .attr('class', 'tsi-measureValue')
                            .text((measure: string) => d.measures ? d.measures[measure] : '');
                        measures.exit().remove(); 
                    });
                cellsEntered.exit().remove();
            });

        rowsEntered.exit().remove();
    }
	
	public render(data: any, options: any, aggregateExpressionOptions: any, chartComponentData: ChartComponentData = null) {
        data = Utils.standardizeTSStrings(data);
        this.chartOptions.setOptions(options);
        this.gridComponent = d3.select(this.renderTarget);
        if (chartComponentData) {
            this.chartComponentData = chartComponentData;
        } else {
            this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
        }

        this.setFilteredTimestamps();

        super.themify(this.gridComponent, this.chartOptions.theme);        

        this.gridComponent
            .classed("tsi-gridComponent", true)
            .classed("tsi-fromChart", !!options.fromChart)
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
            this.tableHeaderRow.append('th')
                .attr("tabindex", 0)
                .attr("class", "tsi-topLeft " + this.cellClass(0,0))
                .on("keydown", (event) => {
                    this.arrowNavigate(event, 0, 0);
                });
        }

        this.addHeaderCells();
        this.addValueCells();

        if (this.chartOptions.fromChart) {
            this.gridComponent.selectAll('.tsi-closeButton').remove();
            this.closeButton = grid.append('button')
                .attr("class", "tsi-closeButton")
                .attr('aria-label', this.getString('close grid'))
                .html('&times')
                .on('keydown', (event) => {
                    if (event.keyCode === 9) {
                        this.focus(0, 0);
                        event.preventDefault();
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
                // left
                this.focus(rowIdx, colIdx - 1);
                d3event.preventDefault();
                break;
            case 1:
                // up
                this.focus(rowIdx - 1, colIdx);
                d3event.preventDefault();
                break;
            case 2:
                // right
                this.focus(rowIdx, colIdx + 1);
                d3event.preventDefault();
                break;
            case 3:
                // down
                this.focus(rowIdx + 1, colIdx);
                d3event.preventDefault();
                break;
            default:
                break;
        }
    }
}

export default Grid

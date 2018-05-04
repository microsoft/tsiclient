import * as d3 from 'd3';
import './Grid.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";

class Grid extends Component {
	private gridComponent: any;
	private rowLabelKey: string = "__tsiLabel__";
	private colorKey: string = "__tsiColor__";

	public usesSeconds: boolean = false;
	public usesMillis:boolean = false;

	constructor(renderTarget: Element){
		super(renderTarget);
	}

	Grid() {
	}
	
	public renderFromAggregates(data: any, options: any, aggregateExpressionOptions: any) {
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
				p.push(row);
			})
			return p;
		},[])
		return this.render(dataAsJson, options, aggregateExpressionOptions);
	}
	
	public render(data: any, options: any, aggregateExpressionOptions: any) {
		var targetElement = d3.select(this.renderTarget);
		if(targetElement.style("position") == "static")
			targetElement.style("position", "relative")
		if(this.gridComponent)
			this.gridComponent.remove();
		this.gridComponent = targetElement.append('div').attr("class", "tsi-gridComponent").classed("tsi-fromChart", !!options.fromChart).attr("aria-label", "A grid of values.  Use tab to enter, and the arrow keys to navigate the values of each cell");
		var grid = this.gridComponent.append('div').attr("class", "tsi-gridWrapper").attr("tabindex", 0).on("click", () => {focus(0,0)});
		var headers = Object.keys(data.reduce((p,c) => {
			Object.keys(c).forEach(k => {
				if(k != this.rowLabelKey && k != this.colorKey)
					p[k] = true;
			})
			return p;
		}, {})).sort();

		var draw = () => {
			var table = grid.append('table');
			var headersRow = table.append('tr')
			headersRow.append('th').attr("tabindex", 0).attr("class", "tsi-topLeft " + cellClass(0,0)).on("keydown", () => {arrowNavigate(d3.event, 0, 0)}).attr("aria-label", "A grid of values.  Use the arrow keys to navigate the values of each cell");
			
			headers.forEach((h, i) => {
				headersRow.append('th').attr("tabindex", 0).attr("class", cellClass(0, i+1)).on("keydown", () => {arrowNavigate(d3.event, 0, i+1)}).text(() => {
					var hAsDate = <any>(new Date(h));
					if(hAsDate != 'Invalid Date')
						return Utils.timeFormat(this.usesSeconds, this.usesMillis)(hAsDate);
					return h;
				})
			});
			
			data.forEach((d, i) => {
				var currentRow = table.append('tr');
				if(d.hasOwnProperty(this.rowLabelKey)){
					var headerTd = currentRow.append('td').attr("tabindex", 0)
								   .attr("class", "tsi-rowHeaderWrapper " + cellClass(i + 1, 0))
								   .on("keydown", () => {arrowNavigate(d3.event, i + 1, 0)})
								   .attr("aria-label", "Label for row " + (i+1) + ", has value " + d[this.rowLabelKey])
					var headerDiv = headerTd.append('div');
					headerDiv.append('div').text(d[this.rowLabelKey]).attr("class", "tsi-rowHeader");
					var measureTypeDiv = headerDiv.append('div').attr("class", "tsi-measureTypeWrapper")
					Object.keys(d[Object.keys(d)[0]]).forEach(mt => {
						measureTypeDiv.append('div').text(mt).attr("class", "tsi-measureType");
					});
					
					if(d.hasOwnProperty(this.colorKey))
						headerTd.style("border-left", "4px solid " + d[this.colorKey]);
				}
				headers.forEach((h, j) => {
					var currentTd = currentRow.append('td')
									.attr("tabindex", 0).attr("class", cellClass(i+1, j+1))
									.on("keydown", () => {arrowNavigate(d3.event, i+1, j+1)})
									.attr("aria-label", getAriaLabel(d.hasOwnProperty(this.rowLabelKey) ? d[this.rowLabelKey] : '', h, i+1, j+1, d.hasOwnProperty(h) ? d[h] : 'No values'));
					if(d.hasOwnProperty(h)){
						Object.keys(d[h]).forEach(mt => {
							currentTd.append('div').text(d[h][mt]);
						})
					}
				});
			})
		}
		
		var arrowNavigate = (d3event: any, rowIdx: number, colIdx: number) => {
			if(d3event.keyCode == 9 && !d3event.shiftKey){
				(<any>closeButton.node()).focus();
				d3event.preventDefault();
				return;
			}
			if(d3event.shiftKey && d3event.keyCode == 9){
				(<any>grid.node()).focus();
				d3event.preventDefault();
				return;
			}
			var codes = [37, 38, 39, 40];
			var codeIndex = codes.indexOf(d3event.keyCode);
			if(codeIndex == -1)
				return;
			switch(codeIndex){
				case 0:
					focus(rowIdx, colIdx - 1);
					d3event.preventDefault();
					break;
				case 1:
					focus(rowIdx - 1, colIdx);
					d3event.preventDefault();
					break;
				case 2:
					focus(rowIdx, colIdx + 1);
					d3event.preventDefault();
					break;		
				case 3:
					focus(rowIdx + 1, colIdx);
					d3event.preventDefault();
					break;
				default:
					break;
			}
		}
		
		var getAriaLabel = (rowLabel, colLabel, rowIdx, colIdx, valuesObject) => {
			var text = typeof(valuesObject) != 'string' ? ('values ' + (Object.keys(valuesObject).reduce((p,c) => {
				p += ", " + c + ", " + valuesObject[c];
				return p;
			}, ""))) : valuesObject
			return "Cell in row " + (rowIdx) + ", column " + colIdx + ".  " + (rowLabel.length ? ("Row is labeled " + rowLabel) : '') + " in column named " + colLabel + " with  " +
			text;
		}
		
		var cellClass = (ridx, cidx) => {
			return "tsi-table-" + ridx + '-' + cidx;
		}
		
		var focus = (rowIdx, colIdx) => { try{(<any>targetElement.select('.' + cellClass(rowIdx, colIdx)).node()).focus();}catch(e){console.log(e)} }
		draw();
		var closeButton = grid.append('button').attr("class", "tsi-closeButton").html('&times').on("click", () => {if(!!options.fromChart)this.gridComponent.remove()});
		return {focus: ()=>{focus(0,0)}};
	}
}

export {Grid}

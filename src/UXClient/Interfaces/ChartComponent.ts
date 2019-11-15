import {Utils} from "./../Utils";
import {Component} from "./Component";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';
import { EllipsisMenu } from "../Components/EllipsisMenu/EllipsisMenu";
import * as d3 from 'd3';
import Split from 'split.js';
import { Legend } from "../Components/Legend/Legend";


class ChartComponent extends Component {
	readonly MINWIDTH = 350;
	protected MINHEIGHT = 150;
	readonly CONTROLSWIDTH = 200;
	readonly GUTTERWIDTH = 6;
    public data: any;
	public aggregateExpressionOptions: any;
	protected chartControlsPanel = null;
	protected ellipsisContainer = null;
	protected ellipsisMenu: EllipsisMenu = null;
	protected legendObject: Legend;

	protected width: number;
	protected chartWidth: number;
	protected svgSelection = null;
	protected legendWidth: number = this.CONTROLSWIDTH;
	public draw;
	
	public chartComponentData: ChartComponentData;
	public chartMargins: any;
	
	constructor(renderTarget: Element){
		super(renderTarget);
		this.chartComponentData = new ChartComponentData();
	}

	protected drawEllipsisMenu (additionalEllipsisItems = []) {
		if (this.chartOptions.canDownload || this.chartOptions.grid || (this.chartOptions.ellipsisItems && this.chartOptions.ellipsisItems.length > 0) || additionalEllipsisItems.length > 0) {
			if (this.ellipsisContainer === null) {
				this.ellipsisContainer = this.chartControlsPanel.append("div")
					.attr("class", "tsi-ellipsisContainerDiv");
			}
			if (this.ellipsisMenu === null) {
				this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());
			}

			var ellipsisItems = [];
			if (this.chartOptions.grid) {
				ellipsisItems.push(Utils.createGridEllipsisOption(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData, this.getString("Display Grid")));
			}
			if (this.chartOptions.canDownload) {
				ellipsisItems.push(Utils.createDownloadEllipsisOption(() => this.chartComponentData.generateCSVString(this.chartOptions.offset, this.chartOptions.dateLocale), () => Utils.focusOnEllipsisButton(this.renderTarget) ,this.getString("Download as CSV")));
			}

			if (this.chartOptions.ellipsisItems) {
				ellipsisItems = ellipsisItems.concat(this.chartOptions.ellipsisItems);
			}

			this.ellipsisMenu.render(ellipsisItems.concat(additionalEllipsisItems), {theme: this.chartOptions.theme});
		}
	}

	public downloadAsCSV = (isScatterPlot = false) => {
		Utils.downloadCSV(this.chartComponentData.generateCSVString(this.chartOptions.offset, this.chartOptions.dateLocale, isScatterPlot ? this.chartOptions.spMeasures : null));
	}

	protected removeControlPanel () {
		if (this.chartControlsPanel) {
			this.chartControlsPanel.remove();
		}
		this.chartControlsPanel = null;
		this.ellipsisContainer = null;
		this.ellipsisMenu = null;
	}

	protected removeEllipsisMenu () {
		if (this.ellipsisContainer) {
			this.ellipsisContainer.remove();
		}
		this.ellipsisContainer = null;
		this.ellipsisMenu = null;
	}

	protected getWidth () {
		return Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
	}

	public getVisibilityState () {
        return this.chartComponentData.getVisibilityState();
	}
	
	protected ellipsisItemsExist () {
        return (this.chartOptions.canDownload || this.chartOptions.ellipsisItems.length > 0 || this.chartOptions.grid);
	}

	protected getSVGWidth () {
        return this.chartWidth + this.chartMargins.left + this.chartMargins.right;
	}
	
	protected getChartWidth (legendWidth = this.CONTROLSWIDTH) {
        legendWidth = this.legendWidth;// + this.GUTTERWIDTH;
        return Math.max(1, this.width - this.chartMargins.left - this.chartMargins.right - (this.chartOptions.legend === "shown" ? legendWidth : 0));
	}

	protected calcSVGWidth () {
        return this.svgSelection.node().getBoundingClientRect().width;
	}
	
	protected setControlsPanelWidth () {
		if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
			//either calculate expected or just use svg if it's in the DOM
			let controlPanelWidth = this.svgSelection && this.svgSelection.node() ?  
				this.calcSVGWidth() : 
				this.getWidth() - (this.chartOptions.legend === 'shown' ? (this.legendWidth + this.GUTTERWIDTH) : 0);
			this.chartControlsPanel.style("width", controlPanelWidth + "px");
		}
	}

	protected splitLegendAndSVG (chartElement, onDrag = () => {}) {
        let svgWidth = this.getSVGWidth();
		let legendWidth = this.width - svgWidth;
		d3.select(this.renderTarget).select('.tsi-resizeGutter').remove();
		let legend = this.legendObject.legendElement;

		Split([this.legendObject.legendElement.node(), chartElement], {
            sizes: [legendWidth / this.width * 100, svgWidth / this.width * 100],
            gutterSize: 2,
            minSize: [200, 0],
            snapOffset: 0,
            cursor: 'e-resize',
            onDragEnd: (sizes) => {
				let legendWidth = this.width * (sizes[0] / 100);
                this.legendWidth = legendWidth;
                this.chartWidth = this.getChartWidth();
                this.draw(true);
                legend.style('width', this.legendWidth + 'px');
                d3.select(this.renderTarget).select('.tsi-resizeGutter')
                    .classed('tsi-isDragging', false);
            },
            onDragStart: () => {
                d3.select(this.renderTarget).select('.tsi-resizeGutter')
                    .classed('tsi-isDragging', true); 
            },
            onDrag: () => {
				if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
                    let svgLeftOffset = this.calcSVGWidth();
                    this.chartControlsPanel.style("width", Math.max(svgLeftOffset, this.chartMargins.left + 8) + "px"); //8px to account for the width of the icon
                }
				onDrag();
            },
            gutter: (index, direction) => {
                const gutter = document.createElement('div');
                gutter.className = `gutter tsi-resizeGutter`;
                return gutter;
			},
			direction: 'horizontal'
		});
		
		// explicitly set the width of the legend to a pixel value
		let calcedLegendWidth = legend.node().getBoundingClientRect().width;
		legend.style("width", calcedLegendWidth + "px");
	}	
}
export {ChartComponent}

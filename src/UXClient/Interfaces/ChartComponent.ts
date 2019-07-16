import {Utils} from "./../Utils";
import {Component} from "./Component";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';
import { EllipsisMenu } from "../Components/EllipsisMenu/EllipsisMenu";

class ChartComponent extends Component {
	readonly MINWIDTH = 350;
	protected MINHEIGHT = 150;
	readonly CONTROLSWIDTH = 200;
	readonly TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;
    public data: any;
	public aggregateExpressionOptions: any;
	protected chartControlsPanel = null;
	protected ellipsisContainer = null;
	protected ellipsisMenu: EllipsisMenu = null;
	
	public chartComponentData: ChartComponentData;
	
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

	public downloadAsCSV = () => {
		Utils.downloadCSV(this.chartComponentData.generateCSVString(this.chartOptions.offset, this.chartOptions.dateLocale));
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

	public getVisibilityState () {
        return this.chartComponentData.getVisibilityState();
	}
	
	protected ellipsisItemsExist () {
        return (this.chartOptions.canDownload || this.chartOptions.ellipsisItems.length > 0 || this.chartOptions.grid);
	}

	
}
export {ChartComponent}

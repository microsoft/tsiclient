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
	public chartOptions: ChartOptions = new ChartOptions();
	public aggregateExpressionOptions: any;
	protected chartControlsPanel = null;
	protected ellipsisContainer = null;
	protected ellipsisMenu: EllipsisMenu;
	
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
			this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());

			var ellipsisItems = [];
			if (this.chartOptions.grid) {
				ellipsisItems.push(Utils.createGridEllipsisOption(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData));
			}
			if (this.chartOptions.canDownload) {
				ellipsisItems.push(Utils.createDownloadEllipsisOption(() => this.chartComponentData.generateCSVString(), () => Utils.focusOnEllipsisButton(this.renderTarget)));
			}

			if (this.chartOptions.ellipsisItems) {
				ellipsisItems = ellipsisItems.concat(this.chartOptions.ellipsisItems);
			}

			this.ellipsisMenu.render(ellipsisItems.concat(additionalEllipsisItems), {theme: this.chartOptions.theme});
		}
	}

	protected removeControlPanel () {
		if (this.chartControlsPanel) {
			this.chartControlsPanel.remove();
		}
		this.chartControlsPanel = null;
		this.ellipsisContainer = null;
		this.ellipsisMenu = null;
	}
	
}
export {ChartComponent}

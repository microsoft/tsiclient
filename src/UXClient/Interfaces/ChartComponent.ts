import {Utils} from "./../Utils";
import {Component} from "./Component";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';

class ChartComponent extends Component {
	readonly MINWIDTH = 350;
	protected MINHEIGHT = 150;
	readonly CONTROLSWIDTH = 200;
	readonly TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;
    public data: any;
	public chartOptions: ChartOptions = new ChartOptions();
	public aggregateExpressionOptions: any;
	
	public chartComponentData: ChartComponentData;
	
	constructor(renderTarget: Element){
		super(renderTarget);
		this.chartComponentData = new ChartComponentData();
	}
	
}
export {ChartComponent}

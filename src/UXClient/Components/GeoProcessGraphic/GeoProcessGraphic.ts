import * as atlas from 'azure-maps-control';
import './GeoProcessGraphic.scss';
import HistoryPlayback from "./../../Components/HistoryPlayback";
import TsqExpression from '../../Models/TsqExpression';
import ServerClient from '../../../ServerClient';

class GeoProcessGraphic extends HistoryPlayback {
    private dataSource: atlas.source.DataSource;
    private azureMapsSubscriptionKey: string;
    private zoom: number;
    private width: number;
    private height: number;
    private theme: string;
    private center: Array<number>;
    private bearing: number;
    private pitch: number;
    private maxZoom: number;
    private minZoom: number;
    private duration: number;
    private map: atlas.Map;

  constructor(renderTarget: Element){
    super(renderTarget);
    this.serverClient = new ServerClient();
    this.currentCancelTrigger = null;
  }

  render(environmentFqdn: string,
    getToken: () => Promise<string>,
    data: Array<TsqExpression>,
    chartOptions
    ) {
    this.zoom = chartOptions.zoom;
    this.center = chartOptions.center;
    this.bearing = chartOptions.bearing;
    this.pitch = chartOptions.pitch;
    this.maxZoom = chartOptions.maxZoom;
    this.minZoom = chartOptions.minZoom;
    this.duration = chartOptions.duration;
    this.azureMapsSubscriptionKey = chartOptions.subscriptionKey;
    this.width = chartOptions.width;
    this.height = chartOptions.height;
    this.theme= chartOptions.theme;
    this.renderBase(environmentFqdn, getToken, data, chartOptions);
  }

  protected loadResources(): Promise<any> {
    (<HTMLElement>this.component.node()).style.width = `${this.width}px`;
    (<HTMLElement>this.component.node()).style.height = `${this.height}px`;
    
     this.map = new atlas.Map(<HTMLElement>this.component.node(), {
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: this.azureMapsSubscriptionKey
      }
    });
    this.map.events.add('ready', () => {
      this.dataSource = new atlas.source.DataSource();
      this.map.sources.add(this.dataSource);

      for (let i = 0; i < this.tsqExpressions.length; i++){
        let popup = new atlas.Popup({
          content: `<div class = 'tsi-gpgPopUp id= tsi-popup${i}'></div>`,
          pixelOffset: [0, -30]
        });
        let marker = new atlas.HtmlMarker({
          htmlContent: `<div class = tsi-geoprocess-graphic> <img class='tsi-gpgcircleImage 
          id= tsi-htmlMarker${i}' src= "` + this.tsqExpressions[i].image + '" /> </div>',
          position: [0,0],
          popup: popup
        });
        this.map.markers.add(marker);
        this.map.popups.add(popup);
        this.map.events.add('click', marker, () => {
          marker.togglePopup();
        });
      }
    });
    this.map.setCamera({
        center: this.center,
        bearing: this.bearing,
        pitch: this.pitch,
        zoom: this.zoom,
        maxZoom: this.maxZoom,
        minZoom: this.minZoom,
        type: "fly",
        duration: this.duration
    });
    return Promise.resolve();
  }

  protected draw(){
    this.drawBase();
  }
  
  protected getDataPoints(results: Array<IGeoProcessGraphicLabelInfo>){
    let dataPoints = results.map((r): IGeoProcessGraphicLabelInfo => {
        return this.parseTsqResponse(r);  
      });
      this.updateDataMarkers(dataPoints);
  }

  protected parseTsqResponse(response) {
    let parsedResponse = {};
    if (response && response.properties){
      for (let i =0; i<response.properties.length; i++){
          response.properties[i] && response.properties[i].name && response.properties[i].values ?
            parsedResponse[response.properties[i].name] = response.properties[i].values[0]
              : null;
      }
    }
    return parsedResponse;
  }

  protected updateDataMarkers(dataPoints: Array<any>) {
      for(let i = 0; i < dataPoints.length; i++) {
        let lat = dataPoints[i][this.tsqExpressions[i].positionXVariableName];
        let lon = dataPoints[i][this.tsqExpressions[i].positionYVariableName];
        this.map.markers.getMarkers()[i].setOptions({
            position: [lat, lon]
        });
        let dataPointArr = Object.entries(dataPoints[i]);
        
        this.map.popups.getPopups()[i].setOptions({
            position: [lat, lon],
            content: this.createTable(dataPointArr, i)
        });
      }
    }

  protected createTable(dataPointArr, idx){
    let gpgTooltipDiv = document.createElement('div');
    gpgTooltipDiv.className = 'tsi-gpgTooltip tsi-'+ this.theme;

    let gpgTooltipInnerDiv = document.createElement('div');
    gpgTooltipInnerDiv.className = 'tsi-gpgTooltipInner';

    let gpgTooltipTitleDiv = document.createElement('div');
    gpgTooltipTitleDiv.className = 'tsi-gpgTooltipTitle';

    let title = document.createTextNode(this.tsqExpressions[idx].alias);
    gpgTooltipTitleDiv.appendChild(title);

    let gpgTooltipTable =  document.createElement('table');
    gpgTooltipTable.className = 'tsi-gpgTooltipValues';
    gpgTooltipTable.classList.add('tsi-gpgTooltipTable');

    for (let i = 0; i < dataPointArr.length; i++){
      let spacer = document.createElement('tr');
      spacer.className = 'tsi-gpgTableSpacer';
      gpgTooltipTable.appendChild(spacer);

      let gpgTooltipValueRow = document.createElement('tr');

      let gpgValueLabelCell = document.createElement('td');
      gpgValueLabelCell.className = 'tsi-gpgValueLabel';
      let labelName = document.createTextNode(dataPointArr[i][0]);
      gpgValueLabelCell.appendChild(labelName);
      gpgTooltipValueRow.appendChild(gpgValueLabelCell);

      let gpgValueCell = document.createElement('td');
      gpgValueCell.className = 'tsi-gpgValueCell';
      let cellData = document.createTextNode(dataPointArr[i][1].toFixed(5));
      gpgValueCell.appendChild(cellData);
      gpgTooltipValueRow.appendChild(gpgValueCell);

      gpgTooltipTable.appendChild(gpgTooltipValueRow);
    }
    gpgTooltipInnerDiv.appendChild(gpgTooltipTitleDiv);
    gpgTooltipInnerDiv.appendChild(gpgTooltipTable);
    gpgTooltipDiv.appendChild(gpgTooltipInnerDiv);
    return gpgTooltipDiv;
  }
}
interface IGeoProcessGraphicLabelInfo{
}
export default GeoProcessGraphic

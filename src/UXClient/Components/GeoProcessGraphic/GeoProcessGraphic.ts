import * as atlas from 'azure-maps-control';
import './GeoProcessGraphic.scss';
import { HistoryPlayback, GraphicInfo } from "./../../Components/HistoryPlayback/HistoryPlayback";
import { TsqExpression } from '../../Models/TsqExpression';
import { ServerClient } from '../../../ServerClient/ServerClient';

class GeoProcessGraphic extends HistoryPlayback {
    private dataSource: atlas.source.DataSource;
    private marker: atlas.HtmlMarker;
    private subscriptionKey: string;
    private img: string;
    private zoom: number;
    private width: number;
    private height: number;
    private popup: atlas.Popup;
    private positionXVariableName: string;
    private positionYVariableName: string;
    private theme: string;
    private alias: string;

  constructor(renderTarget: Element){ 
    super(renderTarget); 
    this.serverClient = new ServerClient();
    this.currentCancelTrigger = null;
  }

  render(environmentFqdn: string, 
    getToken: () => Promise<string>, 
    graphicSrc: string, 
    data: Array<TsqExpression>, 
    chartOptions
    ) {
    this.zoom = chartOptions.zoom;
    this.subscriptionKey = chartOptions.subscriptionKey;
    this.width = chartOptions.width;
    this.height = chartOptions.height;
    this.img = graphicSrc;
    this.theme= chartOptions.theme;
    this.renderBase(environmentFqdn, getToken, graphicSrc, data, chartOptions);
  }

  protected loadGraphic(graphicSrc: string): Promise<GraphicInfo> {
    (<HTMLElement>this.component.node()).style.width = `${this.width}px`;
    (<HTMLElement>this.component.node()).style.height = `${this.height}px`;
    
    let map = new atlas.Map(<HTMLElement>this.component.node(), {
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: this.subscriptionKey
      }
    });
    map.events.add('ready', () => {
        this.dataSource = new atlas.source.DataSource();
        map.sources.add(this.dataSource);
        this.popup = new atlas.Popup({
            content: `<div style="padding:10px;"></div>`,
            pixelOffset: [0, -30]
        })
        this.marker =  new atlas.HtmlMarker({
            htmlContent: '<img class="circleImage " src= "' + this.img + '" />',
            position: [0, 0],
            popup: this.popup
        });
        map.markers.add(this.marker);
        map.events.add('click', this.marker, () => {
            this.marker.togglePopup();
        });
    });
    map.setCamera({
        center: [0, 0],
        bearing: 0,
        pitch: 90,
        zoom: this.zoom,
        maxZoom : 4,
        minZoom: 1.5,
        type: "fly",
        duration: 100
    });
    return Promise.resolve({
        graphic: map,
        width: this.width,
        height: this.height
      });
  }
  
  protected extractInfo(prm: Array<IGeoProcessGraphicLabelInfo>){
    let dataPoints = prm.map((r, i): IGeoProcessGraphicLabelInfo => {
        let result = this.parseTsqResponse(r);
        this.positionXVariableName = this.tsqExpressions[i].positionXVariableName;
        this.positionYVariableName = this.tsqExpressions[i].positionYVariableName;
        this.alias = this.tsqExpressions[i].alias;
        return result;  
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
            let lat = dataPoints[i][this.positionXVariableName];
            let lon = dataPoints[i][this.positionYVariableName];
            this.marker.setOptions({
                position: [lat, lon]
            });
            let dataPointArr = Object.entries(dataPoints[0]);
            this.popup.setOptions({
                position: [lat, lon],
                content: this.createTable(dataPointArr)
            });
        }
     }

     protected createTable(dataPointArr){
         let div1= document.createElement('div');
         div1.className = 'tsi-gpgTooltip tsi-'+ this.theme;

         let div2 = document.createElement('div');
         div2.className = 'tsi-gpgTooltipInner';

         let div3 = document.createElement('div');
         div3.className = 'tsi-gpgTooltipTitle';

         var title = document.createTextNode(this.alias);
         div3.appendChild(title);

         let tbl=  document.createElement('table');
         tbl.className = 'tsi-gpgTooltipValues';
         tbl.classList.add('tsi-gpgTooltipTable');

         for (let i = 0; i < dataPointArr.length; i++){
            var spacer = document.createElement('tr');
            spacer.className = 'tsi-gpgTableSpacer';
            tbl.appendChild(spacer);

            var row = document.createElement('tr');

            var cell1 = document.createElement('td');
            cell1.className = 'tsi-gpgValueLabel';;
            var cellText1 = document.createTextNode(dataPointArr[i][0]);
            cell1.appendChild(cellText1);
            row.appendChild(cell1);

            var cell2 = document.createElement('td');
            cell2.className = 'tsi-gpgValueCell';
            var cellText2 = document.createTextNode(dataPointArr[i][1].toFixed(5));
            cell2.appendChild(cellText2);
            row.appendChild(cell2);

            tbl.appendChild(row);
         }         
         div2.appendChild(div3);
         div2.appendChild(tbl);
         div1.appendChild(div2);
         return div1;
     }
}
interface IGeoProcessGraphicLabelInfo{
 
}
export { GeoProcessGraphic };
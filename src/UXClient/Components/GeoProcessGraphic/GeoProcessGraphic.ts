import * as atlas from 'azure-maps-control';
import './GeoProcessGraphic.scss';
import { HistoryPlayback, GraphicInfo } from "./../../Components/HistoryPlayback/HistoryPlayback";
import { TsqExpression } from '../../Models/TsqExpression';
import { ServerClient } from '../../../ServerClient/ServerClient';
import { EventsPlot } from '../EventsPlot/EventsPlot';

class GeoProcessGraphic extends HistoryPlayback {
    private dataSource: atlas.source.DataSource;
    private marker: atlas.HtmlMarker;
    private subscriptionKey: string;
    private img: string;
    private zoom: number;
    private width: number;
    private height: number;
    private popup: atlas.Popup;
    private timeSeriesIds: string[][];
    private markerIds: Array<string>;
    private pin : atlas.Shape;

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
    this.subscriptionKey = chartOptions.subscriptionKey;
    this.width = chartOptions.width;
    this.height = chartOptions.height;
    this.img = graphicSrc;
    this.renderBase(environmentFqdn, getToken, graphicSrc, data, chartOptions);
  }

  protected loadGraphic(graphicSrc: string): Promise<GraphicInfo> {
    (<HTMLElement>this.component.node()).style.width = `${this.width}px`;
    (<HTMLElement>this.component.node()).style.height = `${this.height}px`;
    
    let map = new atlas.Map(<HTMLElement>this.component.node(), {
      center: [0, 0],
      zoom: this.zoom,
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
            htmlContent: '<img class="circleImage" src= "' + this.img + '" />',
            position: [0, 0],
            popup: this.popup
        });
        map.markers.add(this.marker);
        map.events.add('click', this.marker, () => {
            this.marker.togglePopup();
        });
    });
    return Promise.resolve({
        graphic: map,
        width: this.width,
        height: this.height
      });
  }

  protected extractInfo(prm: Array<IGeoProcessGraphicLabelInfo>){
    let dataPoints = prm.map((r, i): IGeoProcessGraphicLabelInfo => {
        let parsedResponse = this.parseTsqResponse(r);
        parsedResponse['alias'] = this.tsqExpressions[i].alias;
        return parsedResponse;
      });
      this.updateDataMarkers(dataPoints);
  }

  protected parseTsqResponse(response) {
      let dataPoints = {};
    if (response && response.properties){
        for (let i =0; i<response.properties.length; i++){
            response.properties[i] && response.properties[i].name && response.properties[i].values ?
                dataPoints[response.properties[i].name] = response.properties[i].values[0]
                : null;
        }
    }
    return dataPoints;
  }

  protected updateDataMarkers(dataPoints: Array<any>) {
    console.log(dataPoints);
    for(let i = 0; i < dataPoints.length; i++) {
        let alias = dataPoints[i].alias;
        let airTemp = dataPoints[i].airTemp;
        let lat = dataPoints[i].lat;
        let lon = dataPoints[i].lon;
        if(!lat&&lon) { continue; }
        this.marker.setOptions({
            position: [lat,lon],
        });
        this.popup.setOptions({
            position: [lat,lon],
            content: `<div class="tsi-light tsi-tooltipInner"style="padding:10px;">
            <table class="tsi-tooltipTable">
                <tr class="tsi-tooltipTitle">
                    <td>Name:</td>
                    <td>${alias}</td>
                </tr>
                <tr class="tsi-tooltipSubtitle tsi-tooltipSeriesName">
                    <td>Airtemp:</td>
                    <td>${airTemp}</td>
                </tr>
                <tr>
                    <td>Latitude:</td>
                    <td>${lat}</td>
                </tr>
                <tr>
                    <td>Longitude:</td>
                    <td>${lon}</td>
                </tr>
            </div>`,
        });
    }
  }
}
interface IGeoProcessGraphicLabelInfo{
    // airTemp ? : number,
    // lat ? : number,
    // lon ? : number,
    // alias ? : string
}
export { GeoProcessGraphic };
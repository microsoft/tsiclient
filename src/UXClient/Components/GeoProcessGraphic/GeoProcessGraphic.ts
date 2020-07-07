import * as atlas from 'azure-maps-control';
import './GeoProcessGraphic.scss';
import { HistoryPlayback, GraphicInfo } from "./../../Components/HistoryPlayback/HistoryPlayback";
import { TsqExpression } from '../../Models/TsqExpression';
import { ServerClient } from '../../../ServerClient/ServerClient';

class GeoProcessGraphic extends HistoryPlayback {
    private dataSource: atlas.source.DataSource;
    private marker: atlas.HtmlMarker;
    private subscriptionKey: string;
    private view: string;
    private zoom: number;
    private width: number;
    private height: number;
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
        map.layers.add(new atlas.layer.SymbolLayer(this.dataSource, null, {
            iconOptions: {
                //For smoother animation, ignore the placement of the icon. This skips the label collision calculations and allows the icon to overlap map labels. 
                ignorePlacement: true,

                //For smoother animation, allow symbol to overlap all other symbols on the map.
                allowOverlap: true  
            },
            textOptions: {
                //For smoother animation, ignore the placement of the text. This skips the label collision calculations and allows the text to overlap map labels.
                ignorePlacement: true,

                //For smoother animation, allow text to overlap all other symbols on the map.
                allowOverlap: true
            }
        }));
        this.pin = new atlas.Shape(new atlas.data.Point([0,0]));
        this.dataSource.add(this.pin);
        // //Create a pin and wrap with the shape class and add to data source.
        // this.pin = new atlas.data.Feature(new atlas.data.Point([0,0]), {Name: 'Titanic'});
        // this.dataSource.add(this.pin);
        // let popup = new atlas.Popup();
        // map.events.add('click', this.pin, (event: any) => {
        //     if(!event.shapes || event.shapes.length === 0) {
        //       return; 
        //     }
        
        //     let shape = event.shapes[0];
        //     let position = shape.getCoordinates();
        //     let offset = [0, -18];
        //     let properties = event.shapes[0].getProperties();
        
        //     popup.setOptions({
        //       content: atlas.PopupTemplate.applyTemplate(properties),
        //       position,
        //       pixelOffset: offset
        //     });
        
        //     popup.open(map);
        //   });
    });
    return Promise.resolve({
        graphic: map,
        width: this.width,
        height: this.height
      });
  }
  protected extractInfo(prm: Array<IGeoProcessGraphicLabelInfo>){
      //debugger;
    let dataPoints = prm.map((r, i): IGeoProcessGraphicLabelInfo => {
        let airTemp = this.parseTsqResponse(r, 0);
        let lat = this.parseTsqResponse(r, 1);
        let lon = this.parseTsqResponse(r, 2);
        return {
            airTemp,
            lat,
            lon,
            alias: this.tsqExpressions[i].alias,
        };
      });
      this.updateDataMarkers(dataPoints);
  }
  protected parseTsqResponse(response, idx) {
    return (response && response.properties && response.properties[idx] && response.properties[idx].values) 
      ? response.properties[idx].values[0] 
      : null;
  }

  protected updateDataMarkers(dataPoints: Array<any>) {
     console.log(dataPoints);
    for(let i = 0; i < dataPoints.length; i++) {
        let airTemp =dataPoints[i].airTemp;
        let lat = dataPoints[i].lat;
        let lon = dataPoints[i].lon;
        if(!lat&&lon) { continue; }
       //this.pin.setCoordinates([lat,lon], {Airtemp: airTemp, Latitude: lat, Longitude: lon});
        this.pin.setCoordinates([lat,lon]);
    }
  }
}
interface IGeoProcessGraphicLabelInfo{
    airTemp: number,
    lat: number,
    lon: number,
    alias: string
}
export { GeoProcessGraphic };
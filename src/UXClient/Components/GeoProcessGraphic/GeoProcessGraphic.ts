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
    this.renderBase(environmentFqdn, getToken, graphicSrc, data, chartOptions);
  }

  protected loadGraphic(graphicSrc: string): Promise<GraphicInfo> {
    (<HTMLElement>this.component.node()).style.width = `${this.width}px`;
    (<HTMLElement>this.component.node()).style.height = `${this.height}px`;
    
    let map = new atlas.Map(<HTMLElement>this.component.node(), {
      center: [0, 0],
      zoom: this.zoom,
      view: this.view,
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

        //Create a pin and wrap with the shape class and add to data source.
        let pin = new atlas.Shape(new atlas.data.Point([0,0]));
        this.dataSource.add(pin);
      
    });
    return Promise.resolve({
        graphic: map,
        width: this.width,
        height: this.height
      });
  }

  protected updateDataMarkers(dataPoints: Array<any>) {
    console.log(dataPoints);
    this.getAuthToken().then(authToken => {
        return this.serverClient.getTimeseriesInstances(authToken, this.environmentFqdn, 1000000, this.timeSeriesIds).then(instancesResult => {

            let boats = instancesResult.get.map(instanceInfo => {
              let boatName = instanceInfo.instance.instanceFields.BoatName;
              return {boatName};
            });
        this.dataSource.clear();
        for(let i = 0; i < dataPoints.length; i++) {
          let airTemp = dataPoints[i].amb_air_temp.value;
          let lat = dataPoints[i].lat.value;
          let lon = dataPoints[i].lon.value;
          if(!lat&&lon) { continue; }

          let {boatName} = boats[i];
          
          let mapPoint = new atlas.data.Point([lon, lat]); 
          let markerId = `instance-${i}`;
          this.dataSource.add(new atlas.data.Feature(mapPoint, 
            {AirTemp: airTemp, Latitude: lat, Longitude: lon }, markerId));
          this.markerIds[i] = markerId;
        }
      });
    });
  }
}

export { GeoProcessGraphic };
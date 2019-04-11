import * as d3 from 'd3';
import './HierarchyNavigation.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import { Hierarchy } from '../Hierarchy/Hierarchy';
import { ChartOptions } from '../../Models/ChartOptions';

class HierarchyNavigation extends Component{
    private server: ServerClient; 
    private wrapper;
    public chartOptions: ChartOptions = new ChartOptions();

    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
    }

    HierarchyNavigation(){
    }
    
    public render(environmentFqdn: string, getToken: any, chartOptions: any){
        let hierarchyData = {};
        this.chartOptions.setOptions(chartOptions);
        let self = this;
        let targetElement = d3.select(this.renderTarget);   
        targetElement.html(''); 
        this.wrapper = targetElement.append('div').attr('class', 'tsi-hierarchyNavigationWrapper');
        super.themify(this.wrapper, this.chartOptions.theme);

        let hierarchyElement = this.wrapper.append('div')
            .attr("class", "tsi-hierarchyWrapper");
        let hierarchy = new Hierarchy(hierarchyElement.node() as any);
        let pathSearch = (getToken, envFqdn, searchText, path, instancesPageSize = null, hierarchyiesPageSize = null, instancesContinuationToken = null, hierarchiesContinuationToken = null) => {
            getToken().then(token => {
                self.server.getTimeseriesInstancesPathSearch(token, envFqdn, searchText, path, instancesPageSize, hierarchyiesPageSize, instancesContinuationToken, hierarchiesContinuationToken).then(r => { 
                    if (r.hierarchyNodes.hits > 0) {
                        r.hierarchyNodes.hits.forEach((h) => {
                            hierarchyData[h.name + "(" + h.cumulativeInstanceCount + ")"] = {};
                        });  
                    } 
                });
            })
        }

        // pathSearch(getToken, environmentFqdn, "", []);
        hierarchy.render({USA: {}, Germany: {}}, {...this.chartOptions, withContextMenu: true});
    }

   
}

export {HierarchyNavigation}
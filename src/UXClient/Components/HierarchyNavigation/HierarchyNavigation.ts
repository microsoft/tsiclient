import * as d3 from 'd3';
import './HierarchyNavigation.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import { ChartOptions } from '../../Models/ChartOptions';

class HierarchyNavigation extends Component{
    private server: ServerClient;
    private wrapper;
    private usedHierarchyContToken;
    private usedInstancesContToken;
    public chartOptions: ChartOptions = new ChartOptions();

    1
    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
    }

    HierarchyNavigation(){
    }
    
    public render(environmentFqdn: string, getToken: any, chartOptions: any){
        this.chartOptions.setOptions(chartOptions);
        let targetElement = d3.select(this.renderTarget);   
        targetElement.html(''); 
        this.wrapper = targetElement.append('div').attr('class', 'tsi-hierarchy');
        super.themify(this.wrapper, this.chartOptions.theme);

        var filter = this.wrapper.append('div').classed('tsi-filterWrapper', true).append('input').attr('placeholder', 'Search...').on('input', function(){  
        });

        var list = this.wrapper.append('div').classed('tsi-hierarchyList', true);
        this.pathSearch(getToken, environmentFqdn, "", [], list);
    }

    private renderTree (data, target, options) {
        var list = target.append('ul');
        Object.keys(data).forEach((el) => {
            var li = list.append('li').classed('tsi-leaf', data[el].isLeaf)
                .classed('tsi-leafParent', data[el].isLeaf && options.withContextMenu);

            if(el === "Show More Hierarchies") {
                li.append('a').classed('tsi-markedName hierarchy', true).attr('style', `margin-left: ${(data[el].level - 1) * 18}px`).html(el).on('click', data[el].onClick);
            } else if (el === "Show More Instances") {
                li.append('a').classed('tsi-markedName instance', true).attr('style', `margin-left: ${(data[el].level - 1) * 18}px`).html(el).on('click', data[el].onClick);
            } else {
                li.append('span').classed('tsi-caret', true).attr('style', `left: ${(data[el].level - 1) * 18}px`);
                li.append('span').classed('tsi-markedName', true).attr('style', `margin-left: ${(data[el].level - 1) * 18}px`).html(el).on('click', () => {data[el].isExpanded ? data[el].collapse() : data[el].expand()});
            }
            data[el].node = li;
            data[el].isExpanded = false;
        });
    }

    private pathSearch = (getToken, envFqdn, searchText, path: Array<string>, target, instancesPageSize = 10, hierarchyiesPageSize = 10, instancesContinuationToken = null, hierarchiesContinuationToken = null) => {
        let self = this;
        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, envFqdn, searchText, path, instancesPageSize, hierarchyiesPageSize, instancesContinuationToken, hierarchiesContinuationToken).then(r => {
                let hierarchyData = {};
                target.selectAll('a.hierarchy').remove();
                target.selectAll('a.instance').remove(); 
                if (r.hierarchyNodes.hits.length > 0) {
                    r.hierarchyNodes.hits.forEach((h) => {
                        let hierarchy = new HierarchyNode(h.name, path);
                        hierarchy.expand = () => {hierarchy.isExpanded = true; hierarchy.node.classed('tsi-expanded', true); self.pathSearch(getToken, envFqdn, searchText, hierarchy.path, hierarchy.node)};
                        hierarchy.collapse = () => {hierarchy.isExpanded = false; hierarchy.node.classed('tsi-expanded', false); hierarchy.node.selectAll('ul').remove();};
                        hierarchyData[(h.name === "" ? "(Empty)" : h.name) + " (" + h.cumulativeInstanceCount + ")"] = hierarchy;
                    });
                }
                if (r.hierarchyNodes.continuationToken && r.hierarchyNodes.continuationToken !== 'END') {
                    let showMorehierarchy = new HierarchyNode("Show More Hierarchies", path);
                    showMorehierarchy.onClick = () => self.pathSearch(getToken, envFqdn, searchText, path, target, 10, 10, null, r.hierarchyNodes.continuationToken);
                    hierarchyData[showMorehierarchy.name] = showMorehierarchy;
                }
                if (r.instances.hits.length > 0) {
                    r.instances.hits.forEach((i) => {
                        hierarchyData[i.timeSeriesId.join(" ")] = new InstanceNode(i.timeSeriesId, i.name, i.typeId, this.chartOptions.onInstanceClick, path.length);
                    });
                }
                if (r.instances.continuationToken && r.instances.continuationToken !== 'END') {
                    let showMoreInstances = new InstanceNode(null, "Show More Instances", null, this.chartOptions.onInstanceClick, path.length);
                    showMoreInstances.onClick = () => self.pathSearch(getToken, envFqdn, searchText, path, target, 10, 10, null, r.instances.continuationToken);
                    hierarchyData[showMoreInstances.name] = showMoreInstances;
                }
                this.renderTree(hierarchyData, target, {...this.chartOptions, withContextMenu: true});
            });
        })
    } 
}

function HierarchyNode (name, parentPath) {
    this.name = name;
    this.path = parentPath.concat([name]);
    this.expand = () => {};
    this.collapse = () => {};
    this.level = parentPath.length;
    this.node = null;
    this.isExpanded = false;
}

function InstanceNode (tsId, name = null, typeId, contextMenuFunc, level) {
    this.timeSeriesId = tsId;
    this.name = name;
    this.typeId = typeId;
    this.onClick = contextMenuFunc();
    this.isLeaf = true;
    this.level = level;
    this.node = null;
}

export {HierarchyNavigation}
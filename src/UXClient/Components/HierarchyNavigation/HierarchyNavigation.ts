import * as d3 from 'd3';
import './HierarchyNavigation.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import { ModelAutocomplete } from '../ModelAutocomplete/ModelAutocomplete';

class HierarchyNavigation extends Component{
    private server: ServerClient;
    private clickedInstance;
    private hierarchyWrapper;
    private hierarchy;
    private hierarchyInstancesWrapper;
    private hierarchyInstances;
    private envHierarchies = {};
    private selectedHierarchyId = HierarchySelectionValues.All;
    private mode: State = "navigate";
    private searchString = "";
    private path: Array<string> = [];
    public hierarchyNavOptions = new HiararchyNavigationOptions();

    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.clickedInstance && d3.event.target != this.clickedInstance.contextMenu) {
                this.closeContextMenu();
                this.clickedInstance = null;
            }
        })
    }

    HierarchyNavigation(){
    }
    
    public render(environmentFqdn: string, getToken: any, hierarchyNavOptions: any){
        let self = this;
        this.hierarchyNavOptions.setOptions(hierarchyNavOptions);
        let targetElement = d3.select(this.renderTarget);   
        targetElement.html(''); 
        let hierarchyNavWrapper = targetElement.append('div').attr('class', 'tsi-hierarchy-nav-wrapper');
        super.themify(hierarchyNavWrapper, this.hierarchyNavOptions.theme);


        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then(r => {
                r.hierarchies.forEach(h => {
                    this.envHierarchies[h.id] = h;
                });

                let hierarchySelectionWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-selection-wrapper', true);
                let hierarchySelect = hierarchySelectionWrapper.append('select').classed('tsi-hierarchy-select', true).on('change', function() {
                    var selectValue = d3.select(this).property('value');
                    self.selectedHierarchyId = selectValue;
                    hierarchySelect.attr("value", selectValue);

                    if (selectValue === HierarchySelectionValues.All || selectValue === HierarchySelectionValues.Unparented) {
                        self.path = [];
                    } else {
                        self.path.push(self.envHierarchies[selectValue].name);
                    }
                    (self.hierarchyInstancesWrapper.node() as any).style.display = 'none';
                    (self.hierarchyWrapper.node() as any).style.display = 'block';
                    self.hierarchy.html('');
                    self.pathSearch(getToken, environmentFqdn, self.requestPayload(), self.hierarchy);
                });

                hierarchySelect.append('option').attr("value", HierarchySelectionValues.All).text('All');
                Object.keys(this.envHierarchies).forEach((hId) => {
                    hierarchySelect.append('option').attr("value", hId).text(this.envHierarchies[hId].name);
                });
                hierarchySelect.append('option').attr("value", HierarchySelectionValues.Unparented).text('Unassigned Time Series Instances');

                let searchWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-search', true);
                let modelAutocomplete = new ModelAutocomplete(searchWrapper.node() as Element);
                modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, theme: hierarchyNavOptions.theme});

                this.hierarchyWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-wrapper', true);
                this.hierarchy = this.hierarchyWrapper.append('div').classed('tsi-hierarchy', true);

                this.hierarchyInstancesWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-instances-wrapper', true);
                this.hierarchyInstances = this.hierarchyWrapper.append('div').classed('tsi-hierarchy-instances', true);

                this.pathSearch(getToken, environmentFqdn, self.requestPayload(), this.hierarchy);
            });
        });

        let autocompleteOnInput = (st) => {
            if(st.length === 0){
                this.setParamsForNavigate();
                this.hierarchyInstances.html('');
                (this.hierarchyInstancesWrapper.node() as any).style.display = 'none';
                (this.hierarchyWrapper.node() as any).style.display = 'block';
            }
            else {
                this.setParamsForSearch();
                this.hierarchyInstances.html('');
                (this.hierarchyWrapper.node() as any).style.display = 'none';
                (this.hierarchyInstancesWrapper.node() as any).style.display = 'block';
            }

            this.searchString = st;
            this.pathSearch(getToken, environmentFqdn, self.requestPayload(), this.hierarchyInstances);
        }
    }

    private setParamsForSearch () {
        this.mode = "search";
        this.hierarchyNavOptions.isInstancesRecursive = true;
        this.hierarchyNavOptions.isInstancesHighlighted = true;
        this.hierarchyNavOptions.instancesSort = InstancesSort.Rank;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.UntilFork;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.CumulativeInstanceCount;
    }

    private setParamsForNavigate () {
        this.mode = "navigate";
        this.hierarchyNavOptions.isInstancesRecursive = false;
        this.hierarchyNavOptions.isInstancesHighlighted = false;
        this.hierarchyNavOptions.instancesSort = InstancesSort.DisplayName;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.ByLevel;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.Name;
    }

    private requestPayload () {
        let payload = {};
        payload["searchString"] = this.searchString;
        payload["path"] = this.path;
        payload["instances"] = {recursive: this.hierarchyNavOptions.isInstancesRecursive, sort: {by: this.hierarchyNavOptions.instancesSort}, highlights: this.hierarchyNavOptions.isInstancesHighlighted, pageSize: this.hierarchyNavOptions.instancesPageSize};
        payload["hierarchies"] = {expand: {kind: this.hierarchyNavOptions.hierarchiesExpand}, sort: {by: this.hierarchyNavOptions.hierarchiesSort}, pageSize: this.hierarchyNavOptions.hierarchiesPageSize};

        return payload;
    }

    private renderTree (data, target) {
        let self = this;
        target.selectAll('.show-more.hierarchy').remove();
        target.selectAll('.show-more.instance').remove();
        var list = target.append('ul');
        Object.keys(data).forEach((el) => {
            var li = list.append('li').classed('tsi-leaf', data[el].isLeaf)
                .classed('tsi-leafParent', data[el].isLeaf);

            if(el === "Show More Hierarchies") {
                li.append('span').classed('tsi-markedName hierarchy show-more', true).attr('style', `padding-left: ${(data[el].level + 1) * 18}px`).html(el).on('click', data[el].onClick);
            } else if (el === "Show More Instances") {
                li.append('span').classed('tsi-markedName instance show-more', true).attr('style', `padding-left: ${(data[el].level + 1) * 18}px`).html(el).on('click', data[el].onClick);
            } else {
                li.append('span').classed('tsi-caret', true).attr('style', `left: ${(data[el].level) * 18}px`);
                li.append('span').classed('tsi-markedName', true).attr('style', `padding-left: ${(data[el].level + 1) * 18}px`).html(el).on('click', function() {
                    if (data[el].onClick) {
                        d3.event.stopPropagation();
                        self.closeContextMenu();
                        self.clickedInstance = data[el]; 
                        let mouseWrapper = d3.mouse(self.hierarchyWrapper.node());
                        let mouseElt = d3.mouse(this as any);
                        data[el].onClick(self.hierarchyWrapper, self.hierarchy, mouseWrapper[1], mouseElt[1]);
                    } else {
                        data[el].isExpanded ? data[el].collapse() : data[el].expand()
                    }
                });
            }
            data[el].node = li;
            data[el].isExpanded = false;
        });
    }

    private renderInstances (data, target) {
        let self = this;
        target.selectAll('.show-more.instance').remove();

        Object.keys(data).forEach((i) => {
            let div = target.append('div').html(this.getInstanceHtml(data[i])).on('click', function() {
                d3.event.stopPropagation();
                self.closeContextMenu();
                self.clickedInstance = data[i]; 
                let mouseWrapper = d3.mouse(self.hierarchyInstancesWrapper.node());
                let mouseElt = d3.mouse(this as any);
                data[i].onClick(self.hierarchyInstancesWrapper, self.hierarchy, mouseWrapper[1], mouseElt[1]);
            });
            data[i].node = div;
        });

        target.append('span').classed('tsi-markedName instance show-more', true).html("Show More Instances").on('click', data["Show More Instances"].onClick);
    }

    private pathSearch = (getToken, envFqdn, payload, target, instancesContinuationToken = null, hierarchiesContinuationToken = null) => {
        let self = this;
        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, envFqdn, payload, instancesContinuationToken, hierarchiesContinuationToken).then(r => {
                let data = {};
                if(this.selectedHierarchyId !== HierarchySelectionValues.Unparented) {
                    if (r.hierarchyNodes.hits.length > 0) {
                        r.hierarchyNodes.hits.forEach((h) => {
                            let hierarchy = new HierarchyNode(h.name, payload.path);
                            hierarchy.expand = () => {self.pathSearch(getToken, envFqdn, payload, hierarchy.node); hierarchy.isExpanded = true; hierarchy.node.classed('tsi-expanded', true);};
                            hierarchy.collapse = () => {hierarchy.isExpanded = false; hierarchy.node.classed('tsi-expanded', false); hierarchy.node.selectAll('ul').remove();};
                            data[(h.name === "" ? "(Empty)" : h.name) + " (" + h.cumulativeInstanceCount + ")"] = hierarchy;
                        });
                    }
                    if (r.hierarchyNodes.continuationToken && r.hierarchyNodes.continuationToken !== 'END') {
                        let showMorehierarchy = new HierarchyNode("Show More Hierarchies", payload.path);
                        showMorehierarchy.onClick = () => self.pathSearch(getToken, envFqdn, payload, target, null, r.hierarchyNodes.continuationToken);
                        data[showMorehierarchy.name] = showMorehierarchy;
                    }
                }
                if (r.instances.hits.length > 0) {
                    r.instances.hits.forEach((i) => {
                        data[i.timeSeriesId.join(" ")] = new InstanceNode(i.timeSeriesId, i.name, i.typeId, i.hierarchyIds, i.highlights, this.hierarchyNavOptions.onInstanceClick, payload.path.length);
                    });
                }
                if (r.instances.continuationToken && r.instances.continuationToken !== 'END') {
                    let showMoreInstances = new InstanceNode(null, "Show More Instances", null, null, null, this.hierarchyNavOptions.onInstanceClick, payload.path.length);
                    showMoreInstances.onClick = () => self.pathSearch(getToken, envFqdn, payload, target, null, r.instances.continuationToken);
                    data[showMoreInstances.name] = showMoreInstances;
                }

                if (this.mode === "navigate") {
                    this.renderTree(data, target);
                } else if (this.mode === "search") {
                    this.renderInstances(data, target);
                } else {

                }
            }).catch(function (err) {
                let data = {};
                let r = {
                    "instances": {
                        "hits": [
                            {
                                "timeSeriesId": [
                                    "006dfc2d-0324-4937-998c-d16f3b4f1952",
                                    "T1"
                                ],
                                "name": "instance1",
                                "typeId": "1be09af9-f089-4d6b-9f0b-48018b5f7393",
                                "hierarchyIds": [
                                    "1643004c-0a84-48a5-80e5-7688c5ae9295"
                                ],
                                "highlights": {
                                    "timeSeriesId": [
                                        "006dfc2d-0324-4937-998c-d16f3b4f1952",
                                        "T1"
                                    ],
                                    "type": "DefaultType",
                                    "name": "instance1",
                                    "description": "<hit>floor</hit> <hit>100</hit>",
                                    "instanceFieldNames": [
                                        "state",
                                        "city"
                                    ],
                                    "instanceFieldValues": [
                                        "California",
                                        "Los Angeles"
                                    ]
                                }
                            }
                        ],
                        "continuationToken": "aXsic2tpcCI6MTAwMCwidGFrZSI6MTAwMH0=",
                        "hitCount": 1,
                    },
                    "hierarchyNodes": {
                        "hits": [
                            {
                                "name": "Physical",
                                "cumulativeInstanceCount": 4214,
                            },
                            {
                                "name": "",
                                "cumulativeInstanceCount": 1,
                            }
                        ],
                        "hitCount": 2,
                        "continuationToken": "bHsic2tpcCI6MTEsInRha2UiOjExLCJyZXF1ZXN0SGFzaENvZGUiOi00Njk4MDY2MzYsImVudmlyb25tZW50SWQiOiI4ODcyOGI2Mi05NTRlLTQ5MzAtODM2Yy1jMzZlNTYwM2U1YTkifQ=="
                    }
                };
                if(self.selectedHierarchyId !== HierarchySelectionValues.Unparented) {
                    if (r.hierarchyNodes.hits.length > 0) {
                        r.hierarchyNodes.hits.forEach((h) => {
                            let hierarchy = new HierarchyNode(h.name, payload.path);
                            hierarchy.expand = () => {self.pathSearch(getToken, envFqdn, payload, hierarchy.node); hierarchy.isExpanded = true; hierarchy.node.classed('tsi-expanded', true);};
                            hierarchy.collapse = () => {hierarchy.isExpanded = false; hierarchy.node.classed('tsi-expanded', false); hierarchy.node.selectAll('ul').remove();};
                            data[(h.name === "" ? "(Empty)" : h.name) + " (" + h.cumulativeInstanceCount + ")"] = hierarchy;
                        });
                    }
                    if (r.hierarchyNodes.continuationToken && r.hierarchyNodes.continuationToken !== 'END') {
                        let showMorehierarchy = new HierarchyNode("Show More Hierarchies", payload.path);
                        showMorehierarchy.onClick = () => self.pathSearch(getToken, envFqdn, payload, target, null, r.hierarchyNodes.continuationToken);
                        data[showMorehierarchy.name] = showMorehierarchy;
                    }
                }
                if (r.instances.hits.length > 0) {
                    r.instances.hits.forEach((i) => {
                        data[i.timeSeriesId.join(" ")] = new InstanceNode(i.timeSeriesId, i.name, i.typeId, i.hierarchyIds, i.highlights, self.hierarchyNavOptions.onInstanceClick, payload.path.length);
                    });
                }
                if (r.instances.continuationToken && r.instances.continuationToken !== 'END') {
                    let showMoreInstances = new InstanceNode(null, "Show More Instances", null, null, null, self.hierarchyNavOptions.onInstanceClick, payload.path.length);
                    showMoreInstances.onClick = () => self.pathSearch(getToken, envFqdn, payload, target, null, r.instances.continuationToken);
                    data[showMoreInstances.name] = showMoreInstances;
                }

                if (self.mode === "navigate") {
                    self.renderTree(data, target);
                } else if (self.mode === "search") {
                    self.renderInstances(data, target);
                } else {

                }
            })
        });
    }

    private closeContextMenu() {
        if(this.clickedInstance && this.clickedInstance.contextMenu) {
            this.clickedInstance.contextMenu.remove();
            d3.selectAll('li.selected').classed('selected', false);
        }
    }

    private stripHits = (str) => {
        return str.split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>')
    }

    private getInstanceHtml(i) {
        return `<div class="tsi-modelResult">
                    <div class="tsi-modelPK">
                        ${i.highlights.name ? this.stripHits(i.highlights.name) : this.stripHits(i.highlights.timeSeriesIds.join(' '))}
                    </div>
                    <div class="tsi-modelHighlights">
                        ${this.stripHits(i.highlights.description && i.highlights.description.length ? i.highlights.description : 'No description')}
                        <br/><table>
                        ${i.highlights.name ? ('<tr><td>Time Series ID</td><td>' + this.stripHits(i.highlights.timeSeriesIds.join(' ')) + '</td></tr>') : ''}                        
                        ${i.highlights.instanceFieldNames.map((ifn, idx) => {
                            var val = i.highlights.instanceFieldValues[idx];
                            return val.length === 0 ? '' :  '<tr><td>' + this.stripHits(ifn) + '</td><td>' + this.stripHits(i.highlights.instanceFieldValues[idx]) + '</tr>';
                        }).join('')}
                        </table>
                    </div>
                </div>`;
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

function InstanceNode (tsId, name = null, typeId, hierarchyIds, highlights, contextMenuFunc, level) {
    this.timeSeriesId = tsId;
    this.name = name;
    this.typeId = typeId;
    this.hierarchyIds = hierarchyIds;
    this.highlights = highlights;
    this.onClick = (hierarchyWrapper, hierarchy, wrapperMousePos, eltMousePos, fromKeyboard = false) => {
        this.node.classed('selected', true);
        this.prepareForContextMenu(hierarchyWrapper, hierarchy, wrapperMousePos, eltMousePos)
        contextMenuFunc(this);
    };
    this.prepareForContextMenu = (hierarchyWrapper, hierarchy, wrapperMousePos, eltMousePos) => {
        this.contextMenuProps = {};
        this.contextMenuProps['hierarchyWrapper'] = hierarchyWrapper;
        this.contextMenuProps['hierarchy'] = hierarchy;
        this.contextMenuProps['wrapperMousePos'] = wrapperMousePos;
        this.contextMenuProps['eltMousePos'] = eltMousePos;
    }
    this.drawContextMenu = (contextMenuActions) => {
        this.contextMenu = this.contextMenuProps['hierarchyWrapper'].append('div').classed('tsi-hierarchyNavigationContextMenu', true).attr('style', () => `top: ${this.contextMenuProps['wrapperMousePos'] - this.contextMenuProps['eltMousePos']}px`);
        var contextMenuList = this.contextMenu.append('ul');
        contextMenuActions.forEach((a) => {
            var option = Object.keys(a)[0];
            contextMenuList.append('li').html(option).on('click', a[option]);
        });
        this.contextMenuProps['hierarchy'].attr('style', `padding-bottom: ${this.contextMenu.node().getBoundingClientRect().height}px`);
    }
    this.isLeaf = true;
    this.level = level;
    this.node = null;
}

function HiararchyNavigationOptions () {
    this.instancesPageSize = 10;
    this.hierarchiesPageSize = 10;
    this.isInstancesRecursive = false;
    this.isInstancesHighlighted = false;
    this.instancesSort = InstancesSort.DisplayName;
    this.hierarchiesExpand = HierarchiesExpand.ByLevel;
    this.hierarchiesSort = HierarchiesSort.Name;
    this.theme = Theme.light;

    this.setOptions = (options) => {
        this.instancesPageSize = options['instancesPageSize'] ? options['instancesPageSize'] : this.instancesPageSize; 
        this.hierarchiesPageSize = options['hierarchiesPageSize'] ? options['hierarchiesPageSize'] : this.hierarchiesPageSize; 
        this.isInstancesRecursive = options['isInstancesRecursive'] ? options['isInstancesRecursive'] : this.isInstancesRecursive; 
        this.isInstancesHighlighted = options['isInstancesHighlighted'] ? options['isInstancesHighlighted'] : this.isInstancesHighlighted; 
        this.instancesSort = options['instancesSort'] && options['instancesSort'] in InstancesSort ? options['instancesSort'] : this.instancesSort; 
        this.hierarchiesExpand = options['hierarchiesExpand'] && options['hierarchiesExpand'] in HierarchiesExpand ? options['hierarchiesExpand'] : this.hierarchiesExpand; 
        this.hierarchiesSort = options['hierarchiesSort'] && options['hierarchiesSort'] in HierarchiesSort ? options['hierarchiesSort'] : this.hierarchiesSort; 
        this.theme = options['theme'] && options['theme'] in Theme ? options['theme'] : this.theme;
        if (options['onInstanceClick']) {
            this.onInstanceClick = options["onInstanceClick"];
        } 
    }
}

export enum InstancesSort {"DisplayName", "Rank"};
export enum HierarchiesExpand {"UntilFork", "ByLevel"};
export enum HierarchiesSort {"Name", "CumulativeInstanceCount"};
export enum HierarchySelectionValues {"All" = "0", "Unparented" = "-1"};
export enum Theme {"light", "dark"};
type State = "navigate" | "search" | "filter";

export {HierarchyNavigation}
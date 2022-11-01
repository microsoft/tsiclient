import * as d3 from 'd3';
import './ModelSearch.scss';
import Utils from "../../Utils";
import {Component} from "./../../Interfaces/Component";
import ServerClient from '../../../ServerClient';
import 'awesomplete';
import Hierarchy from '../Hierarchy/Hierarchy';
import ModelAutocomplete from '../ModelAutocomplete/ModelAutocomplete';

class ModelSearch extends Component{
    private server: ServerClient; 
    private hierarchies;
    private clickedInstance;
    private wrapper;
    private types;
    private instanceResults;
    private usedContinuationTokens = {};
    private contextMenu; 
    private currentResultIndex= -1;

	constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.clickedInstance && event.target != this.clickedInstance && this.contextMenu) {
                this.closeContextMenu();
                this.clickedInstance = null;
            }
        })
	}

	ModelSearch(){
	}
	
	public render(environmentFqdn: string, getToken: any, hierarchyData: any, chartOptions: any){
        this.chartOptions.setOptions(chartOptions);
        let self = this;
        let continuationToken, searchText;
        let targetElement = d3.select(this.renderTarget);	
        targetElement.html('');	
        this.wrapper = targetElement.append('div').attr('class', 'tsi-modelSearchWrapper');
        super.themify(this.wrapper, this.chartOptions.theme);
        let inputWrapper = this.wrapper.append("div")
            .attr("class", "tsi-modelSearchInputWrapper");

        let autocompleteOnInput = (st, event) => {
            self.usedContinuationTokens = {};

            // blow results away if no text
            if(st.length === 0){
                searchText = st;
                self.instanceResults.html('');
                self.currentResultIndex= -1;
                (hierarchyElement.node() as any).style.display = 'block';
                (showMore.node() as any).style.display = 'none';
                noResults.style('display', 'none');
            }
            else if (event.which === 13 || event.keyCode === 13) {
                (hierarchyElement.node() as any).style.display = 'none';
                self.instanceResults.html('');
                self.currentResultIndex = -1;
                noResults.style('display', 'none');
                searchInstances(st);
                searchText = st;
            }  
        }

        let modelAutocomplete = new ModelAutocomplete(inputWrapper.node());
        modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, onKeydown: (event, ap) => {this.handleKeydown(event, ap)}, ...chartOptions});
        var ap = modelAutocomplete.ap;

        let results = this.wrapper.append('div')
            .attr("class", "tsi-modelSearchResults").on('scroll', function(){
                self.closeContextMenu();
                let that = this as any;
                if(that.scrollTop + that.clientHeight + 150 > (self.instanceResults.node() as any).clientHeight && searchText.length !== 0){
                    searchInstances(searchText, continuationToken);
                }
            })
        let noResults = results.append('div').text(this.getString('No results')).classed('tsi-noResults', true).style('display', 'none');
        let instanceResultsWrapper = results.append('div').attr('class', 'tsi-modelSearchInstancesWrapper')
        this.instanceResults = instanceResultsWrapper.append('div').attr('class', 'tsi-modelSearchInstances');
        let showMore = instanceResultsWrapper.append('div').attr('class', 'tsi-showMore').text(this.getString('Show more') + '...').on('click', () => searchInstances(searchText, continuationToken)).style('display', 'none');

        let hierarchyElement = this.wrapper.append('div')
            .attr("class", "tsi-hierarchyWrapper");
        let hierarchy = new Hierarchy(hierarchyElement.node() as any);
        hierarchy.render(hierarchyData, {...this.chartOptions, withContextMenu: true});

        let searchInstances = (searchText, ct = null) => {
            var self = this;
            if(ct === 'END')
                return;
            if(ct === null || !self.usedContinuationTokens[ct]){
                self.usedContinuationTokens[ct] = true;
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSearch(token, environmentFqdn, searchText, ct).then((r: any) => {
                        let instances;
                        if (Array.isArray(r.instances)) {
                            continuationToken = r.instancesContinuationToken;
                            instances = r.instances;
                        } else { //new search api with the support of hierarchy navigation
                            if (r.instances.hasOwnProperty('hits')) {
                                instances = r.instances.hits;
                                continuationToken = r.instances.hits.continuationToken;
                            }
                            
                        }
                        
                        if(!continuationToken)
                            continuationToken = 'END';
                        (showMore.node() as any).style.display = continuationToken !== 'END' ? 'block' : 'none';
                        if(instances.length == 0){
                            noResults.style('display', 'block');
                        }
                        else{
                            noResults.style('display', 'none');
                        }
                        instances.forEach(i => {
                            let handleClick = (elt, wrapperMousePos, eltMousePos, fromKeyboard = false) => {
                                self.closeContextMenu();
                                if(self.clickedInstance != elt){
                                    self.clickedInstance = elt;

                                    i.type = self.types.filter(t => {
                                        return t.name.replace(/\s/g, '') === (i.highlights.type ? i.highlights.type.split('<hit>').join('').split('</hit>').join('').replace(/\s/g, '') : i.highlights.typeName.split('<hit>').join('').split('</hit>').join('').replace(/\s/g, ''));
                                    })[0];
                                    let contextMenuActions = self.chartOptions.onInstanceClick(i);
                                    self.contextMenu = self.wrapper.append('div');
                                    if(!Array.isArray(contextMenuActions)){
                                        contextMenuActions = [contextMenuActions];
                                    }
                                    let totalActionCount = contextMenuActions.map(cma => Object.keys(cma).length).reduce((p,c) => p + c, 0);
                                    let currentActionIndex = 0
                                    contextMenuActions.forEach((cma, cmaGroupIdx) => {
                                        Object.keys(cma).forEach((k, kIdx, kArray) => {
                                            let localActionIndex = currentActionIndex;
                                            self.contextMenu.append('div').text(k).on('click', cma[k]).on('keydown', function(event){
                                                let evt = event;
                                                if(evt.keyCode === 13){
                                                    this.click();
                                                }
                                                if(evt.keyCode === 13 || evt.keyCode === 37){
                                                    self.closeContextMenu();
                                                    let results = self.instanceResults.selectAll('.tsi-modelResultWrapper')
                                                    results.nodes()[self.currentResultIndex].focus();
                                                }
                                                if(evt.keyCode === 40 && (localActionIndex + 1 < totalActionCount)){ // down
                                                    self.contextMenu.node().children[localActionIndex + 1 + cmaGroupIdx + (kIdx === (kArray.length - 1) ? 1 : 0)].focus();
                                                }
                                                if(evt.keyCode === 38 && localActionIndex > 0){ // up
                                                    self.contextMenu.node().children[localActionIndex - 1 + cmaGroupIdx - (kIdx === 0 ? 1 : 0)].focus();
                                                }
                                            }).attr('tabindex', '0');
                                            currentActionIndex++;
                                        });
                                        self.contextMenu.append('div').classed('tsi-break', true);
                                    })
                                    self.contextMenu.attr('style', () => `top: ${wrapperMousePos - eltMousePos}px`);
                                    self.contextMenu.classed('tsi-modelSearchContextMenu', true);
                                    d3.select(elt).classed('tsi-resultSelected', true);
                                    if(self.contextMenu.node().children.length > 0 && fromKeyboard){
                                        self.contextMenu.node().children[0].focus();
                                    }
                                }
                                else{
                                    self.clickedInstance = null;
                                }
                            }
                            this.instanceResults.append('div').html(self.getInstanceHtml(i)) // known unsafe usage of .html
                            .on('click', function(event) {
                                let mouseWrapper = d3.pointer(event, self.wrapper.node());
                                let mouseElt = d3.pointer(event);
                                handleClick(this, mouseWrapper[1], mouseElt[1]);
                            })
                            .on('keydown', (event) => {
                                let evt = event;
                                if(evt.keyCode === 13){
                                    let resultsNodes = this.instanceResults.selectAll('.tsi-modelResultWrapper').nodes();
                                    let height = 0;
                                    for(var i = 0; i < this.currentResultIndex; i++) {
                                        height += resultsNodes[0].clientHeight;
                                    }
                                    handleClick(this.instanceResults.select('.tsi-modelResultWrapper:focus').node(), height - results.node().scrollTop + 48, 0, true);
                                }
                                self.handleKeydown(evt, ap);
                            }).attr('tabindex', '0').classed('tsi-modelResultWrapper', true);                            
                        })
                    })
                })
            }
        }

        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then((r: any) => {
                this.hierarchies = r.hierarchies;
            })
        })

        // get types
        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then((r: any) => {
                this.types = r.types;
            })
        })
    }

    public handleKeydown(event, ap) {
        if(!ap.isOpened) {
            let results = this.instanceResults.selectAll('.tsi-modelResultWrapper')
            if(results.size()) {
                if(event.keyCode === 40 && this.currentResultIndex < results.nodes().length - 1) {
                    this.currentResultIndex++;
                    results.nodes()[this.currentResultIndex].focus();
                }
                else if(event.keyCode === 38){
                    this.currentResultIndex--;
                    if(this.currentResultIndex <= -1){
                        this.currentResultIndex = -1;
                        ap.input.focus();
                    }
                    else{
                        results.nodes()[this.currentResultIndex].focus();
                    }
                }
            }
        }
    }

    private closeContextMenu() {
        if(this.contextMenu){
            this.contextMenu.remove();
        }
        d3.selectAll('.tsi-resultSelected').classed('tsi-resultSelected', false);
    }

    private stripHits = (str) => {
        return str.split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>')
    }

    private getInstanceHtml(i) {
        return `<div class="tsi-modelResult">
                    <div class="tsi-modelPK">
                        ${i.highlights.name ? this.stripHits(i.highlights.name) : this.stripHits(i.highlights.timeSeriesIds ? i.highlights.timeSeriesIds.join(' ') : i.highlights.timeSeriesId.join(' '))}
                    </div>
                    <div class="tsi-modelHighlights">
                        ${this.stripHits(i.highlights.description && i.highlights.description.length ? i.highlights.description : this.getString('No description'))}
                        <br/><table>
                        ${i.highlights.name ? ('<tr><td>' + this.getString("Time Series ID") + '</td><td>' + this.stripHits(i.highlights.timeSeriesIds ? i.highlights.timeSeriesIds.join(' ') : i.highlights.timeSeriesId.join(' ')) + '</td></tr>') : ''}                        
                        ${i.highlights.instanceFieldNames.map((ifn, idx) => {
                            var val = i.highlights.instanceFieldValues[idx];
                            if (ifn.indexOf('<hit>') !== -1 || val.indexOf('<hit>') !== -1) {
                                return val.length === 0 ? '' :  '<tr><td>' + this.stripHits(ifn) + '</td><td>' + this.stripHits(val) + '</tr>';
                            }
                        }).join('')}
                        </table>
                    </div>
                </div>`;
    }
}

export default ModelSearch

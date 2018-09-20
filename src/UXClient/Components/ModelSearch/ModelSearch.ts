import * as d3 from 'd3';
import './ModelSearch.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import 'awesomplete';
import { Hierarchy } from '../Hierarchy/Hierarchy';
import { ChartOptions } from '../../Models/ChartOptions';

class ModelSearch extends Component{
    private server: ServerClient; 
    private model;
    private hierarchies;
    private clickedInstance;
    private types;
	public chartOptions: ChartOptions = new ChartOptions;
    private usedContinuationTokens = {};
    private contextMenu; 

	constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.clickedInstance && d3.event.target != this.clickedInstance && this.contextMenu) {
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
        let wrapper = targetElement.append('div').attr('class', 'tsi-modelSearchWrapper');
        super.themify(wrapper, this.chartOptions.theme);
        let inputWrapper = wrapper.append("div")
            .attr("class", "tsi-modelSearchInputWrapper");
        let input = inputWrapper.append("input")
            .attr("class", "tsi-modelSearchInput")
            .attr("placeholder", "Search...");
        let Awesomplete = (window as any).Awesomplete;
        let ap = new Awesomplete(input.node(), {minChars: 1});
        let noSuggest = false;
        (input.node() as any).addEventListener('awesomplete-selectcomplete', () => {noSuggest = true; input.dispatch('input'); ap.close();});

        let results = wrapper.append('div')
            .attr("class", "tsi-modelSearchResults").on('scroll', function(){
                let that = this as any;
                if(that.scrollTop + that.clientHeight + 150 > (instanceResults.node() as any).clientHeight){
                    searchInstances(searchText, continuationToken);
                }
            })
        let instanceResultsWrapper = results.append('div').attr('class', 'tsi-modelSearchInstancesWrapper')
        let instanceResults = instanceResultsWrapper.append('div').attr('class', 'tsi-modelSearchInstances');
        let showMore = instanceResultsWrapper.append('div').attr('class', 'tsi-showMore').html('Show more...').on('click', () => searchInstances(searchText, continuationToken));

        let hierarchyElement = wrapper.append('div')
            .attr("class", "tsi-hierarchyWrapper");
        let hierarchy = new Hierarchy(hierarchyElement.node() as any);
        hierarchy.render(hierarchyData, this.chartOptions);

        input.on('keyup', function(){
            if(d3.event.which === 13 || d3.event.keyCode === 13){
                noSuggest = true;
                ap.close();
            }
        });

        input.on('input', function() { 
            searchText = (<any>this).value;
            self.usedContinuationTokens = {};

            // blow results away if no text
            if(searchText.length === 0){
                instanceResults.html('');
                (hierarchyElement.node() as any).style.display = 'block';
                (showMore.node() as any).style.display = 'none';
                return;
            }
            (hierarchyElement.node() as any).style.display = 'none';
            if(!noSuggest){
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSuggestions(token, environmentFqdn, searchText).then(r => {
                        ap.list = r.suggestions.map(s => s.searchString);
                    })
                })
            }
            noSuggest = false;

            instanceResults.html('');
            searchInstances(searchText);
        })

        let searchInstances = (searchText, ct = null) => {
            var self = this;
            if(ct === 'END')
                return;
            if(ct === null || !self.usedContinuationTokens[ct]){
                self.usedContinuationTokens[ct] = true;
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSearch(token, environmentFqdn, searchText, ct).then(r => {
                        continuationToken = r.instancesContinuationToken;
                        if(!continuationToken)
                            continuationToken = 'END';
                        (showMore.node() as any).style.display = continuationToken !== 'END' ? 'block' : 'none';
                        r.instances.forEach(i => {
                            instanceResults.append('div').html(self.getInstanceHtml(i)).on('click', function() {
                                self.closeContextMenu();
                                if(self.clickedInstance != this){
                                    self.clickedInstance = this;
                                    i.type = self.types.filter(t => t.name === i.highlights.type)[0];
                                    let contextMenuActions = self.chartOptions.onInstanceClick(i);
                                    self.contextMenu = d3.select(this).append('div').classed('tsi-modelSearchContextMenu', true);
                                    let contextMenuOptions = self.contextMenu.append('ul');
                                    Object.keys(contextMenuActions).forEach(k => {
                                        contextMenuOptions.append('li').html(k).on('click', contextMenuActions[k]);
                                    });
                                }
                                else{
                                    self.clickedInstance = null;
                                }
                            });                            
                        })
                    })
                })
            }
        }

        // get model
        getToken().then(token => {
            this.server.getTimeseriesModel(token, environmentFqdn).then(r => {
                this.model = r.model;
            })
        })

        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then(r => {
                this.hierarchies = r.hierarchies;
            })
        })

        // get types
        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                this.types = r.types;
            })
        })
    }

    private closeContextMenu() {
        if(this.contextMenu){
            this.contextMenu.remove();
        }
    }

    private getInstanceHtml(i) {
        return `<div class="tsi-modelResult">
                    <div class="tsi-modelPK">
                        ${Utils.strip(i.partitionKeyValue.join(' '))}
                    </div>
                    <div class="tsi-modelHighlights">
                        ${Object.keys(i.highlights).map(k => {
                            if(typeof(i.highlights[k]) === 'object'){
                                i.highlights[k] = i.highlights[k].join(' ');
                            }
                            let highlighted = i.highlights[k].split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>');
                            return Utils.strip(k) + ': ' + highlighted;
                        }).join('<br/>')}
                    </div>
                </div>`
    }
}

export {ModelSearch}

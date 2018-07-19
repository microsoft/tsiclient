import * as d3 from 'd3';
import './ModelSearch.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import TsiClient from '../../../TsiClient';

class ModelSearch extends Component{
    private tsiClient;
    private model;
    private types;

	constructor(renderTarget: Element){
        super(renderTarget);
        this.tsiClient = new TsiClient();
	}

	ModelSearch(){
	}
	
	public render(environmentFqdn: string, getToken: any, options: any){
        let self = this;
        let targetElement = d3.select(this.renderTarget);	
        targetElement.html('');	
        let wrapper = targetElement.append('div').attr('class', 'tsi-modelSearchWrapper');
        super.themify(wrapper, options && options.theme ? options.theme : null);
        let inputWrapper = wrapper.append("div")
            .attr("class", "tsi-modelSearchInputWrapper");
        let input = inputWrapper.append("input")
            .attr("class", "tsi-modelSearchInput");

        let onClick = (v) => {console.log(v)};

        let results = wrapper.append('div')
            .attr("class", "tsi-modelSearchResults");
        let facetResults = results.append('div').attr('class', 'tsi-modelSearchFacets');
        let instanceResults = results.append('div').attr('class', 'tsi-modelSearchInstances');

        input.on('input', function() {
                
                // blow results away if no text
                if((<any>this).value.length === 0 ){
                    facetResults.html('');
                    instanceResults.html('');
                    return;
                }

                getToken().then(token => {
                    self.tsiClient.server.getTimeseriesInstancesSuggestions(token, environmentFqdn, (<any>this).value).then(r => {console.log(r)})
                })
                getToken().then(token => {
                    self.tsiClient.server.getTimeseriesInstancesSearch(token, environmentFqdn, (<any>this).value).then(r => {
                        instanceResults.html('');
                        r.instances.forEach(i => {
                            instanceResults.append('div').html(`<div class="tsi-modelResult">
                                <div class="tsi-modelPK">
                                    ${Utils.strip(i.partitionKeyValue.join(' '))}
                                </div>
                                <div class="tsi-modelHighlights">
                                    ${Object.keys(i.highlights).map(k => {
                                        if(k === 'partitionKeyValue'){
                                            i.highlights[k] = i.highlights[k].join(' ');
                                        }
                                        let highlighted = i.highlights[k].split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>');
                                        return Utils.strip(k) + ': ' + highlighted;
                                    }).join('<br/>')}
                                </div>
                            </div>`).on('click', () => onClick(JSON.stringify(i)));
                    })
                    facetResults.html('One day facets will go here');
                })
            })
        })

        // get model
        getToken().then(token => {
            tsiClient.server.getTimeseriesModel(token, environmentFqdn).then(r => {
                this.model = r.model;
            })
        })

        // get types
        getToken().then(token => {
            tsiClient.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                this.types = r.types;
            })
        })
    }
}

export {ModelSearch}

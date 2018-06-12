import * as d3 from 'd3';
import './Slider.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";

class Slider extends Component{
    private sliderSVG: any = null;
    public sliderTextDiv: any = null;
    private xScale: any;
    private data;
    private width: number;
    private sliderWidth: number;
    private selectedLabel: string;

    private margins = {
        left: 60,
        right: 60
    }
    private height = 55;
	
	constructor(renderTarget: Element){
		super(renderTarget);
	}

	Slider() {
	}
	
	public render(data: Array<any>, options: any, width: number, selectedLabel: string = null){
        this.data = data;
        this.width = width;
        var marginsTotal = this.margins.left + this.margins.right
        this.sliderWidth = width - marginsTotal;
		var targetElement = d3.select(this.renderTarget);		
		if(targetElement.style("position") == "static")
            targetElement.style("position", "relative");
        if (selectedLabel)
            this.selectedLabel = selectedLabel;

        this.xScale = d3.scalePoint()
            .domain(data.map((d) => d.label))
            .range([0, this.sliderWidth]);

        width = Math.max(width, marginsTotal);
        var self = this;
        var theme = Utils.getTheme(options.theme);
        
        if (this.sliderSVG == null) {
            this.sliderSVG = targetElement.append("svg")
                .attr("class", "tsi-sliderComponent");
            var slider = this.sliderSVG.append("g")
                .attr("class", "slider tsi-sliderG")
            var sliderTestDiv = targetElement.append("div")
                .attr("class", "tsi-sliderLabel");
            slider.append("line")
                .attr("class", "slider-track tsi-sliderTrack")
                .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                .attr("class", "track-overlay tsi-sliderTrackOverlay")
                .call(d3.drag()
                    .on("start.interrupt", function() { slider.interrupt(); })
                    .on("start drag", (d) => { 
                        self.onDrag(d3.event.x); 
                    })
                );

            slider.insert("circle", ".track-overlay")
                .attr("class", "handle tsi-sliderHandle")
                .attr("r", 6);

            this.sliderTextDiv = targetElement.append("div")
                .attr("class", "tsi-sliderLabel")
                .classed(theme, true)
                .attr("tabindex", 0)
                .on("keydown", () => {
                    if (d3.event.keyCode == 37) {
                        this.moveLeft();
                    }
                    if (d3.event.keyCode == 39) {
                        this.moveRight();
                    }
                });
        }

        this.sliderSVG.classed(theme, true)
            .attr("width", width + "px");

        var slider = this.sliderSVG.select(".tsi-sliderG")
                                   .attr("transform", "translate(" + this.margins.left + "," + (this.height / 2) + ")");

        slider.select(".tsi-sliderTrack")
            .attr("x1", 0)
            .attr("x2", this.sliderWidth)
            .attr("y1", 0)
            .attr("y2", 0);
        slider.select(".tsi-sliderTrackOverlay")
            .attr("x1", -20)
            .attr("x2", this.sliderWidth + 20)
            .attr("y1", 0)
            .attr("y2", 0);

        this.setStateFromLabel();
    }

    public remove() {
        if(this.sliderSVG)
            this.sliderSVG.remove();
        this.sliderSVG = null;
    }

    private onDrag (h) {
        //find the closest time and set position to that
        var newSelectedLabel = this.data.reduce((prev, curr) => {
            var currDiff = Math.abs(this.xScale(curr.label) - h);
            var prevDiff = Math.abs(this.xScale(prev.label) - h);
            return (currDiff < prevDiff) ? curr : prev;
        }, {label: this.selectedLabel, action: () => {}});
        this.selectedLabel = (newSelectedLabel != null) ? newSelectedLabel.label : this.selectedLabel;
        newSelectedLabel.action(newSelectedLabel.label);

        this.setStateFromLabel(); 
    }
    
    //set the position of the slider and text, and set the text, given a label
    private setStateFromLabel () {
        this.sliderSVG.select(".handle").attr("cx", this.xScale(this.selectedLabel));
        this.sliderTextDiv.text(this.selectedLabel);
        //adjust until center lines up with 
        var centerDivOffset = this.sliderTextDiv.node().getBoundingClientRect().width / 2;
        this.sliderTextDiv.style("right", (this.width - (this.margins.right + this.xScale(this.selectedLabel))) - centerDivOffset + "px");
    }

    private moveLeft () {
        for (var i = 0; i < this.data.length; i++) {
            if (this.data[i].label == this.selectedLabel) {
                var newI = Math.max(0, i - 1);
                this.selectedLabel = this.data[newI].label;
                this.data[newI].action(this.selectedLabel);
                this.setStateFromLabel();
                return;
            }
        }
    }

    private moveRight () {
        for (var i = 0; i < this.data.length; i++) {
            if (this.data[i].label == this.selectedLabel) {
                var newI = Math.min(this.data.length - 1, i + 1);
                this.selectedLabel = this.data[newI].label;
                this.data[newI].action(this.selectedLabel);
                this.setStateFromLabel();
                return;
            }
        }
    }
}

export {Slider}

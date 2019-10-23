import * as d3 from 'd3';
import './PlaybackControls.scss';
import { Component } from "./../../Interfaces/Component";

class PlaybackControls extends Component {
  private playbackInterval: number;
  private playButton: d3.Selection<d3.BaseType, unknown, null, undefined>;
  private trackWidth;
  private trackPositionToLabelMapper;
  private handleElement;
  private handleNotches: Array<number>;
  private data;
  private controlsContainer;
  private selectedLabelIndex: number;
  private onGetLatest: Function;
  private options: any;

  constructor(renderTarget: Element){
    super(renderTarget);
    this.playbackInterval = null;
    this.selectedLabelIndex = 0;
  }
  
  render(data: Array<any>, options: any, onGetLatest: Function = null) {
    this.data = data;
    this.onGetLatest = onGetLatest;
    this.options = options;

    let targetElement = d3.select(this.renderTarget);
    targetElement.html('');

    let sliderContainer = targetElement.append('div')
      .classed('tsi-playback-timeline', true);

    let sliderContainerWidth = (<any>sliderContainer.node()).clientWidth;
    let sliderContainerHeight = (<any>sliderContainer.node()).clientHeight;
    let handleRadius = 7;
    let trackStrokeWidth = 5;
    this.trackWidth = sliderContainerWidth;

    this.handleNotches = data.map((v, index) => {
      if (index === 0) { return 0; }
      if (index === data.length - 1) { return this.trackWidth; }
      return Math.floor((this.trackWidth / data.length) * (index + 0.5));
    });

    let bucketWidthPixels = this.trackWidth / (this.data.length - 1);
    let offset = Math.floor(bucketWidthPixels / 2);
    this.trackPositionToLabelMapper = d3.scaleQuantize()
      .domain([-offset, this.trackWidth + offset])
      .range(d3.range(data.length));
    
    let gWrapper = sliderContainer
      .append('svg')
      .append('g');

    let track = gWrapper.append('line')
      .classed('tsi-playback-track', true);
    
    track.attr('x1', handleRadius)
      .attr('y1', Math.floor(sliderContainerHeight / 2))
      .attr('x2', this.trackWidth - handleRadius)
      .attr('y2', Math.floor(sliderContainerHeight / 2))
      .style('stroke-width', trackStrokeWidth)
    
    gWrapper.call(d3.drag()
        .on('start.interrupt', () => { gWrapper.interrupt(); })
        .on('start drag', () => {
          this.onDrag(d3.event.x);
        })
        .on('end', () => {
          this.onDragEnd();
        })
      );

    this.handleElement = gWrapper.append('circle')
      .classed('tsi-playback-handle', true)
      .attr('cx', handleRadius)
      .attr('cy', Math.floor(sliderContainerHeight / 2))
      .attr('r', handleRadius);

    this.controlsContainer = targetElement.append('div')
      .classed('tsi-playback-buttons', true);
    
    this.playButton = this.controlsContainer.append('button')
      .classed('tsi-play-button', true)
      .on('click', () => {
        if (this.playbackInterval === null) {
          this.play();
        } else {
          this.pause();
        }
      });

    this.controlsContainer.append('span')
      .classed('tsi-playback-timestamp', true)
      .text(data[0].label);
  }

  next() {
    // If we are already at the timeline, trigger the onGetLatest() callback instead.
    if (this.selectedLabelIndex === this.data.length - 1 && this.onGetLatest) {
      this.onGetLatest();
    } else {
      this.selectedLabelIndex++;
      this.setStateFromLabelIndex(this.selectedLabelIndex);
      this.triggerCurrentAction();
    }
  }

  play() {
    if (this.playbackInterval === null) {
      this.playbackInterval = window.setInterval(this.next.bind(this), this.options.getLatestInterval || 2000);
      this.playButton
      .classed('tsi-play-button', false)
      .classed('tsi-pause-button', true);
    }
  }

  pause() {
    // Pause only if component is in 'play' mode (i.e. an interval has ben set)
    // otherwise, do nothing.
    if (this.playbackInterval !== null) {
      window.clearInterval(this.playbackInterval);
      this.playbackInterval = null;
      this.playButton
        .classed('tsi-play-button', true)
        .classed('tsi-pause-button', false);
    }
  }

  private onDrag(positionX: number) {
    this.updateHandleSelection(positionX);
  }

  private onDragEnd() {
    this.triggerCurrentAction();
  }

  private updateHandleSelection(positionX: number) {
    this.selectedLabelIndex = this.trackPositionToLabelMapper(positionX);
    this.setStateFromLabelIndex(this.selectedLabelIndex);
  }

  private setStateFromLabelIndex(labelIndex: number) {
    this.handleElement.attr('cx', this.handleNotches[labelIndex]);
    let tsqExpression = this.data[labelIndex];
    this.controlsContainer
      .select('.tsi-playback-timestamp')
      .text(tsqExpression.label);
  }

  private triggerCurrentAction() {
    let tsqExpression = this.data[this.selectedLabelIndex];
    if (typeof(tsqExpression.action) === 'function') { tsqExpression.action(); }
  }
}

export { PlaybackControls };
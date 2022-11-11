import * as d3 from 'd3';
import './ProcessGraphic.scss';
import HistoryPlayback, { GraphicInfo } from "./../../Components/HistoryPlayback";
import ServerClient from '../../../ServerClient';
import Utils from '../../Utils';
import TsqExpression from '../../Models/TsqExpression';

class ProcessGraphic extends HistoryPlayback {
  private graphicSrc: string;
  constructor(renderTarget: Element){ 
    super(renderTarget); 
    this.serverClient = new ServerClient();
    this.currentCancelTrigger = null;
  }

  render(environmentFqdn: string, 
    getToken: () => Promise<string>, 
    graphicSrc: string, 
    data: Array<TsqExpression>, 
    chartOptions) {
      this.graphicSrc = graphicSrc;
      this.renderBase(environmentFqdn, getToken, data, chartOptions);
  }

  protected loadResources(): Promise<GraphicInfo> {
    return new Promise((resolve, reject) => {
      let image = new Image();

      image.onload = () => {
        this.graphic = image;
        this.graphicOriginalWidth = image.width;
        this.graphicOriginalHeight = image.height;
        
        (this.component.node() as any).appendChild(this.graphic);
        
        resolve(null);
      }

      image.onerror = (errorMessage) => {
        console.log(errorMessage);
        reject(errorMessage);
      }

      image.src = this.graphicSrc;
    });
  }

  protected draw(){

    let graphicContainerWidth = this.renderTarget.clientWidth;
    let graphicContainerHeight = this.renderTarget.clientHeight - this.playbackSliderHeight;

    this.componentContainer
      .style('width', `${graphicContainerWidth}px`)
      .style('height', `${graphicContainerHeight}px`);

    let resizedImageDim = this.getResizedImageDimensions(
      graphicContainerWidth,
      graphicContainerHeight,
      this.graphicOriginalWidth,
      this.graphicOriginalHeight);

    this.component
      .style('width', `${resizedImageDim.width}px`)
      .style('height', `${resizedImageDim.height}px`);

      this.drawBase();

  }

  private getResizedImageDimensions(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
    if (containerWidth >= imageWidth && containerHeight >= imageHeight) {
      return {
        width: imageWidth,
        height: imageHeight
      }
    }

    // Calculate the factor we would need to multiply width by to make it fit in the container.
    // Do the same for height. The smallest of those two corresponds to the largest size reduction
    // needed. Multiply both width and height by the smallest factor to a) ensure we maintain the
    // aspect ratio of the image b) ensure the image fits inside the container.
    let widthFactor = containerWidth / imageWidth;
    let heightFactor = containerHeight / imageHeight;
    let resizeFactor = Math.min(widthFactor, heightFactor);

    return {
      width: imageWidth * resizeFactor,
      height: imageHeight * resizeFactor
    }
  }

  protected getDataPoints(results: Array<IProcessGraphicLabelInfo>){
    if(Array.isArray(results)){
      let dataPoints = results.map((r, i): IProcessGraphicLabelInfo => {
        let value = this.parseTsqResponse(r);
        let color = typeof(this.tsqExpressions[i].color) === 'function'
          ? (<Function>this.tsqExpressions[i].color)(value)
          : this.tsqExpressions[i].color;
        return {
          value,
          alias: this.tsqExpressions[i].alias,
          x: this.tsqExpressions[i].positionX,
          y: this.tsqExpressions[i].positionY,
          color: this.sanitizeAttribute(color),
          onClick: this.tsqExpressions[i].onElementClick
        };
      });
      this.updateDataMarkers(dataPoints);
    }
  }
  protected updateDataMarkers(graphicValues: Array<IProcessGraphicLabelInfo>) {
    let textElements = this.component.selectAll<HTMLDivElement, unknown>('div')
      .data(graphicValues);

    let newElements = textElements.enter()
      .append('div')
      .classed('tsi-process-graphic-label', true);

    newElements.append('div')
      .classed('title', true);

    newElements.append('div')
      .classed('value', true);

    newElements.merge(textElements)
      .classed('tsi-dark', false)
      .classed('tsi-light', false)
      .classed(Utils.getTheme(this.chartOptions.theme), true)
      .style('left', tsqe => `${tsqe.x}%`)
      .style('top', tsqe => `${tsqe.y}%`);

    // Trigger glow css animation when values update.
    const highlightCssClass = 'tsi-label-highlight';
    
    this.component.selectAll('.tsi-process-graphic-label')
      .data(graphicValues)
      .classed(highlightCssClass, true)
      .classed('clickable', (tsqe) => tsqe.onClick !== null)
      .on('animationend', function() {
        d3.select(this).classed(highlightCssClass, false);
      })
      .on('click', (event, tsqe) => {
        if(typeof(tsqe.onClick) === 'function') {
          tsqe.onClick({
            timeStamp: this.playbackControls.currentTimeStamp,
            value: tsqe.value,
            color: tsqe.color
          });
        }
      });

    this.component.selectAll('.title')
      .data(graphicValues)
      .text(tsqe => tsqe.alias || '');

    this.component.selectAll('.value')
      .data(graphicValues)
      .text(tsqe => tsqe.value !== null ? Utils.formatYAxisNumber(tsqe.value) : '--')
      .style('color', tsqe => tsqe.color);
  }

  protected parseTsqResponse(response) {
    return (response && response.properties && response.properties[0] && response.properties[0].values) 
      ? response.properties[0].values[0] 
      : null;
  }

  protected sanitizeAttribute(str) {
    let sanitized = String(str);
    let illegalChars = ['"', "'", '?', '<', '>', ';'];
    illegalChars.forEach(c => { sanitized = sanitized.split(c).join('') });

    return sanitized;
  }
}

interface IProcessGraphicLabelInfo {
  value: number,
  alias: string,
  x: number,
  y: number,
  color: string,
  onClick: Function
}

export default ProcessGraphic
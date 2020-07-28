import * as d3 from 'd3';
import './ProcessGraphic.scss';
import { HistoryPlayback, GraphicInfo } from "./../../Components/HistoryPlayback/HistoryPlayback";
import { ServerClient } from '../../../ServerClient/ServerClient';
import { Utils } from '../../Utils';
import { TsqExpression } from '../../Models/TsqExpression';

class ProcessGraphic extends HistoryPlayback {
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
    this.renderBase(environmentFqdn, getToken, graphicSrc, data, chartOptions);
  }

  protected loadGraphic(graphicSrc: string): Promise<GraphicInfo> {
    return new Promise(function(resolve, reject) {
      let image = new Image();

      image.onload = () => {
        resolve({
          graphic: image, 
          width: image.width, 
          height: image.height
        });
      }

      image.onerror = (errorMessage) => {
        reject(errorMessage);
      }

      image.src = graphicSrc;
    });
  }

  protected onGraphicLoaded(): void {
    this.component.append(() => this.graphic);
  }

  protected getDataPoints(promise: Array<IProcessGraphicLabelInfo>){
    let dataPoints = promise.map((r, i): IProcessGraphicLabelInfo => {
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
  protected updateDataMarkers(graphicValues: Array<IProcessGraphicLabelInfo>) {
    let textElements = this.component.selectAll('div')
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
      .on('click', (tsqe) => {
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

export { ProcessGraphic };
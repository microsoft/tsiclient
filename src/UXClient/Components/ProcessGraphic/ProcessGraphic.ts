import * as d3 from 'd3';
import './ProcessGraphic.scss';
import { Component } from "./../../Interfaces/Component";
import { PlaybackControls } from '../PlaybackControls/PlaybackControls';
import { ServerClient } from '../../../ServerClient/ServerClient';
import { Utils } from '../../Utils';
import { TsqRange } from '../../Models/TsqRange';
import { TsqExpression } from '../../Models/TsqExpression';

type d3Selection = d3.Selection<d3.BaseType, unknown, null, undefined>;

class ProcessGraphic extends Component {
  private targetElement: d3Selection;
  private tsqExpressions: Array<TsqExpression>;
  private processGraphicContainer: d3Selection;
  private processGraphic: d3Selection;
  private playbackControlsContainer: d3Selection;
  private playbackControls: PlaybackControls;
  private serverClient: ServerClient;
  private currentCancelTrigger: Function;
  private image: HTMLImageElement;
  private imageOriginalWidth: number;
  private imageOriginalHeight: number;
  private availabilityInterval: number;
  private environmentFqdn: string;
  private availability: TsqRange;
  private getAuthToken: () => Promise<string>;
  private playbackRate: number;

  readonly numberOfBuckets = 1000;
  readonly defaultPlaybackRate = 3000; // 3 seconds
  readonly fetchAvailabilityFrequency = 30000; // 30 seconds
  readonly playbackSliderHeight = 88;
  readonly previewApiFlag = '?api-version=2018-11-01-preview';

  constructor(renderTarget: Element){ 
    super(renderTarget); 
    this.serverClient = new ServerClient();
    this.currentCancelTrigger = null;
  }

  render(environmentFqdn: string, 
    getToken: () => Promise<string>, 
    imageSrc: string, 
    data: Array<TsqExpression>, 
    chartOptions) {
    this.environmentFqdn = environmentFqdn;
    this.getAuthToken = getToken;
    this.tsqExpressions = data;
    this.chartOptions.setOptions(chartOptions);
    this.playbackRate = this.chartOptions.updateInterval || this.defaultPlaybackRate;

    this.getAuthToken().then((authToken: string) => {
      this.serverClient.getAvailability(authToken, this.environmentFqdn, this.previewApiFlag)
        .then(availabilityResponse => {

          if (!this.availabilityInterval) {
            this.availabilityInterval = window.setInterval(this.pollAvailability.bind(this), this.fetchAvailabilityFrequency);
          }

          let { from, to } = this.parseAvailabilityResponse(availabilityResponse);
          this.updateAvailability(from, to);

          this.targetElement = d3.select(this.renderTarget);
          this.targetElement.html('');
          this.targetElement.classed('tsi-process-graphic-target', true);
          super.themify(this.targetElement, this.chartOptions.theme);

          this.loadImage(imageSrc).then((image: HTMLImageElement) => {
            this.image = image;
            this.imageOriginalWidth = this.image.width;
            this.imageOriginalHeight = this.image.height;
  
            this.processGraphicContainer = this.targetElement
              .append('div')
              .classed('tsi-process-graphic-container', true);

            this.processGraphic = this.processGraphicContainer
              .append('div')
              .classed('tsi-process-graphic', true);

            this.processGraphic.append(() => this.image);

            this.playbackControlsContainer = this.targetElement
              .append('div')
              .classed('tsi-playback-controls-container', true);

            let initialTimeStamp = this.chartOptions.initialValue instanceof Date ? this.chartOptions.initialValue : null;
            this.playbackControls = new PlaybackControls(<any>this.playbackControlsContainer.node(), initialTimeStamp);
          
            this.draw();

            window.addEventListener('resize', () => {
              this.draw();
            });
          });
        })
        .catch(reason => {
          console.error(`Failed while fetching data availability: ${reason}`);
        });
    })
    .catch(reason => {
      console.error(`Failed to acquire authentication token: ${reason}`);
    });
  }

  pauseAvailabilityUpdates() {
    if(this.availabilityInterval) {
      window.clearInterval(this.availabilityInterval);
    }
  }

  private async pollAvailability(): Promise<boolean> {
    return this.getAuthToken().then((authToken: string) => {
      return this.serverClient.getAvailability(authToken, this.environmentFqdn, this.previewApiFlag)
        .then(availabilityResponse => {
          let { from, to } = this.parseAvailabilityResponse(availabilityResponse);

          if (from.valueOf() !== this.availability.fromMillis || 
            to.valueOf() !== this.availability.toMillis) {
            this.updateAvailability(from, to);

            this.playbackControls.render(
              this.availability.from,
              this.availability.to,
              this.onSelecTimestamp.bind(this),
              this.chartOptions, 
              { intervalMillis: this.playbackRate, stepSizeMillis: this.availability.bucketSizeMillis });
            
            return true;
          }

          return false;
        })
        .catch(reason => {
          console.log(`Failed to update data availability: ${reason}`);
        });
    });
  }

  private onSelecTimestamp(timeStamp: Date) {
    let queryWindow = this.calcQueryWindow(timeStamp);

    let tsqArray = this.tsqExpressions.map(tsqExpression => {
      tsqExpression.searchSpan = { 
        from: queryWindow.fromMillis, 
        to: queryWindow.toMillis, 
        bucketSize: queryWindow.bucketSize };
      return tsqExpression.toTsq();
    });

    this.getAuthToken().then((authToken: string) => {
      let [promise, cancelTrigger] = this.serverClient.getCancellableTsqResults(authToken, this.environmentFqdn, tsqArray);

      // We keep track of the last AJAX call we made to the server, and cancel it if it hasn't finished yet. This is
      // a cheap way to avoid a scenario where we get out-of-order responses back from the server during 'play' mode.
      // We can revisit this at a later time if we need to handle it in a more sophisticated way.
      if (this.currentCancelTrigger) {
        this.currentCancelTrigger();
      }

      this.currentCancelTrigger = <Function>cancelTrigger;

      (promise as Promise<any>).then(results => {
        let processGraphicData = results.map((r, i): IProcessGraphicLabelInfo => {
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

        this.updateTextLabels(processGraphicData);
      }); 
    });
  }

  private calcQueryWindow(timeStamp: Date) {
    let timelineOffset = this.availability.fromMillis;
    let queryToMillis: number = Math.ceil((timeStamp.valueOf() - timelineOffset) / this.availability.bucketSizeMillis) * this.availability.bucketSizeMillis + timelineOffset;

    return {
      fromMillis: queryToMillis - this.availability.bucketSizeMillis,
      toMillis: queryToMillis,
      bucketSize: this.availability.bucketSizeStr
    }
  }

  private draw() {
    let graphicContainerWidth = this.renderTarget.clientWidth;
    let graphicContainerHeight = this.renderTarget.clientHeight - this.playbackSliderHeight;

    this.processGraphicContainer
      .style('width', `${graphicContainerWidth}px`)
      .style('height', `${graphicContainerHeight}px`);

    let resizedImageDim = this.getResizedImageDimensions(
      graphicContainerWidth,
      graphicContainerHeight,
      this.imageOriginalWidth,
      this.imageOriginalHeight);

    this.processGraphic
      .style('width', `${resizedImageDim.width}px`)
      .style('height', `${resizedImageDim.height}px`);

    this.playbackControlsContainer
      .style('width', `${this.renderTarget.clientWidth}px`)
      .style('height', `${this.playbackSliderHeight}px`);

    this.playbackControls.render(
      this.availability.from,
      this.availability.to,
      this.onSelecTimestamp.bind(this),
      this.chartOptions, 
      { intervalMillis: this.playbackRate, stepSizeMillis: this.availability.bucketSizeMillis });
  }

  private loadImage(imageSrc: string): Promise<HTMLImageElement> {
    return new Promise(function(resolve, reject) {
      let image = new Image();

      image.onload = () => {
        resolve(image);
      }

      image.onerror = (errorMessage) => {
        reject(errorMessage);
      }

      image.src = imageSrc;
    });
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

  private updateAvailability(from: Date, to: Date) {
    this.availability = new TsqRange(from, to);

    if(this.chartOptions.bucketSizeMillis && this.chartOptions.bucketSizeMillis > 0) {
      this.availability.setNeatBucketSizeByRoughBucketSize(this.chartOptions.bucketSizeMillis);
    } else {
      this.availability.setNeatBucketSizeByNumerOfBuckets(this.numberOfBuckets);
    }

    this.availability.alignWithServerEpoch();
  }

  private updateTextLabels(graphicValues: Array<IProcessGraphicLabelInfo>) {
    let textElements = this.processGraphic.selectAll('div')
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
    
    this.processGraphic.selectAll('.tsi-process-graphic-label')
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

    this.processGraphic.selectAll('.title')
      .data(graphicValues)
      .text(tsqe => tsqe.alias || '');

    this.processGraphic.selectAll('.value')
      .data(graphicValues)
      .text(tsqe => tsqe.value !== null ? Utils.formatYAxisNumber(tsqe.value) : '--')
      .style('color', tsqe => tsqe.color);
  }

  private parseAvailabilityResponse(response) {
    let range = response && response.availability && response.availability.range;
    let from = (range && range.from && new Date(range.from)) || null;
    let to = (range && range.to && new Date(range.to)) || null;

    if (from === null || to === null) {
      throw 'Query to get availability returned a response with an unexpected structure';
    }

    return { from, to };
  }

  private parseTsqResponse(response) {
    return (response && response.properties && response.properties[0] && response.properties[0].values) 
      ? response.properties[0].values[0] 
      : null;
  }

  private sanitizeAttribute(str) {
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
import { TsqExpression } from './TsqExpression';

class ProcessGraphicTsqExpression extends TsqExpression {
  public positionX: number;
  public positionY: number;

  constructor(instanceObject: any, 
    variableObject: any, 
    searchSpan: any, 
    colorOrOptionsObject: any, 
    alias: string, 
    contextMenu: Array<any>,
    positionX: number,
    positionY: number) {
      super(instanceObject, variableObject, searchSpan, colorOrOptionsObject, alias, contextMenu);
      this.positionX = positionX;
      this.positionY = positionY;
  }
}

export { ProcessGraphicTsqExpression };
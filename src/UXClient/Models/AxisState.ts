class AxisState{
    public axisType;
    public yExtent: [number, number];
    public positionInGroup: number;

    constructor (axisType, yExtent: [number, number], positionInGroup: number) {
        this.axisType = axisType;
        this.yExtent = yExtent;
        this.positionInGroup = positionInGroup 
    }
}

export { AxisState };
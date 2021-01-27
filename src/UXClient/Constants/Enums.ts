export enum KeyCodes {
    Tab = 9,
    Esc = 27,
    Enter = 13,
    Up = 38,
    Down = 40
}

// search api params
export enum InstancesSort {DisplayName = "DisplayName", Rank = "Rank"};
export enum HierarchiesExpand {UntilChildren = "UntilChildren", OneLevel = "OneLevel"};
export enum HierarchiesSort {Name = "Name", CumulativeInstanceCount = "CumulativeInstanceCount"};
export enum MetadataPropertyTypes {Double = "Double", String = "String", DateTime = "DateTime", Long = "Long"}
export enum ShiftTypes {startAt = "Start at", shifted = "shifted"}

export enum InterpolationFunctions {
    None = '',
    CurveLinear = "curveLinear",
    CurveStep = "curveStep",
    CurveStepBefore = "curveStepBefore",
    CurveStepAfter = "curveStepAfter",
    CurveBasis = "curveBasis",
    CurveCardinal = "curveCardinal",
    CurveMonotoneX = "curveMonotoneX",
    CurveCatmullRom = "curveCatmullRom"
}

export enum ErrorCodes {
    InvalidInput = 'InvalidInput',
    PartialSuccess = 'PartialSuccess'
}

// Linechart stack states
export enum YAxisStates { Stacked = "stacked", Shared = "shared", Overlap = "overlap" };
export enum DataTypes { Numeric = 'numeric', Categorical = 'categorical', Events = 'events' };
export enum EventElementTypes { Diamond = 'diamond', Teardrop = 'teardrop' };
export enum TooltipMeasureFormat { Enveloped = 'Enveloped', SingleValue = 'SingleValue', Scatter = 'Scatter' };
export enum valueTypes { String = 'String', Double = 'Double', Long = 'Long', Dynamic = 'Dynamic', Boolean = 'Boolean', DateTime = 'DateTime' };

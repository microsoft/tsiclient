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

export enum ErrorCodes {
    InvalidInput = 'InvalidInput',
    PartialSuccess = 'PartialSuccess'
}
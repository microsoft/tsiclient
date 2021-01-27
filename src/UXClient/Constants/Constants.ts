import { InstancesSort, HierarchiesExpand, HierarchiesSort } from "./Enums";

export const DefaultHierarchyNavigationOptions = {
    instancesPageSize: 10,
    hierarchiesPageSize: 10,
    isInstancesRecursive: false,
    isInstancesHighlighted: false,
    instancesSort: InstancesSort.DisplayName,
    hierarchiesExpand: HierarchiesExpand.OneLevel,
    hierarchiesSort: HierarchiesSort.Name
};

export const DefaultHierarchyContextMenuOptions = {
    isSelectionEnabled: false,
    isFilterEnabled: false
}

export const nullTsidDisplayString = "null";

export const swimlaneLabelConstants = {
    leftMarginOffset: 40,
    swimLaneLabelHeightPadding: 8,
    labelLeftPadding: 28
}

export const CharactersToEscapeForExactSearchInstance = ['"', '`', '\'', '!', '(', ')', '^', '[', '{', ':', ']', '}', '~', '/', '\\', '@', '#', '$', '%', '&', '*', ';', '=', '.', '_', '-', '<', '>', ',', '?'];

export const NONNUMERICTOPMARGIN = 8;
export const LINECHARTTOPPADDING = 16;
export const GRIDCONTAINERCLASS = 'tsi-gridContainer';
export const LINECHARTCHARTMARGINS = {
    top: 40,
    bottom: 40,
    left: 70,
    right: 60
};
export const LINECHARTXOFFSET = 8;
export const MARKERVALUENUMERICHEIGHT = 20;
export const VALUEBARHEIGHT = 3;
export const SERIESLABELWIDTH = 92;

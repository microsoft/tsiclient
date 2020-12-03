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

export const CharactersToEscapeForExactSearchInstance = ['"', '`', '\'', '!', '(', ')', '^', '[', '{', ':', ']', '}', '~', '/', '\\', '@', '#', '$', '%', '&', '*', ';', '=', '.', '_', '-', '<', '>', ',', '?'];

import Utils from "../Utils";

class HierarchyNode {
    public name: string;
    public markedName: string;
    public children: Array<HierarchyNode> = [];
    public parent: HierarchyNode;
    public isExpanded: boolean = false;
    public isSelected: boolean = false;
    public isLeaf: boolean = false;
    public childrenInFilter: boolean = false;
    public selfInFilter: boolean = false;
    public color: (n: HierarchyNode) => string = () => null;
    public click = (n) => {};
    public isLeafParent: boolean = false; // used in the event of context menut to denote that we should use a context menu for children
    public level: number;
    
	constructor(name: string, level: number){
        this.name = name;
        this.level = level;
        this.markedName = name;
    }
    
    public filter(filterText){
        var regExp = new RegExp(filterText, 'i');
        var isInFilter = (node) => {
            var childrenInFilter = node.children.reduce((p,c) => {
                p = isInFilter(c) || p;
                return p;
            }, false);
            var selfInFilter = regExp.test(node.name);
            node.markedName = selfInFilter ? Utils.mark(filterText, node.name) : node.name;
            if(node.parent != null)
                node.parent.childrenInFilter = (selfInFilter || childrenInFilter) && filterText.length > 0;
            node.selfInFilter = selfInFilter && filterText.length > 0;
            node.childrenInFilter = childrenInFilter && filterText.length > 0;
            return childrenInFilter || selfInFilter;
        }
        isInFilter(this);
    }

    public traverse(condition: (n: HierarchyNode) => boolean){
        var traversal = [];
        if(condition(this))
            traversal.push(this);
        this.children.forEach(n => {
            traversal = traversal.concat(n.traverse(condition));
        })
        return traversal;
    }

    public colorify(el){
        if(this.isLeaf && this.isSelected && this.color(this))
            el.style('background-color', this.color(this));
        if(!this.isSelected && this.isLeaf)
            el.style('background-color', null);
    }

}
export {HierarchyNode}

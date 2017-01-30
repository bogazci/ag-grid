
import {Component} from "../widgets/component";
import {PostConstruct, Autowired, Context} from "../context/context";
import {GridOptionsWrapper} from "../gridOptionsWrapper";
import {ColumnGroupChild} from "../entities/columnGroupChild";
import {ColumnGroup} from "../entities/columnGroup";
import {ColumnController} from "../columnController/columnController";
import {IRenderedHeaderElement} from "./iRenderedHeaderElement";
import {Column} from "../entities/column";
import {DropTarget} from "../dragAndDrop/dragAndDropService";
import {RenderedHeaderGroupCell} from "./deprecated/renderedHeaderGroupCell";
import {RenderedHeaderCell} from "./deprecated/renderedHeaderCell";
import {EventService} from "../eventService";
import {Events} from "../events";
import {Utils as _} from "../utils";
import {HeaderWrapperComp} from "./headerWrapperComp";
import {ColDef} from "../entities/colDef";
import {HeaderGroupComp} from "./headerGroupComp";
import {HeaderGroupWrapperComp} from "./headerGroupWrapperComp";

export class HeaderRowComp extends Component {

    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired('columnController') private columnController: ColumnController;
    @Autowired('context') private context: Context;
    @Autowired('eventService') private eventService: EventService;

    private dept: number;
    private pinned: string;

    private headerElements: {[key: string]: IRenderedHeaderElement} = {};

    private eRoot: HTMLElement;
    private dropTarget: DropTarget;
    
    // if bottom row, this is false, otherwise true
    private showingGroups: boolean;

    constructor(dept: number, showingGroups: boolean, pinned: string, eRoot: HTMLElement, dropTarget: DropTarget) {
        super(`<div class="ag-header-row"/>`);
        this.dept = dept;
        this.showingGroups = showingGroups;
        this.pinned = pinned;
        this.eRoot = eRoot;
        this.dropTarget = dropTarget;
    }

    public forEachHeaderElement(callback: (renderedHeaderElement: IRenderedHeaderElement)=>void): void {
        Object.keys(this.headerElements).forEach( key => {
            var headerElement = this.headerElements[key];
            callback(headerElement);
        });
    }

    public destroy(): void {
        var idsOfAllChildren = Object.keys(this.headerElements);
        this.removeAndDestroyChildComponents(idsOfAllChildren);
        super.destroy();
    }

    private removeAndDestroyChildComponents(idsToDestroy: string[]): void {
        idsToDestroy.forEach( id => {
            var child = this.headerElements[id];
            this.getGui().removeChild(child.getGui());
            child.destroy();
            delete this.headerElements[id];
        });
    }

    private onRowHeightChanged(): void {
        var rowHeight = this.gridOptionsWrapper.getHeaderHeight();
        this.getGui().style.top = (this.dept * rowHeight) + 'px';
        this.getGui().style.height = rowHeight + 'px';
    }

    @PostConstruct
    private init(): void {

        this.onRowHeightChanged();
        this.onVirtualColumnsChanged();
        this.setWidth();

        this.addDestroyableEventListener(this.gridOptionsWrapper, GridOptionsWrapper.PROP_HEADER_HEIGHT, this.onRowHeightChanged.bind(this) );
        this.addDestroyableEventListener(this.eventService, Events.EVENT_VIRTUAL_COLUMNS_CHANGED, this.onVirtualColumnsChanged.bind(this) );
        this.addDestroyableEventListener(this.eventService, Events.EVENT_DISPLAYED_COLUMNS_CHANGED, this.onDisplayedColumnsChanged.bind(this) );
        this.addDestroyableEventListener(this.eventService, Events.EVENT_COLUMN_RESIZED, this.onColumnResized.bind(this) );
    }

    private onColumnResized(): void {
        this.setWidth();
    }

    private setWidth(): void {
        var mainRowWidth = this.columnController.getContainerWidth(this.pinned) + 'px';
        this.getGui().style.width = mainRowWidth;
    }

    private onDisplayedColumnsChanged(): void {
        // because column groups are created and destroyed on the fly as groups are opened / closed and columns are moved,
        // we have to throw away all of the components when columns are changed, as the references to the old groups
        // are no longer value. this is not true for columns where columns do not get destroyed between open / close
        // or moving actions.
        if (this.showingGroups) {
            var idsOfAllChildren = Object.keys(this.headerElements);
            this.removeAndDestroyChildComponents(idsOfAllChildren);
        }
        this.onVirtualColumnsChanged();
        this.setWidth();
    }
    
    private onVirtualColumnsChanged(): void {

        var currentChildIds = Object.keys(this.headerElements);

        var nodesAtDept = this.columnController.getVirtualHeaderGroupRow(this.pinned, this.dept);

        nodesAtDept.forEach( (child: ColumnGroupChild) => {
            var idOfChild = child.getUniqueId();

            // if we already have this cell rendered, do nothing
            if (currentChildIds.indexOf(idOfChild) >= 0) {
                _.removeFromArray(currentChildIds, idOfChild);
                return;
            }

            // skip groups that have no displayed children. this can happen when the group is broken,
            // and this section happens to have nothing to display for the open / closed state.
            // (PS niall note - i can't remember what i meant by the above exactly, what's a broken group???)
            if (child instanceof ColumnGroup && (<ColumnGroup>child).getDisplayedChildren().length === 0) {
                return;
            }

            var renderedHeaderElement = this.createHeaderElement(child);
            this.headerElements[idOfChild] = renderedHeaderElement;
            this.getGui().appendChild(renderedHeaderElement.getGui());
        });

        // at this point, anything left in currentChildIds is an element that is no longer in the viewport
        this.removeAndDestroyChildComponents(currentChildIds);
    }

    // check if user is using the deprecated
    private isUsingOldHeaderRenderer(column: Column): boolean {
        let colDef = column.getColDef();

        return _.anyExists([
            // header template
            this.gridOptionsWrapper.getHeaderCellTemplateFunc(),
            this.gridOptionsWrapper.getHeaderCellTemplate(),
            colDef.headerCellTemplate,
            // header cellRenderer
            colDef.headerCellRenderer,
            this.gridOptionsWrapper.getHeaderCellRenderer()
        ]);

    }

    private createHeaderElement(columnGroupChild:ColumnGroupChild):IRenderedHeaderElement {
        var result:IRenderedHeaderElement;

        if (columnGroupChild instanceof ColumnGroup) {
            // result = new RenderedHeaderGroupCell(<ColumnGroup> columnGroupChild, this.eRoot, this.dropTarget, this.pinned);
            result = new HeaderGroupWrapperComp(<ColumnGroup> columnGroupChild, this.eRoot, this.dropTarget, this.pinned);
        } else {
            if (this.isUsingOldHeaderRenderer(<Column> columnGroupChild)) {
                ////// DEPRECATED - TAKE THIS OUT IN V9
                result = new RenderedHeaderCell(<Column> columnGroupChild, this.eRoot, this.dropTarget, this.pinned);
            } else {
                // the future!!!
                result = new HeaderWrapperComp(<Column> columnGroupChild, this.eRoot, this.dropTarget, this.pinned);
            }
        }

        this.context.wireBean(result);
        return result;
    }

}
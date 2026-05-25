sap.ui.define([
    "sap/ui/core/Control",
    "sap/ui/table/TreeTable",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/Dialog",
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/CheckBox",
    "sap/m/Input",
    "sap/m/Select",
    "sap/m/Switch",
    "sap/ui/core/Item",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Control, TreeTable, Column, Text, Button, Toolbar, 
    Dialog, IconTabBar, IconTabFilter, List, CustomListItem, HBox, VBox, CheckBox, 
    Input, Select, Switch, Item, JSONModel, Sorter, Filter, FilterOperator) {
    "use strict";

    return Control.extend("com.grid.alvdemo.control.Table", {

        metadata: {
            properties: {
                title: { type: "string", defaultValue: "Grid Settings" },
                hierarchyPath: { type: "string", defaultValue: "/catalog" },
                childArrayName: { type: "string", defaultValue: "categories" }
            },
            aggregations: {
                _table: {
                    type: "sap.ui.table.TreeTable",
                    multiple: false,
                    visibility: "hidden"
                }
            }
        },

        init: function () {
            this._meta = {};
            this._viewModel = new JSONModel({
                selectedColumnKey: null,
                selectedColumn: null
            });
            this.setModel(this._viewModel, "view");

            this._stateModel = new JSONModel({
                columns: [],
                sort: [],
                filter: [],
                group: []
            });

            this._table = new TreeTable({
                selectionMode: "MultiToggle",
                enableSelectAll: true,
                showColumnVisibilityMenu: true,
                rowActionCount: 0,
                extension: [
                    new Toolbar({
                        content: [
                            new Text({ text: "Hierarchical ALV Engine" }),
                            new sap.m.ToolbarSpacer(),
                            new Button({
                                icon: "sap-icon://action-settings",
                                tooltip: "Open Grid Configuration Dialog",
                                press: () => this._openDialog()
                            })
                        ]
                    })
                ],
                rowsUpdated: this.onRowsUpdated.bind(this)
            });

            this.setAggregation("_table", this._table);
        },

        setColumnMeta: function (oMetaConfig) {
            if (!oMetaConfig) return;
            this._meta = oMetaConfig;
            this._initDefaultState();
            if (this._table && this._table.getBinding("rows")) {
                this._applyState();
            }
        },

        _initDefaultState: function () {
            if (!this._meta || Object.keys(this._meta).length === 0) return;
            
            const cols = Object.keys(this._meta)
                .filter(key => key !== this.getChildArrayName())
                .map((key, index) => ({
                    key: key,
                    label: this._meta[key].label || key,
                    visible: true,
                    order: index,
                    width: this._meta[key].width || "200px"
                }));
            
            this._stateModel.setProperty("/columns", cols);
        },

        onAfterRendering: function () {
            if (this._table && !this._table.getBinding("rows")) {
                this._initTable();
            }
        },

        _initTable: function () {
            const oModel = this.getModel();
            if (!oModel) return;

            const sHierarchyPath = this.getHierarchyPath();
            const sChildArray = this.getChildArrayName();
            const data = oModel.getProperty(sHierarchyPath);

            if (data && data.length > 0) {
                if (Object.keys(this._meta).length === 0) {
                    this._extractMetadata(data[0]);
                    this._initDefaultState();
                }
                this._oOriginalDataBackup = null;
                this._applyState();
            }
        },

        _extractMetadata: function (sample) {
            if (!sample || Object.keys(this._meta).length > 0) return;
            Object.keys(sample).forEach(key => {
                if (key === this.getChildArrayName() || key === "__metadata") return;
                let label = key.charAt(0).toUpperCase() + key.slice(1);
                let type = typeof sample[key] === 'number' ? "amount" : "string";
                this._meta[key] = { label: label, type: type };
            });
        },

        _applyState: function () {
            const table = this._table;
            const state = this._stateModel.getData();
            const aSorts = state.sort || [];
            const aFilters = state.filter || [];

            table.removeAllColumns();
            const sSelectedColumnKey = this._viewModel.getProperty("/selectedColumnKey");

            state.columns
                .filter(c => c.visible)
                .sort((a, b) => a.order - b.order)
                .forEach(c => {
                    const oSortInfo = aSorts.find(s => s.key === c.key);
                    const meta = this._meta[c.key] || { label: c.key, type: "string" };
                    const bHasActiveFilter = aFilters.some(f => f.key === c.key && (f.value1 !== "" || (f.values && f.values.length > 0)));

                    const oHeaderLabelControl = this._createALVHeaderLabel(meta.label, c.key);

                    const oUI5ColumnInstance = new Column({
                        label: oHeaderLabelControl,
                        sortProperty: c.key,
                        filterProperty: c.key,
                        width: c.width,
                        sorted: !!oSortInfo,
                        sortOrder: oSortInfo ? (oSortInfo.descending ? "Descending" : "Ascending") : "None",
                        template: new Text({
                            text: {
                                path: c.key,
                                formatter: (v) => {
                                    if (meta.type === 'amount' && typeof v === 'number') {
                                        return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    }
                                    return v;
                                }
                            }
                        })
                    });

                    table.addColumn(oUI5ColumnInstance);

                    if (c.key === sSelectedColumnKey) {
                        oUI5ColumnInstance.addStyleClass("alvHighlightHeader");
                        table.addStyleClass("alvSelectedColumn");
                    }

                    if (bHasActiveFilter) {
                        this._updateHeaderFilterIconState(oUI5ColumnInstance, true);
                    }
                });

            const sHierarchyPath = this.getHierarchyPath();
            const sChildArray = this.getChildArrayName();
            const oModel = this.getModel();
            if (!oModel) return;

            if (!this._oOriginalDataBackup) {
                this._oOriginalDataBackup = JSON.parse(JSON.stringify(oModel.getProperty(sHierarchyPath) || []));
            }

            let aWorkingData = JSON.parse(JSON.stringify(this._oOriginalDataBackup));

            if (aFilters.length > 0) {
                const nodeMatchesFilters = (oNode) => {
                    return aFilters.every(f => {
                        const vVal = oNode[f.key];
                        if (vVal === undefined || vVal === null) return false;

                        const sNodeVal = vVal.toString().toLowerCase();
                        const nNodeVal = Number(vVal);
                        const bIsNumeric = !isNaN(nNodeVal) && vVal !== "";

                        switch (f.operator) {
                            case "Contains":
                                if (!f.value1) return true;
                                return sNodeVal.includes(f.value1.toLowerCase());

                            case "EQ":
                                if (f.values && f.values.length > 0) {
                                    return f.values.some(tokenVal => tokenVal.toString().toLowerCase() === sNodeVal);
                                }
                                if (f.value1 !== undefined && f.value1 !== null) {
                                    return sNodeVal === f.value1.toString().toLowerCase();
                                }
                                return true;

                            case "BT":
                                if (f.value1 === undefined || f.value2 === undefined) return true;
                                if (bIsNumeric && !isNaN(Number(f.value1)) && !isNaN(Number(f.value2))) {
                                    return nNodeVal >= Number(f.value1) && nNodeVal <= Number(f.value2);
                                }
                                return sNodeVal >= f.value1.toString().toLowerCase() && sNodeVal <= f.value2.toString().toLowerCase();

                            case "GT":
                                if (f.value1 === undefined || f.value1 === "") return true;
                                if (bIsNumeric && !isNaN(Number(f.value1))) {
                                    return nNodeVal > Number(f.value1);
                                }
                                return sNodeVal > f.value1.toString().toLowerCase();

                            case "LT":
                                if (f.value1 === undefined || f.value1 === "") return true;
                                if (bIsNumeric && !isNaN(Number(f.value1))) {
                                    return nNodeVal < Number(f.value1);
                                }
                                return sNodeVal < f.value1.toString().toLowerCase();

                            default:
                                return true;
                        }
                    });
                };

                const filterTreeNodes = (aNodes) => {
                    if (!aNodes || !Array.isArray(aNodes)) return [];

                    return aNodes.filter(oNode => {
                        const bSelfMatches = nodeMatchesFilters(oNode);
                        
                        if (oNode[sChildArray] && Array.isArray(oNode[sChildArray])) {
                            const aFilteredChildren = filterTreeNodes(oNode[sChildArray]);
                            if (bSelfMatches) {
                                return true; 
                            } else if (aFilteredChildren.length > 0) {
                                oNode[sChildArray] = aFilteredChildren;
                                return true;
                            }
                            return false;
                        }
                        return bSelfMatches;
                    });
                };

                aWorkingData = filterTreeNodes(aWorkingData);
            }

            if (aSorts.length > 0) {
                const sortTreeNodes = (aNodes) => {
                    if (!aNodes || !Array.isArray(aNodes)) return;
                    
                    aNodes.sort((a, b) => {
                        for (let i = 0; i < aSorts.length; i++) {
                            const sortConf = aSorts[i];
                            const valA = a[sortConf.key];
                            const valB = b[sortConf.key];
                            if (valA === valB) continue;
                            const bDesc = sortConf.descending;
                            if (typeof valA === "number" && typeof valB === "number") {
                                return bDesc ? valB - valA : valA - valB;
                            }
                            const strA = (valA || "").toString();
                            const strB = (valB || "").toString();
                            return bDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
                        }
                        return 0;
                    });

                    aNodes.forEach(oNode => {
                        if (oNode[sChildArray] && Array.isArray(oNode[sChildArray])) {
                            sortTreeNodes(oNode[sChildArray]);
                        }
                    });
                };
                sortTreeNodes(aWorkingData);
            }

            oModel.setProperty(sHierarchyPath + "_filtered", aWorkingData);

            table.bindRows({
                path: sHierarchyPath + "_filtered",
                parameters: { arrayNames: [sChildArray] }
            });

            if (aFilters.length > 0) {
                table.expandToLevel(10); 
            } else {
                table.collapseAll();
            }
        },

        _createALVHeaderLabel: function (sLabelText, sColumnKey) {
            const oText = new Text({ text: sLabelText, wrapping: false }).addStyleClass("alvHeaderLabelText");
            const oFilterIcon = new sap.ui.core.Icon({
                src: "sap-icon://filter",
                size: "0.85rem",
                color: "#1d2d3d",
                visible: false,
                tooltip: "Active Filter Criterion Applied"
            }).addStyleClass("alvHeaderFilterIcon sapUiTinyMarginBegin");

            const oHeaderBox = new HBox({
                alignItems: "Center",
                justifyType: "Start",
                renderType: "Bare",
                items: [oText, oFilterIcon]
            });

            oHeaderBox.data("columnKey", sColumnKey);
            oHeaderBox.data("filterIcon", oFilterIcon);
            return oHeaderBox;
        },

        _updateHeaderFilterIconState: function (oColumn, bIsActive) {
            const oLabelControl = oColumn.getLabel();
            if (oLabelControl && oLabelControl.getMetadata().getName() === "sap.m.HBox") {
                const oFilterIcon = oLabelControl.data("filterIcon");
                if (oFilterIcon) {
                    oFilterIcon.setVisible(bIsActive);
                    oFilterIcon.setColor(bIsActive ? "#0a6ed1" : "#1d2d3d");
                }
            }
        },

        _openDialog: function () {
            if (!this._dialog) {
                this._oTabBar = new IconTabBar({
                    items: [
                        this._columnsTab(),
                        this._sortTab(),
                        this._filterTab()
                    ]
                });

                this._dialog = new Dialog({
                    title: this.getTitle(),
                    contentWidth: "750px",
                    contentHeight: "550px",
                    draggable: true,
                    resizable: true,
                    content: [this._oTabBar],
                    buttons: [
                        new Button({
                            text: "Apply",
                            press: () => {
                                this._applyState();
                                this._viewModel.setProperty("/selectedColumnKey", null);
                                this._viewModel.setProperty("/selectedColumn", null);
                                this._dialog.close();
                            }
                        }),
                        new Button({
                            text: "Close",
                            press: () => this._dialog.close()
                        })
                    ]
                });
                this._dialog.setModel(this._stateModel, "state");
            }
            this._dialog.open();
        },

       _columnsTab: function () {
            // 1. Create the Column Search Field
            var oColumnSearchField = new sap.m.SearchField({
                width: "100%",
                placeholder: "Search columns...",
                liveChange: function (oEvent) {
                    var sQuery = oEvent.getParameter("newValue");
                    var oList = oEvent.getSource().getParent().getParent().getItems()[1];
                    var oListBinding = oList.getBinding("items");

                    if (oListBinding) {
                        if (sQuery && sQuery.trim().length > 0) {
                            var oSearchFilter = new sap.ui.model.Filter({
                                path: "label",
                                operator: sap.ui.model.FilterOperator.Contains,
                                value1: sQuery
                            });
                            oListBinding.filter([oSearchFilter]);
                        } else {
                            oListBinding.filter([]);
                        }
                    }
                }.bind(this)
            });

            // 2. Wrap the search field inside a Layout Toolbar Header
            var oColumnsHeaderToolbar = new sap.m.Toolbar({
                design: "Info",
                content: [
                    new sap.m.ToolbarSpacer(),
                    oColumnSearchField
                ]
            }).addStyleClass("sapUiTinyMarginBottom");

            // 3. Construct the list with action button controls wrapped in a clean CSS Class
            var oColumnDisplayList = new sap.m.List({
                mode: "SingleSelectMaster",
                items: {
                    path: "state>/columns",
                    template: new CustomListItem({
                        content: [
                            new sap.m.HBox({
                                alignItems: "Center",
                                justifyContent: "SpaceBetween",
                                width: "100%",
                                items: [
                                    new sap.m.CheckBox({ selected: "{state>visible}", text: "{state>label}" }),
                                    
                                    // Button Action Group (Hidden by default using the custom CSS class)
                                    new sap.m.HBox({
                                        items: [
                                            new sap.m.Button({ 
                                                icon: "sap-icon://collapse-group", 
                                                tooltip: "Move to First Position",
                                                type: "Transparent", 
                                                press: (e) => this._moveColumnItemToExtreme(e, "first") 
                                            }),
                                            new sap.m.Button({ 
                                                icon: "sap-icon://navigation-up-arrow", 
                                                tooltip: "Move Up",
                                                type: "Transparent", 
                                                press: (e) => this._moveColumnItem(e, "up") 
                                            }),
                                            new sap.m.Button({ 
                                                icon: "sap-icon://navigation-down-arrow", 
                                                tooltip: "Move Down",
                                                type: "Transparent", 
                                                press: (e) => this._moveColumnItem(e, "down") 
                                            }),
                                            new sap.m.Button({ 
                                                icon: "sap-icon://expand-group", 
                                                tooltip: "Move to Last Position",
                                                type: "Transparent", 
                                                press: (e) => this._moveColumnItemToExtreme(e, "last") 
                                            })
                                        ]
                                    }).addStyleClass("alvActionButtonsGroup")
                                ]
                            }).addStyleClass("sapUiTinyMargin")
                        ]
                    })
            }}).addStyleClass("alvColumnsDisplayList");

            // 4. Return the complete integrated tab layout structure
            return new IconTabFilter({
                key: "columnTab",
                text: "Columns Display",
                icon: "sap-icon://table-column",
                content: [
                    new sap.m.VBox({
                        width: "100%",
                        items: [
                            oColumnsHeaderToolbar,
                            oColumnDisplayList
                        ]
                    })
                ]
            });
        },

        // New Logic Function supporting Move to First / Move to Last operations
        _moveColumnItemToExtreme: function (oEvent, sDestination) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const oList = oItem.getParent();
            const iIndex = oList.indexOfItem(oItem);
            const aCols = this._stateModel.getProperty("/columns");

            if (iIndex === -1) return;

            // Splice item out of its current layout row index position
            const [moved] = aCols.splice(iIndex, 1);

            if (sDestination === "first") {
                aCols.unshift(moved); // Insert at the absolute beginning
            } else if (sDestination === "last") {
                aCols.push(moved);    // Append to the absolute end
            }

            // Recalculate rendering metadata sequencing orders
            aCols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },

        _moveColumnItem: function (oEvent, sDirection) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const oList = oItem.getParent();
            const iIndex = oList.indexOfItem(oItem);
            const aCols = this._stateModel.getProperty("/columns");

            if (iIndex === -1) return;
            let iNewIndex = sDirection === "up" ? iIndex - 1 : iIndex + 1;
            if (iNewIndex < 0 || iNewIndex >= aCols.length) return;

            const [moved] = aCols.splice(iIndex, 1);
            aCols.splice(iNewIndex, 0, moved);
            aCols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },

        // =========================================================================
        // SORT TAB: IMPLEMENTS INDEPENDENT ASCENDING / DESCENDING SELECTION BUTTONS
        // =========================================================================
       _sortTab: function () {
            var that = this;
            return new IconTabFilter({
                key: "sortTab",
                text: "Sorting Layers",
                icon: "sap-icon://sort",
                content: [
                    new Button({
                        text: "Add Sort Hierarchy Level",
                        icon: "sap-icon://add",
                        press: () => {
                            const aSorts = this._stateModel.getProperty("/sort") || [];
                            aSorts.push({ key: Object.keys(this._meta)[0], descending: false });
                            this._stateModel.setProperty("/sort", aSorts);
                        }
                    }).addStyleClass("sapUiSmallMarginBottom"),
                    new List({
                        items: {
                            path: "state>/sort",
                            template: new CustomListItem({
                                content: [
                                    new HBox({
                                        alignItems: "Center",
                                        width: "100%", // Ensures full width row tracking
                                        items: [
                                            // 1. Column Selection Dropdown
                                            new Select({
                                                selectedKey: "{state>key}",
                                                width: "220px",
                                                items: Object.keys(this._meta).map(k => new Item({ key: k, text: this._meta[k].label }))
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            
                                            // 2. Sorting Mode Toggle Button Group
                                            new HBox({
                                                items: [
                                                    new Button({
                                                        icon: "sap-icon://sort-ascending",
                                                        tooltip: "Sort Ascending",
                                                        type: {
                                                            path: "state>descending",
                                                            formatter: function (bDescending) {
                                                                return bDescending ? "Transparent" : "Emphasized";
                                                            }
                                                        },
                                                        press: function (oEvent) {
                                                            var oCtx = oEvent.getSource().getBindingContext("state");
                                                            if (oCtx) {
                                                                oCtx.getModel().setProperty(oCtx.getPath() + "/descending", false);
                                                            }
                                                        }
                                                    }),
                                                    new Button({
                                                        icon: "sap-icon://sort-descending",
                                                        tooltip: "Sort Descending",
                                                        type: {
                                                            path: "state>descending",
                                                            formatter: function (bDescending) {
                                                                return bDescending ? "Emphasized" : "Transparent";
                                                            }
                                                        },
                                                        press: function (oEvent) {
                                                            var oCtx = oEvent.getSource().getBindingContext("state");
                                                            if (oCtx) {
                                                                oCtx.getModel().setProperty(oCtx.getPath() + "/descending", true);
                                                            }
                                                        }
                                                    })
                                                ]
                                            }),

                                            // 3. Spacing Absorber: Pushes everything after it to the right end
                                            new sap.m.ToolbarSpacer(),
                                            
                                            // 4. Delete Action Row Button
                                            new Button({ 
                                                icon: "sap-icon://delete", 
                                                type: "Reject", 
                                                press: (e) => this._deleteSortRow(e) 
                                            })
                                        ]
                                    }).addStyleClass("sapUiTinyMargin")
                                ]
                            })
                        }
                    })
                ]
            });
        },

        _deleteSortRow: function (oEvent) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const iIndex = oItem.getParent().indexOfItem(oItem);
            const aSorts = this._stateModel.getProperty("/sort");
            aSorts.splice(iIndex, 1);
            this._stateModel.refresh(true);
        },

       _filterTab: function () {
            var that = this;
            return new IconTabFilter({
                key: "filterTab",
                text: "Filter Rules Engine",
                icon: "sap-icon://filter",
                content: [
                    new Button({
                        text: "Add Condition Row",
                        icon: "sap-icon://add",
                        press: () => {
                            const aFilters = this._stateModel.getProperty("/filter") || [];
                            aFilters.push({ 
                                key: Object.keys(this._meta)[0], 
                                operator: "Contains", 
                                value1: "", 
                                value2: "", // Added to store the upper bound range
                                values: [] 
                            });
                            this._stateModel.setProperty("/filter", aFilters);
                        }
                    }).addStyleClass("sapUiSmallMarginBottom"),
                    new List({
                        items: {
                            path: "state>/filter",
                            template: new CustomListItem({
                                content: [
                                    new HBox({
                                        alignItems: "Center",
                                        width: "100%",
                                        items: [
                                            // 1. Technical Field Select
                                            new Select({
                                                selectedKey: "{state>key}",
                                                items: Object.keys(that._meta).map(k => new Item({ key: k, text: that._meta[k].label })),
                                                change: function(oEvent) {
                                                    var oCtx = oEvent.getSource().getBindingContext("state");
                                                    if(oCtx) {
                                                        oCtx.getModel().setProperty(oCtx.getPath() + "/value1", "");
                                                        oCtx.getModel().setProperty(oCtx.getPath() + "/value2", "");
                                                        oCtx.getModel().setProperty(oCtx.getPath() + "/values", []);
                                                    }
                                                }
                                            }).addStyleClass("sapUiTinyMarginEnd"),

                                            // 2. Operator Select
                                            new Select({
                                                selectedKey: "{state>operator}",
                                                items: [                                                   
                                                    new Item({key: "EQ", text: "Equals"}),
                                                    new Item({key: "Contains", text: "Contains"}),
                                                    new Item({key: "BT", text: "Between"}),
                                                    new Item({key: "GT", text: "Greater Than"}),
                                                    new Item({key: "LT", text: "Less Than"})
                                                ],
                                                change: function(oEvent) {
                                                    // Force UI refresh when operator switches to cleanly toggle field visibilities
                                                    that._stateModel.refresh(true);
                                                }
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            
                                            // 3. Standard Field Layout Container (Visible when operator is NOT 'Between')
                                            new HBox({
                                                visible: {
                                                    path: "state>operator",
                                                    formatter: function(sOperator) {
                                                        return sOperator !== "BT";
                                                    }
                                                },
                                                items: [
                                                    new sap.m.MultiInput({
                                                        width: "280px",
                                                        showValueHelp: true,
                                                        value: "{state>value1}",
                                                        placeholder: "Type value or open Value Help...",
                                                        valueHelpRequest: function (oEvent) {
                                                            that._onFilterValueHelpRequest(oEvent, "standard");
                                                        },
                                                        tokens: {
                                                            path: "state>values",
                                                            template: new sap.m.Token({ text: "{state>}" }), 
                                                            templateShareable: false
                                                        }
                                                    })
                                                ]
                                            }).addStyleClass("sapUiTinyMarginEnd"),

                                            // 4. "Between" Range Input Container (Visible ONLY when operator IS 'Between')
                                            new HBox({
                                                visible: {
                                                    path: "state>operator",
                                                    formatter: function(sOperator) {
                                                        return sOperator === "BT";
                                                    }
                                                },
                                                items: [
                                                    new sap.m.Input({
                                                        width: "135px",
                                                        placeholder: "From value...",
                                                        showValueHelp: true,
                                                        value: "{state>value1}",
                                                        valueHelpRequest: function(oEvent) {
                                                            that._onFilterValueHelpRequest(oEvent, "from");
                                                        }
                                                    }).addStyleClass("sapUiTinyMarginEnd"),
                                                    new sap.m.Input({
                                                        width: "135px",
                                                        placeholder: "To value...",
                                                        showValueHelp: true,
                                                        value: "{state>value2}",
                                                        valueHelpRequest: function(oEvent) {
                                                            that._onFilterValueHelpRequest(oEvent, "to");
                                                        }
                                                    })
                                                ]
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            
                                            new sap.m.ToolbarSpacer(),

                                            // 5. Delete Row Action
                                            new Button({ icon: "sap-icon://delete", type: "Reject", press: (e) => this._deleteFilterRow(e) })
                                        ]
                                    }).addStyleClass("sapUiTinyMargin")
                                ]
                            })
                        }
                    })
                ]
            });
        },

        _deleteFilterRow: function (oEvent) {
            const oItem = oEvent.getSource().getParent().getParent();
            const iIndex = oItem.getParent().indexOfItem(oItem);
            const aFilters = this._stateModel.getProperty("/filter");
            aFilters.splice(iIndex, 1);
            this._stateModel.refresh(true);
        },

       _onFilterValueHelpRequest: function (oEvent, sFieldType) {
            var oInput = oEvent.getSource();
            var oBindingContext = oInput.getBindingContext("state");
            var sKey = oBindingContext.getProperty("key");
            var sLabel = this._meta[sKey] ? this._meta[sKey].label : sKey;

            var oMainModel = this.getModel();
            if (!oMainModel) return;
            var aTreeRootNodes = oMainModel.getProperty(this.getHierarchyPath()) || [];

            var aUniqueValues = [];
            var sChildProp = this.getChildArrayName();

            function extractValuesRecursive(aNodes) {
                if (!aNodes || !Array.isArray(aNodes)) return;
                aNodes.forEach(function (oNode) {
                    var val = oNode[sKey];
                    if (val !== undefined && val !== null && val !== "" && sKey !== sChildProp) {
                        if (!aUniqueValues.includes(val)) {
                            aUniqueValues.push(val);
                        }
                    }
                    if (oNode[sChildProp] && Array.isArray(oNode[sChildProp])) {
                        extractValuesRecursive(oNode[sChildProp]);
                    }
                });
            }
            extractValuesRecursive(aTreeRootNodes);

            var aHelpListData = aUniqueValues.map(function (item) {
                return { 
                    text: item.toString(),
                    selected: false 
                };
            });

            var oValueHelpModel = new JSONModel({ items: aHelpListData });

            // Define selection behavior based on context mode
            var bIsSingleChoice = (sFieldType === "from" || sFieldType === "to");

            var oSelectionList = new List({
                mode: bIsSingleChoice ? "SingleSelectLeft" : "None",
                includeItemInSelection: true,
                rememberSelections: false,
                selectionChange: function(oEvent) {
                    if (bIsSingleChoice) {
                        var oListItem = oEvent.getParameter("listItem");
                        var oCtx = oListItem.getBindingContext("vh");
                        var sSelectedText = oCtx.getProperty("text");
                        
                        var oTargetCtx = oCustomVHDialog.data("targetContext");
                        var oStateModel = oTargetCtx.getModel();
                        var sTargetPropertyPath = (sFieldType === "from") ? "/value1" : "/value2";
                        
                        oStateModel.setProperty(oTargetCtx.getPath() + sTargetPropertyPath, sSelectedText);
                        oStateModel.refresh(true);
                        oCustomVHDialog.close();
                        oCustomVHDialog.destroy();
                    }
                },
                items: {
                    path: "vh>/items",
                    template: new CustomListItem({
                        content: [
                            new HBox({
                                alignItems: "Center",
                                justifyContent: "Start",
                                width: "100%",
                                items: [
                                    // Multi-selection checkboxes (Only rendered for standard inputs, hidden for single choice modes)
                                    new CheckBox({ 
                                        selected: "{vh>selected}",
                                        visible: !bIsSingleChoice,
                                        useLabelForSelectedState: true 
                                    }).addStyleClass("sapUiSmallMarginEnd"),
                                    new Text({ 
                                        text: "{vh>text}",
                                        wrapping: false 
                                    }).addStyleClass("sapUiTinyMarginTopBottom")
                                ]
                            }).addStyleClass("sapUiContentPadding")
                        ]
                    })
                }
            }).addStyleClass("sapUiSizeCompact alvValueHelpListGrid");

            var oSearchField = new sap.m.SearchField({
                width: "100%",
                placeholder: "Search value...",
                liveChange: function (oEvent) {
                    var sQuery = oEvent.getParameter("newValue");
                    var oListBinding = oSelectionList.getBinding("items");
                    if (oListBinding) {
                        if (sQuery && sQuery.trim().length > 0) {
                            var oSearchFilter = new sap.ui.model.Filter({
                                path: "text",
                                operator: sap.ui.model.FilterOperator.Contains,
                                value1: sQuery
                            });
                            oListBinding.filter([oSearchFilter]);
                        } else {
                            oListBinding.filter([]);
                        }
                    }
                }
            });

            var oTopHeaderToolbar = new Toolbar({
                design: "Info",
                content: [
                    new sap.m.ToolbarSpacer(),
                    oSearchField
                ]
            }).addStyleClass("sapUiTinyMarginBottom");

            // Build dialog instance window
            var oCustomVHDialog = new Dialog({
                title: "Select Filter Value — " + sLabel,
                contentHeight: "450px",
                contentWidth: "420px",
                content: [
                    oTopHeaderToolbar,
                    new VBox({ width: "100%", height: "100%", items: [oSelectionList] })
                ],
                buttons: [
                    // Only show explicit OK button when handling a multi-token standard field input
                    new Button({
                        text: "OK",
                        type: "Emphasized",
                        visible: !bIsSingleChoice,
                        press: function () {
                            var aItems = oValueHelpModel.getProperty("/items") || [];
                            var aSelectedTokens = aItems
                                .filter(function (item) { return item.selected; })
                                .map(function (item) { return item.text; });

                            var oTargetCtx = oCustomVHDialog.data("targetContext");
                            var oStateModel = oTargetCtx.getModel();

                            oStateModel.setProperty(oTargetCtx.getPath() + "/values", aSelectedTokens);
                            oStateModel.setProperty(oTargetCtx.getPath() + "/value1", "");
                            oStateModel.setProperty(oTargetCtx.getPath() + "/value2", "");

                            oStateModel.refresh(true);
                            oCustomVHDialog.close();
                            oCustomVHDialog.destroy();
                        }
                    }),
                    new Button({
                        text: "Cancel",
                        press: function () {
                            oCustomVHDialog.close();
                            oCustomVHDialog.destroy();
                        }
                    })
                ]
            });

            // Restore prior selected states on open
            if (bIsSingleChoice) {
                var sCurrentVal = oBindingContext.getProperty(sFieldType === "from" ? "value1" : "value2") || "";
                if (sCurrentVal) {
                    aHelpListData.forEach(function (item) {
                        if (item.text === sCurrentVal.toString()) {
                            item.selected = true;
                        }
                    });
                }
            } else {
                var aCurrentTokens = oBindingContext.getProperty("values") || [];
                if (aCurrentTokens.length > 0) {
                    aHelpListData.forEach(function (item) {
                        if (aCurrentTokens.includes(item.text)) {
                            item.selected = true;
                        }
                    });
                }
            }

            oValueHelpModel.refresh(true);
            oCustomVHDialog.data("targetContext", oBindingContext);
            oCustomVHDialog.setModel(oValueHelpModel, "vh");
            oCustomVHDialog.open();
        },

        _highlightVisibleDomCells: function (oTable, iColIndex) {
            if (!oTable || iColIndex === -1) return;

            const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
            const oColumn = aVisibleColumns[iColIndex];
            if (!oColumn) return;

            const sColumnId = oColumn.getId();
            oTable.$().find("td.alvHighlightCol").removeClass("alvHighlightCol");

            oTable.$().find(".sapUiTableCtrlTr").each(function () {
                const $row = jQuery(this);
                let $targetCell = $row.find("td[data-sap-ui-colid='" + sColumnId + "']");

                if ($targetCell.length === 0) {
                    const bHasRowSelectors = oTable.getSelectionMode() !== "None";
                    const bIsFixedTable = $row.closest(".sapUiTableCtrlScrFix").length > 0;
                    const iFixedCount = oTable.getFixedColumnCount();

                    if (bIsFixedTable) {
                        if (iColIndex < iFixedCount) {
                            const iRealDomIndex = bHasRowSelectors ? iColIndex + 1 : iColIndex;
                            $targetCell = $row.children("td").eq(iRealDomIndex);
                        }
                    } else {
                        if (iColIndex >= iFixedCount) {
                            const iRealDomIndex = iColIndex - iFixedCount;
                            $targetCell = $row.children("td").eq(iRealDomIndex);
                        }
                    }
                }
                $targetCell.addClass("alvHighlightCol");
            });
        },

        _selectALVColumn: function (oColumn, oTable) {
            if (!oColumn || !oTable) return;

            oTable.$().removeClass("alvSelectedColumn");
            oTable.$().find(".alvHighlightCol").removeClass("alvHighlightCol");
            oTable.$().find(".alvHighlightHeader").removeClass("alvHighlightHeader");

            const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
            const iColIndex = aVisibleColumns.findIndex(col => col.getId() === oColumn.getId());

            if (iColIndex === -1) return;

            const sTechnicalName = this._getColumnTechnicalName(oColumn);
            this._viewModel.setProperty("/selectedColumnKey", sTechnicalName);
            this._viewModel.setProperty("/selectedColumn", oColumn);

            const sColumnId = oColumn.getId();
            jQuery("#" + sColumnId).addClass("alvHighlightHeader");
            oTable.$().find("th[data-sap-ui-colid='" + sColumnId + "']").addClass("alvHighlightHeader");

            oTable.$().addClass("alvSelectedColumn");
            this._highlightVisibleDomCells(oTable, iColIndex);
        },

        _getColumnTechnicalName: function (oColumn) {
            let sKey = oColumn.getSortProperty() || oColumn.getFilterProperty();
            if (!sKey && oColumn.getTemplate()) {
                const oBindingInfo = oColumn.getTemplate().getBindingInfo("text");
                if (oBindingInfo && oBindingInfo.parts && oBindingInfo.parts.length > 0) {
                    sKey = oBindingInfo.parts[0].path;
                }
            }
            return sKey || oColumn.getId().split("--").pop();
        },

        onRowsUpdated: function (oEvent) {
            const oTable = oEvent.getSource();
            if (!oTable.getModel()) return;

            const sSavedKey = this._viewModel.getProperty("/selectedColumnKey");
            if (sSavedKey) {
                const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
                const iColIndex = aVisibleColumns.findIndex(col => col.getSortProperty() === sSavedKey);

                if (iColIndex !== -1) {
                    setTimeout(() => {
                        const oTargetCol = aVisibleColumns[iColIndex];
                        if (oTargetCol) {
                            jQuery("#" + oTargetCol.getId()).addClass("alvHighlightHeader");
                            oTable.$().find("th[data-sap-ui-colid='" + oTargetCol.getId() + "']").addClass("alvHighlightHeader");
                        }
                        oTable.$().addClass("alvSelectedColumn");
                        this._highlightVisibleDomCells(oTable, iColIndex);
                    }, 0);
                }
            }
        },

        renderer: function (oRM, oControl) {
            oRM.openStart("div", oControl);
            oRM.openEnd();
            oRM.renderControl(oControl.getAggregation("_table"));
            oRM.close("div");
        }
    });
});

sap.ui.define([
    "sap/ui/core/Control",
    "sap/ui/table/TreeTable", // ✅ Converted to TreeTable
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
                hierarchyPath: { type: "string", defaultValue: "/catalog" }, // ✅ Tree structural root path
                childArrayName: { type: "string", defaultValue: "categories" } // ✅ Parent-child array indicator
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

            // Complete configuration baseline model matching your original structure
            this._stateModel = new JSONModel({
                columns: [],
                sort: [],
                filter: [],
                group: [] // Kept for metadata parity (TreeTable groups via nodes inherently)
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
                .filter(key => key !== this.getChildArrayName()) // 🛡️ Protect child arrays from becoming visible columns
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
           /*  const oModel = this.getModel();
            if (!oModel) return;

            const sHierarchyPath = this.getHierarchyPath();
            const sChildArray = this.getChildArrayName();
            const data = oModel.getProperty(sHierarchyPath);

            if (data && data.length > 0) {
                if (Object.keys(this._meta).length === 0) {
                    this._extractMetadata(data[0]);
                    this._initDefaultState();
                }

                // Bind rows hierarchically for TreeTable parsing
                this._table.bindRows({
                    path: sHierarchyPath,
                    parameters: {
                        arrayNames: [sChildArray]
                    }
                });

                this._applyState();
            } */

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

                // ✅ Clear old backups to ensure refreshing structural state remains clean
                this._oOriginalDataBackup = null;

                // Run state compiler engine directly 
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

        // =========================================================================
        // CORE ENGINE: APPLY SORT, FILTER, AND VISIBILITY STATES DYNAMICALLY
        //By bypassing oBinding.filter(), we avoid the standard UI5 framework bug
        // that hides tree child nodes. The logic explicitly checks: 
        // "If a parent node passes the filter criteria, keep all of its children visible" 
        //and "If a child node passes the filter criteria, preserve its parent structure".
        // =========================================================================
        _applyState: function () {
            const table = this._table;
            const state = this._stateModel.getData();
            const aSorts = state.sort || [];
            const aFilters = state.filter || [];

            table.removeAllColumns();
            const sSelectedColumnKey = this._viewModel.getProperty("/selectedColumnKey");

            // 1. Rebuild Columns Framework Matrix
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

            // 2. Execute Hierarchical Processing via Dataset Interception
            const sHierarchyPath = this.getHierarchyPath();
            const sChildArray = this.getChildArrayName();
            const oModel = this.getModel();
            if (!oModel) return;

            // Save original backup once to prevent permanently deleting rows from memory
            if (!this._oOriginalDataBackup) {
                this._oOriginalDataBackup = JSON.parse(JSON.stringify(oModel.getProperty(sHierarchyPath) || []));
            }

            // Always start filtering/sorting from a fresh copy of the master backup data
            let aWorkingData = JSON.parse(JSON.stringify(this._oOriginalDataBackup));

            // A. Apply Tree-Aware Filtering Rules Engine
            if (aFilters.length > 0) {
                
                // Helper to validate if a single node satisfies all active filter configurations
                const nodeMatchesFilters = (oNode) => {
                    return aFilters.every(f => {
                        const vVal = oNode[f.key];
                        if (vVal === undefined || vVal === null) return false;
                        const sNodeVal = vVal.toString().toLowerCase();

                        if (f.operator === "Contains" && f.value1) {
                            return sNodeVal.includes(f.value1.toLowerCase());
                        }
                        if (f.operator === "EQ" && f.values && f.values.length > 0) {
                            return f.values.some(tokenVal => tokenVal.toString().toLowerCase() === sNodeVal);
                        }
                        return true;
                    });
                };

                // Recursive function to filter nodes while retaining parent-child hierarchies
                const filterTreeNodes = (aNodes) => {
                    if (!aNodes || !Array.isArray(aNodes)) return [];

                    return aNodes.filter(oNode => {
                        const bSelfMatches = nodeMatchesFilters(oNode);
                        
                        // Recursively process children if they exist
                        if (oNode[sChildArray] && Array.isArray(oNode[sChildArray])) {
                            const aFilteredChildren = filterTreeNodes(oNode[sChildArray]);
                            
                            if (bSelfMatches) {
                                // Scenario 1: Parent matches -> Keep the parent AND all its original children intact
                                return true; 
                            } else if (aFilteredChildren.length > 0) {
                                // Scenario 2: Parent fails, but children match -> Keep parent, show matching children
                                oNode[sChildArray] = aFilteredChildren;
                                return true;
                            }
                            return false;
                        }
                        
                        // Scenario 3: Leaf node with no children -> Depend solely on self matching criteria
                        return bSelfMatches;
                    });
                };

                aWorkingData = filterTreeNodes(aWorkingData);
            }

            // B. Apply Sorter Layer Arrays directly to the data arrays
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

                    // Sort children recursively
                    aNodes.forEach(oNode => {
                        if (oNode[sChildArray] && Array.isArray(oNode[sChildArray])) {
                            sortTreeNodes(oNode[sChildArray]);
                        }
                    });
                };

                sortTreeNodes(aWorkingData);
            }

            // C. Push Modified Array State back to UI5 Runtime Core
            // We use a separate sub-property '/_filteredCatalog' to keep UI5 runtime responsive
            oModel.setProperty(sHierarchyPath + "_filtered", aWorkingData);

            // Rebind rows to point dynamically to our filtered path destination
            table.bindRows({
                path: sHierarchyPath + "_filtered",
                parameters: {
                    arrayNames: [sChildArray]
                }
            });
            // ✅ ADDED: Auto-expand all filtered nodes after binding completes
            if (aFilters.length > 0) {
                // Large arbitrary level number ensures all deeply nested children expand completely
                table.expandToLevel(10); 
            } else {
                // Optional: If filters are cleared, collapse back to root level or a clean default baseline
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
                justifyContent: "Start",
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

        // =========================================================================
        // SETTINGS DIALOG ARCHITECTURE WORKSPACE (With Value Help Hooks)
        // =========================================================================
        _openDialog: function () {
            if (!this._dialog) {
                this._oTabBar = new IconTabBar({
                    items: [
                        this._columnsTab(),
                        this._sortTab(),
                        this._filterTab() // Includes updated Value Help inputs
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
            return new IconTabFilter({
                key: "columnTab",
                text: "Columns Display",
                icon: "sap-icon://table-column",
                content: [
                    new List({
                        mode: "SingleSelectMaster",
                        items: {
                            path: "state>/columns",
                            template: new CustomListItem({
                                content: [
                                    new HBox({
                                        alignItems: "Center",
                                        justifyContent: "SpaceBetween",
                                        width: "100%",
                                        items: [
                                            new CheckBox({ selected: "{state>visible}", text: "{state>label}" }),
                                            new HBox({
                                                items: [
                                                    new Button({ icon: "sap-icon://navigation-up-arrow", type: "Transparent", press: (e) => this._moveColumnItem(e, "up") }),
                                                    new Button({ icon: "sap-icon://navigation-down-arrow", type: "Transparent", press: (e) => this._moveColumnItem(e, "down") })
                                                ]
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
       _sortTab: function () {
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
                                        items: [
                                            new Select({
                                                selectedKey: "{state>key}",
                                                items: Object.keys(this._meta).map(k => new Item({ key: k, text: this._meta[k].label }))
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new Switch({ state: "{state>descending}", customTextOn: "Desc", customTextOff: "Asc" }).addStyleClass("sapUiTinyMarginEnd"),
                                            new Button({ icon: "sap-icon://delete", type: "Reject", press: (e) => this._deleteSortRow(e) })
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
            const oItem = oEvent.getSource().getParent().getParent();
            const iIndex = oItem.getParent().indexOfItem(oItem);
            const aSorts = this._stateModel.getProperty("/sort");
            aSorts.splice(iIndex, 1);
            this._stateModel.refresh(true);
        },

       // =========================================================================
        // FILTER ENGINE: MULTI-INPUT VALUE HELP POPULATION
        // =========================================================================
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
                            aFilters.push({ key: Object.keys(this._meta)[0], operator: "Contains", value1: "", values: [] });
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
                                            new Select({
                                                selectedKey: "{state>key}",
                                                items: Object.keys(this._meta).map(k => new Item({ key: k, text: this._meta[k].label })),
                                                change: function(oEvent) {
                                                    // Clear tokens/values if technical target key switches
                                                    var oCtx = oEvent.getSource().getBindingContext("state");
                                                    if(oCtx) {
                                                        oCtx.getModel().setProperty(oCtx.getPath() + "/value1", "");
                                                        oCtx.getModel().setProperty(oCtx.getPath() + "/values", []);
                                                    }
                                                }
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new Select({
                                                selectedKey: "{state>operator}",
                                                items: [
                                                    new Item({ key: "Contains", text: "Contains Text" }),
                                                    new Item({ key: "EQ", text: "Equals Multi-Selection" })
                                                ]
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            
                                            // ✅ FIXED: Changed from 'new Input' to 'new sap.m.MultiInput'
                                            new sap.m.MultiInput({
                                                showValueHelp: true,
                                                value: "{state>value1}",
                                                placeholder: "Type value or open Value Help...",
                                                valueHelpRequest: function (oEvent) {
                                                    that._onFilterValueHelpRequest(oEvent);
                                                },
                                                tokens: {
                                                    path: "state>values",
                                                    // Binds directly to primitive strings in the array
                                                    template: new sap.m.Token({ text: "{state>}" }), 
                                                    templateShareable: false
                                                }
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            
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
        // =========================================================================
        // HIERARCHICAL NODE HARVESTER VALUE HELP LOGIC
        // =========================================================================
       // =========================================================================
        // VALUE HELP DIALOG: TABULAR GRID WITH LIVE SEARCH CAPABILITY
        // =========================================================================
        _onFilterValueHelpRequest: function (oEvent) {
            var oInput = oEvent.getSource();
            var oBindingContext = oInput.getBindingContext("state");
            var sKey = oBindingContext.getProperty("key");
            var sLabel = this._meta[sKey] ? this._meta[sKey].label : sKey;

            // 1. Harvest raw hierarchical tree items from your core dataset
            var oMainModel = this.getModel();
            if (!oMainModel) return;
            var aTreeRootNodes = oMainModel.getProperty(this.getHierarchyPath()) || [];

            // 2. Recursive strategy to discover unique values across nested nodes safely
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

            // Construct baseline table data array state
            var aHelpListData = aUniqueValues.map(function (item) {
                return { 
                    text: item.toString(),
                    selected: false 
                };
            });

            var oValueHelpModel = new JSONModel({ items: aHelpListData });

            // 3. Build the Dialog Grid list container elements
            var oSelectionList = new List({
                includeItemInSelection: true,
                rememberSelections: false,
                items: {
                    path: "vh>/items",
                    template: new CustomListItem({
                        content: [
                            new HBox({
                                alignItems: "Center",
                                justifyContent: "Start",
                                width: "100%",
                                items: [
                                    new CheckBox({ 
                                        selected: "{vh>selected}",
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

           

            // ✅ ADDED: Live SearchField Handler setup matching your specification
            var oSearchField = new sap.m.SearchField({
                width: "100%",
                placeholder: "Search value...",
                liveChange: function (oEvent) {
                    var sQuery = oEvent.getParameter("newValue");
                    var oListBinding = oSelectionList.getBinding("items");
                    
                    if (oListBinding) {
                        if (sQuery && sQuery.trim().length > 0) {
                            // Target the 'text' property inside the vh model definition
                            var oSearchFilter = new sap.ui.model.Filter({
                                path: "text",
                                operator: sap.ui.model.FilterOperator.Contains,
                                value1: sQuery
                            });
                            oListBinding.filter([oSearchFilter]);
                        } else {
                            // Clear filters if search bar is emptied
                            oListBinding.filter([]);
                        }
                    }
                }
            });

            // Assemble top toolbar bar panel housing actions and search fields
            var oTopHeaderToolbar = new Toolbar({
                design: "Info",
                content: [
                    //oSelectAllCheckbox,
                    new sap.m.ToolbarSpacer(),
                    oSearchField // ✅ Injected search bar component right here
                ]
            }).addStyleClass("sapUiTinyMarginBottom");

            // Core dialog instance setup wrapper
            var oCustomVHDialog = new Dialog({
                title: "Maintain Filter Multi-Selection — " + sLabel,
                contentHeight: "450px",
                contentWidth: "420px",
                content: [
                    oTopHeaderToolbar,
                    new VBox({
                        width: "100%",
                        height: "100%",
                        items: [oSelectionList]
                    })
                ],
                buttons: [
                    new Button({
                        text: "OK",
                        type: "Emphasized",
                        press: function () {
                            // Extract values where internal checkbox selection matches true
                            var aItems = oValueHelpModel.getProperty("/items") || [];
                            var aSelectedTokens = aItems
                                .filter(function (item) { return item.selected; })
                                .map(function (item) { return item.text; });

                            var oTargetCtx = oCustomVHDialog.data("targetContext");
                            var oStateModel = oTargetCtx.getModel();

                            // Assign tokens back into active filters array matrix tracking settings
                            oStateModel.setProperty(oTargetCtx.getPath() + "/values", aSelectedTokens);
                            oStateModel.setProperty(oTargetCtx.getPath() + "/operator", "EQ");
                            oStateModel.setProperty(oTargetCtx.getPath() + "/value1", "");

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

            // Restore pre-checked tokens state maps if loaded previously
            var aCurrentTokens = oBindingContext.getProperty("values") || [];
            if (aCurrentTokens.length > 0) {
                aHelpListData.forEach(function (item) {
                    if (aCurrentTokens.includes(item.text)) {
                        item.selected = true;
                    }
                });
                oValueHelpModel.refresh(true);
                
                if (aCurrentTokens.length === aHelpListData.length) {
                    oSelectAllCheckbox.setSelected(true);
                }
            }

            oCustomVHDialog.data("targetContext", oBindingContext);
            oCustomVHDialog.setModel(oValueHelpModel, "vh");
            oCustomVHDialog.open();
        },
        // =========================================================================
        // DOM RENDERING VIEWS HIGHLIGHT ENGINE (Tree Splits Aware)
        // =========================================================================
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

                // Layout safe fallback processing supporting split panels natively
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

            // Retain full-column highlights dynamically across expansion layer tracking events
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

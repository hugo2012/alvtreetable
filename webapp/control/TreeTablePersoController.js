sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel",
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
    "sap/ui/core/Item",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Popover",
    "sap/m/SearchField",
    "sap/m/Token"
], function (BaseObject, JSONModel, Column, Text, Button, Toolbar, 
    Dialog, IconTabBar, IconTabFilter, List, CustomListItem, HBox, VBox, CheckBox, 
    Input, Select, Item, MessageToast, MessageBox, Popover, SearchField, Token) {
    "use strict";

    return BaseObject.extend("com.grid.alvdemo.util.TreeTablePersoController", {

        /**
         * Constructor for the Completely Custom Personalization & Variant Controller
         */
        constructor: function (mSettings) {
            BaseObject.apply(this, arguments);

            if (!mSettings || !mSettings.table) {
                throw new Error("Missing required 'table' configuration property.");
            }

            this._table = mSettings.table;
            this._hierarchyPath = mSettings.hierarchyPath || "/catalog";
            this._childArrayName = mSettings.childArrayName || "categories";
            this._tableId = mSettings.tableId || "TreeTableDefaultID";
            
            this._oODataModel = mSettings.odataModel || this._table.getModel();
            this._sVariantEntitySet = mSettings.variantEntitySet || "/VariantSet";

            this._meta = {};
            this._oOriginalDataBackup = null;
            this._sCurrentVariantKey = "*STANDARD*";

            // Local cache to hold variants retrieved from the SAP Backend
            this._aBackendVariants = [];

            this._viewModel = new JSONModel({
                selectedColumnKey: null,
                selectedColumn: null
            });

            this._stateModel = new JSONModel({
                columns: [],
                sort: [],
                filter: [],
                group: []
            });

            // Model to manage custom variants popover and dialog states
            this._customVariantModel = new JSONModel({
                currentVariantName: "Standard",
                isCurrentModified: false,
                variantsList: [],
                
                // Fields for the "Save As" Dialog form
                saveAs: {
                    name: "",
                    isDefault: false,
                    isPublic: false
                }
            });

            this._table.attachRowsUpdated(this.onRowsUpdated.bind(this));
            this._injectCustomToolbarControls();
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
                .filter(key => key !== this._childArrayName)
                .map((key, index) => ({
                    key: key,
                    label: this._meta[key].label || key,
                    visible: true,
                    order: index,
                    width: this._meta[key].width || "200px"
                }));
            
            this._stateModel.setProperty("/columns", cols);
            this._oStandardStateBackup = JSON.stringify(this._stateModel.getData());
        },

        /* initializeTableState: function () {
            const oModel = this._table.getModel();
            if (!oModel) return;

            if (!this._oODataModel) {
                this._oODataModel = this._table.getModel();
            }

            const data = oModel.getProperty(this._hierarchyPath);
            if (data && data.length > 0) {
                if (Object.keys(this._meta).length === 0) {
                    this._extractMetadata(data[0]);
                    this._initDefaultState();
                }
                this._oOriginalDataBackup = null;
                this._fetchBackendVariants(); 
            }
        }, */

        initializeTableState: function () {
            const oModel = this._table.getModel();
            if (!oModel) return;

            if (!this._oODataModel) {
                this._oODataModel = oModel;
            }

            const data = oModel.getProperty(this._hierarchyPath);
            
            // Check if data is already loaded in the model
            if (data && data.length > 0) {
                this._processInitialSetup(data[0]);
            } else {
                // Data isn't ready yet. Attach a listener to wait for rows to bind or change
                const oBinding = this._table.getBinding("rows");
                if (oBinding) {
                    const fnDataReceived = function () {
                        oBinding.detachChange(fnDataReceived, this);
                        const oNewData = oModel.getProperty(this._hierarchyPath);
                        if (oNewData && oNewData.length > 0) {
                            this._processInitialSetup(oNewData[0]);
                        }
                    }.bind(this);
                    
                    oBinding.attachChange(fnDataReceived, this);
                } else {
                    // Fallback: If rows are not bound yet, listen to the model's property change
                    const fnModelChange = function (oEvent) {
                        const oNewData = oModel.getProperty(this._hierarchyPath);
                        if (oNewData && oNewData.length > 0) {
                            oModel.detachPropertyChange(fnModelChange, this);
                            this._processInitialSetup(oNewData[0]);
                        }
                    }.bind(this);
                    oModel.attachPropertyChange(fnModelChange, this);
                }
            }
        },

        /**
         * Helper method to execute setup once model data is guaranteed present
         */
         _processInitialSetup: function (oFirstRowSample) {
            if (Object.keys(this._meta).length === 0 && oFirstRowSample) {
                this._extractMetadata(oFirstRowSample);
                this._initDefaultState();
            }
            this._oOriginalDataBackup = null;
            this._fetchBackendVariants(); // This triggers your simulated delay spinner
        }, 

        // =========================================================================
        // CUSTOM VARIANT MANAGEMENT UI DOM INJECTION
        // =========================================================================
        
        /* _injectCustomToolbarControls: function () {
            let oToolbar = this._table.getExtension().find(ext => ext.getMetadata().getName() === "sap.m.Toolbar");
            if (!oToolbar) {
                oToolbar = new Toolbar();
                this._table.addExtension(oToolbar);
            }

            // Custom UI Variant triggering layout link button
            this._oVariantTriggerBtn = new Button({
                text: "{customVar>/currentVariantName}",
                type: "Transparent",
                icon: "sap-icon://slim-arrow-down",
                iconFirst: false,
                press: (oEvent) => this._openVariantsPopover(oEvent.getSource())
            }).addStyleClass("sapUiTinyMarginEnd").setModel(this._customVariantModel, "customVar");

            // Variant modified marker label ("*")
            this._oVariantModifiedLabel = new Text({
                text: "*",
                visible: "{customVar>/isCurrentModified}"
            }).addStyleClass("sapUiTinyMarginEnd").setModel(this._customVariantModel, "customVar");

            oToolbar.insertContent(this._oVariantTriggerBtn, 0);
            oToolbar.insertContent(this._oVariantModifiedLabel, 1);
            
            if (!oToolbar.getContent().some(ctrl => ctrl.getMetadata().getName() === "sap.m.Button" && ctrl.getIcon() === "sap-icon://action-settings")) {
                oToolbar.addContent(new sap.m.ToolbarSpacer());
                oToolbar.addContent(new Button({
                    icon: "sap-icon://action-settings",
                    tooltip: "Open Table Configurations",
                    press: () => this._openDialog()
                }));
            }
        }, */
        _injectCustomToolbarControls: function () {
            let oToolbar = this._table.getExtension().find(ext => ext.getMetadata().getName() === "sap.m.Toolbar");
            if (!oToolbar) {
                oToolbar = new Toolbar();
                this._table.addExtension(oToolbar);
            }

            // 1. Build the Custom UI Variant link button
            this._oVariantTriggerBtn = new Button({
                text: "{customVar>/currentVariantName}",
                type: "Transparent",
                icon: "sap-icon://slim-arrow-down",
                iconFirst: false,
                press: (oEvent) => this._openVariantsPopover(oEvent.getSource())
            }).addStyleClass("sapUiTinyMarginEnd").setModel(this._customVariantModel, "customVar");

            // 2. Build the variant modified marker asterisk label ("*")
            this._oVariantModifiedLabel = new Text({
                text: "*",
                visible: "{customVar>/isCurrentModified}"
            }).addStyleClass("sapUiTinyMarginEnd").setModel(this._customVariantModel, "customVar");

            // 3. Clear existing spacer and settings button if they are already present 
            // to avoid duplicates and ensure perfect right-side ordering
            oToolbar.getContent().forEach(function(oControl) {
                if (oControl.getMetadata().getName() === "sap.m.ToolbarSpacer" || 
                   (oControl.getMetadata().getName() === "sap.m.Button" && oControl.getIcon() === "sap-icon://action-settings")) {
                    oToolbar.removeContent(oControl);
                }
            });

            // 4. Push everything that follows to the right hand side
            oToolbar.addContent(new sap.m.ToolbarSpacer());

            // 5. Add your variant items so they sit perfectly on the right side
            oToolbar.addContent(this._oVariantTriggerBtn);
            oToolbar.addContent(this._oVariantModifiedLabel);

            // 6. Finally, add the settings cogwheel configuration button as the very last item
            oToolbar.addContent(new Button({
                icon: "sap-icon://action-settings",
                tooltip: "Open Table Configurations",
                press: () => this._openDialog()
            }));
        },
        // =========================================================================
        // POPOVERS & FORM DIALOGS (Fully customized layout behavior)
        // =========================================================================
        
        _openVariantsPopover: function (oSourceControl) {
            if (!this._oVariantsPopover) {
                const oList = new List({
                        mode: "SingleSelectMaster",
                        rememberSelections: false,
                        selectionChange: (oEvent) => {
                            const oItem = oEvent.getParameter("listItem");
                            
                            // 💎 FIX: Read directly from the JSON model context of the clicked row
                            const oCtx = oItem.getBindingContext("customVar");
                            if (oCtx) {
                                const sKey = oCtx.getProperty("VariantId"); // This gets your 'VAR_001', '*STANDARD*', etc.
                                this._handleVariantSwitch(sKey);
                            }
                            
                            this._oVariantsPopover.close();
                        },
                        items: {
                            path: "customVar>/variantsList",
                            template: new CustomListItem({
                                // (Keep your existing HBox/VBox content here exactly as it is)
                                content: [
                                    new HBox({
                                        justifyContent: "SpaceBetween",
                                        alignItems: "Center",
                                        width: "100%",
                                        items: [
                                            new VBox({
                                                items: [
                                                    new Text({ text: "{customVar>VariantName}", fontStyle: "Bold" }),
                                                    new Text({ text: { parts: [{path: 'customVar>IsPublic'}, {path: 'customVar>IsDefault'}], formatter: (p, d) => (p ? "Public" : "Private") + (d ? " • Default" : "") }, syntax: "Complex" }).addStyleClass("sapUiTinyMarginTop")
                                                ]
                                            }),
                                            new Text({ text: "{customVar>CreatedBy}", visible: { path: "customVar>VariantId", formatter: k => k !== "*STANDARD*" } }).addStyleClass("sapUiSubFeedItem")
                                        ]
                                    }).addStyleClass("sapUiSmallMargin")
                                ]
                            })
                        }
                    });
                oList.data("listRef", true);

                this._oVariantsPopover = new Popover({
                    title: "Layout Variants",
                    placement: "Bottom",
                    contentWidth: "320px",
                    content: [
                        new Toolbar({
                            content: [
                                new Button({ text: "Save As", icon: "sap-icon://save", press: () => { this._oVariantsPopover.close(); this._openSaveAsDialog(); } }),
                                new Button({ text: "Manage", icon: "sap-icon://action-settings", press: () => { this._oVariantsPopover.close(); this._openManageLayoutsDialog(); } })
                            ]
                        }),
                        oList
                    ]
                }).setModel(this._customVariantModel, "customVar");
            }
            this._oVariantsPopover.openBy(oSourceControl);
        },

        _openSaveAsDialog: function () {
            this._customVariantModel.setProperty("/saveAs", { name: "", isDefault: false, isPublic: false });

            if (!this._oSaveAsDialog) {
                this._oSaveAsDialog = new Dialog({
                    title: "Save Layout Variant As",
                    type: "Message",
                    contentWidth: "400px",
                    content: [
                        new VBox({
                            items: [
                                new Text({ text: "Variant Name:" }).addStyleClass("sapUiTinyMarginBottom"),
                                new Input({ value: "{customVar>/saveAs/name}", placeholder: "Enter layout name...", required: true }),
                                new CheckBox({ selected: "{customVar>/saveAs/isDefault}", text: "Set as Default Layout" }).addStyleClass("sapUiSmallMarginTop"),
                                new CheckBox({ selected: "{customVar>/saveAs/isPublic}", text: "Public (Shared with all users)" })
                            ]
                        }).addStyleClass("sapUiContentPadding")
                    ],
                    buttons: [
                        new Button({ text: "Save", type: "Emphasized", press: () => this._executeVariantSave() }),
                        new Button({ text: "Cancel", press: () => this._oSaveAsDialog.close() })
                    ]
                }).setModel(this._customVariantModel, "customVar");
            }
            this._oSaveAsDialog.open();
        },

        _openManageLayoutsDialog: function () {
            // Build a deep editable structure snapshot for local management operations
            const aCurrentList = this._customVariantModel.getProperty("/variantsList") || [];
            const aEditableList = JSON.parse(JSON.stringify(aCurrentList)).filter(v => v.VariantId !== "*STANDARD*");
            
            const oManageModel = new JSONModel({
                items: aEditableList,
                initialDefaultKey: aCurrentList.find(v => v.IsDefault)?.VariantId || "*STANDARD*"
            });

            const oTableList = new List({
                items: {
                    path: "mgmt>/items",
                    template: new CustomListItem({
                        content: [
                            new HBox({
                                alignItems: "Center",
                                width: "100%",
                                justifyType: "SpaceBetween",
                                items: [
                                    new Input({ value: "{mgmt>VariantName}", width: "200px" }),
                                    new CheckBox({ 
                                        text: "Default", 
                                        selected: "{mgmt>IsDefault}",
                                        select: (oEvent) => {
                                            const bSel = oEvent.getParameter("selected");
                                            const sPath = oEvent.getSource().getBindingContext("mgmt").getPath();
                                            if (bSel) {
                                                // Radio-button behavior for the default property
                                                const aItems = oManageModel.getProperty("/items");
                                                aItems.forEach((item, idx) => {
                                                    if ("/items/" + idx !== sPath) item.IsDefault = false;
                                                });
                                                oManageModel.refresh(true);
                                            }
                                        }
                                    }),
                                    new CheckBox({ text: "Public", selected: "{mgmt>IsPublic}", editable: true }),
                                    new Button({ icon: "sap-icon://delete", type: "Reject", press: (e) => {
                                        const sItemPath = e.getSource().getBindingContext("mgmt").getPath();
                                        const idx = parseInt(sItemPath.split("/").pop(), 10);
                                        const aItems = oManageModel.getProperty("/items");
                                        aItems.splice(idx, 1);
                                        oManageModel.refresh(true);
                                    }})
                                ]
                            }).addStyleClass("sapUiTinyMargin")
                        ]
                    })
                }
            });

            const oMgmtDialog = new Dialog({
                title: "Manage Layout Variants",
                contentWidth: "600px",
                contentHeight: "400px",
                content: [ oTableList ],
                buttons: [
                    new Button({
                        text: "Save Changes",
                        type: "Emphasized",
                        press: () => {
                            this._executeVariantManagementSync(oManageModel.getProperty("/items"), aCurrentList);
                            oMgmtDialog.close();
                            oMgmtDialog.destroy();
                        }
                    }),
                    new Button({ text: "Cancel", press: () => { oMgmtDialog.close(); oMgmtDialog.destroy(); } })
                ]
            });

            oMgmtDialog.setModel(oManageModel, "mgmt");
            oMgmtDialog.open();
        },

        // =========================================================================
        // BACKEND CONTROLLER NETWORK CRUD LIFECYCLE FOR ODAtA
        // =========================================================================
        
       /*  _fetchBackendVariants: function () {
            if (!this._oODataModel || typeof this._oODataModel.read !== "function") {
                this._rebuildVariantsListDropdown();
                this._applyState();
                return;
            }

            this._table.setBusy(true);
            this._oODataModel.read(this._sVariantEntitySet, {
                filters: [new sap.ui.model.Filter("TableId", "EQ", this._tableId)],
                success: function (oData) {
                    this._table.setBusy(false);
                    this._aBackendVariants = oData.results || [];
                    
                    this._rebuildVariantsListDropdown();

                    // Automatically spin up the configured default configuration profile
                    const oDefaultVar = this._aBackendVariants.find(v => v.IsDefault === true || v.IsDefault === "X");
                    if (oDefaultVar) {
                        this._sCurrentVariantKey = oDefaultVar.VariantId;
                        this._customVariantModel.setProperty("/currentVariantName", oDefaultVar.VariantName);
                        this._stateModel.setData(JSON.parse(oDefaultVar.ConfigData));
                    }
                    this._applyState();
                }.bind(this),
                error: function () {
                    this._table.setBusy(false);
                    MessageToast.show("Backend communication failure loading layout fields catalogs.");
                    this._rebuildVariantsListDropdown();
                    this._applyState();
                }.bind(this)
            });
        }, */
        // =========================================================================
        // SIMULATED MOCK NETWORK CRUD LIFECYCLE (Replaces live OData requests)
        // =========================================================================

        _fetchBackendVariants: function () {
            this._table.setBusy(true);

            // Simulate Network Latency Delay (800ms)
            setTimeout(function () {
                this._table.setBusy(false);
                
                // Read directly from our global simulated array
                const aAllVariants = window._mockVariantDB || [];
                // Filter by the matching table ID parameter configuration rule
                this._aBackendVariants = aAllVariants.filter(v => v.TableId === this._tableId);
                
                this._rebuildVariantsListDropdown();

                // Check if there's a default layout flagged in our mock data array
                const oDefaultVar = this._aBackendVariants.find(v => v.IsDefault === true);
                if (oDefaultVar) {
                    this._sCurrentVariantKey = oDefaultVar.VariantId;
                    this._customVariantModel.setProperty("/currentVariantName", oDefaultVar.VariantName);
                    this._stateModel.setData(JSON.parse(oDefaultVar.ConfigData));
                }
                this._applyState();
            }.bind(this), 800);
        },

        _executeVariantSave: function () {
            const oForm = this._customVariantModel.getProperty("/saveAs");
            if (!oForm.name || oForm.name.trim() === "") {
                sap.m.MessageBox.error("Please enter a valid layout template variant description text.");
                return;
            }

            const sGeneratedGUID = "VAR_" + Date.now();
            const sSerializedPayload = JSON.stringify(this._stateModel.getData());

            // Construct a replica mock payload object mapping exactly to backend requirements
            const oNewMockRecord = {
                VariantId: sGeneratedGUID,
                VariantName: oForm.name,
                TableId: this._tableId,
                IsDefault: oForm.isDefault,
                IsPublic: oForm.isPublic,
                CreatedBy: "SIMULATED_USER",
                ConfigData: sSerializedPayload
            };

            this._table.setBusy(true);

            setTimeout(function () {
                this._table.setBusy(false);

                // If this record is being set as the new default, clear previous mock records defaults
                if (oForm.isDefault) {
                    window._mockVariantDB.forEach(v => {
                        if (v.TableId === this._tableId) v.IsDefault = false;
                    });
                }

                // Save (Push) directly into our local runtime array tracking storage layer
                window._mockVariantDB.push(oNewMockRecord);
                
                this._aBackendVariants.push(oNewMockRecord);
                this._sCurrentVariantKey = sGeneratedGUID;
                this._customVariantModel.setProperty("/currentVariantName", oForm.name);
                this._customVariantModel.setProperty("/isCurrentModified", false);
                
                this._rebuildVariantsListDropdown();
                this._oSaveAsDialog.close();
                
                sap.m.MessageToast.show("Layout profile successfully saved to Simulated Backend Context.");
            }.bind(this), 600);
        },

        _executeVariantManagementSync: function (aEditedClientItems, aOldFullList) {
            this._table.setBusy(true);

            setTimeout(function () {
                this._table.setBusy(false);

                // 1. Process Simulated Deletions
                aOldFullList.forEach(oldItem => {
                    if (oldItem.VariantId === "*STANDARD*") return;
                    const bStillExists = aEditedClientItems.some(e => e.VariantId === oldItem.VariantId);
                    if (!bStillExists) {
                        // Remove from local database storage state array
                        window._mockVariantDB = window._mockVariantDB.filter(v => v.VariantId !== oldItem.VariantId);
                    }
                });

                // 2. Process Simulated Updates (Names / Visibility Rules checkboxes changes)
                aEditedClientItems.forEach(editedItem => {
                    const oTargetMatch = window._mockVariantDB.find(v => v.VariantId === editedItem.VariantId);
                    if (oTargetMatch) {
                        oTargetMatch.VariantName = editedItem.VariantName;
                        oTargetMatch.IsPublic = editedItem.IsPublic;
                        oTargetMatch.IsDefault = editedItem.IsDefault;
                    }
                });

                // Ensure if one layout is selected as default, others are reset in the mock DB list
                const oNewDefault = aEditedClientItems.find(e => e.IsDefault);
                if (oNewDefault) {
                    window._mockVariantDB.forEach(v => {
                        if (v.TableId === this._tableId && v.VariantId !== oNewDefault.VariantId) {
                            v.IsDefault = false;
                        }
                    });
                }

                sap.m.MessageToast.show("Layout modifications synchronized locally.");
                
                // Re-trigger initialization loop against simulated arrays data
                this._fetchBackendVariants();
            }.bind(this), 700);
        },
        _rebuildVariantsListDropdown: function () {
            const aList = [
                { VariantId: "*STANDARD*", VariantName: "Standard", IsDefault: !this._aBackendVariants.some(v => v.IsDefault), IsPublic: true, CreatedBy: "System" }
            ];
            
            this._aBackendVariants.forEach(v => {
                aList.push({
                    VariantId: v.VariantId,
                    VariantName: v.VariantName,
                    IsDefault: (v.IsDefault === true || v.IsDefault === "X"),
                    IsPublic: (v.IsPublic === true || v.IsPublic === "X"),
                    CreatedBy: v.CreatedBy || "User"
                });
            });
            this._customVariantModel.setProperty("/variantsList", aList);
        },

        _handleVariantSwitch: function (sKey) {
            this._sCurrentVariantKey = sKey;
            
            if (sKey === "*STANDARD*") {
                this._customVariantModel.setProperty("/currentVariantName", "Standard");
                this._stateModel.setData(JSON.parse(this._oStandardStateBackup));
                this._applyState();
                this._customVariantModel.setProperty("/isCurrentModified", false);
                return;
            }

            const oSelected = this._aBackendVariants.find(v => v.VariantId === sKey);
            if (oSelected) {
                this._customVariantModel.setProperty("/currentVariantName", oSelected.VariantName);
                this._stateModel.setData(JSON.parse(oSelected.ConfigData));
                this._applyState();
                this._customVariantModel.setProperty("/isCurrentModified", false);
            }
        },

       /*  _executeVariantSave: function () {
            const oForm = this._customVariantModel.getProperty("/saveAs");
            if (!oForm.name || oForm.name.trim() === "") {
                MessageBox.error("Please enter a valid layout template variant description text.");
                return;
            }

            const sGeneratedGUID = "VAR_" + Date.now();
            const sSerializedPayload = JSON.stringify(this._stateModel.getData());

            const oPayload = {
                VariantId: sGeneratedGUID,
                VariantName: oForm.name,
                TableId: this._tableId,
                IsDefault: oForm.isDefault,
                IsPublic: oForm.isPublic,
                ConfigData: sSerializedPayload
            };

            this._table.setBusy(true);
            this._oODataModel.create(this._sVariantEntitySet, oPayload, {
                success: function (oData) {
                    this._table.setBusy(false);
                    this._oSaveAsDialog.close();
                    MessageToast.show("Custom layout profile deployed to SAP backend server.");
                    
                    // Push into runtime collections array cache
                    this._aBackendVariants.push(oPayload);
                    this._sCurrentVariantKey = sGeneratedGUID;
                    this._customVariantModel.setProperty("/currentVariantName", oForm.name);
                    this._customVariantModel.setProperty("/isCurrentModified", false);
                    
                    this._rebuildVariantsListDropdown();
                }.bind(this),
                error: function (oErr) {
                    this._table.setBusy(false);
                    MessageBox.error("OData execution creation runtime gateway failure operations rejection.");
                }.bind(this)
            });
        }, */

        /* _executeVariantManagementSync: function (aEditedClientItems, aOldFullList) {
            const mExecutionStack = [];

            // Find items deleted by comparing old state versus new edits array mapping profiles
            aOldFullList.forEach(oldItem => {
                if (oldItem.VariantId === "*STANDARD*") return;
                const bStillExists = aEditedClientItems.some(e => e.VariantId === oldItem.VariantId);
                if (!bStillExists) {
                    const sDeletePath = "/" + this._oODataModel.createKey(this._sVariantEntitySet, { VariantId: oldItem.VariantId });
                    mExecutionStack.push(new Promise((res, rej) => {
                        this._oODataModel.remove(sDeletePath, { success: res, error: rej });
                    }));
                }
            });

            // Process updates for remaining altered layout entities
            aEditedClientItems.forEach(editedItem => {
                const oOriginalMatch = this._aBackendVariants.find(v => v.VariantId === editedItem.VariantId);
                if (oOriginalMatch) {
                    // Check if properties actually changed
                    if (oOriginalMatch.VariantName !== editedItem.VariantName || 
                        oOriginalMatch.IsDefault !== editedItem.IsDefault || 
                        oOriginalMatch.IsPublic !== editedItem.IsPublic) {
                        
                        const sUpdatePath = "/" + this._oODataModel.createKey(this._sVariantEntitySet, { VariantId: editedItem.VariantId });
                        const oUpdatePayload = {
                            VariantId: editedItem.VariantId,
                            VariantName: editedItem.VariantName,
                            TableId: this._tableId,
                            IsDefault: editedItem.IsDefault,
                            IsPublic: editedItem.IsPublic,
                            ConfigData: oOriginalMatch.ConfigData // Preserve original structure configuration payload data safely
                        };

                        mExecutionStack.push(new Promise((res, rej) => {
                            this._oODataModel.update(sUpdatePath, oUpdatePayload, { success: res, error: rej });
                        }));
                    }
                }
            });

            if (mExecutionStack.length === 0) return;

            this._table.setBusy(true);
            Promise.all(mExecutionStack)
                .then(() => {
                    MessageToast.show("Layout changes synchronized successfully.");
                    // Reload backend state to sync structural updates locally
                    this._fetchBackendVariants();
                })
                .catch(() => {
                    this._table.setBusy(false);
                    MessageBox.error("Transactional failures executing layout modifications queries on your SAP ERP gateway.");
                });
        }, */

        // =========================================================================
        // CORE UI ALV COMPILATION RULES PROCESSING ENGINES
        // =========================================================================
        _extractMetadata: function (sample) {
            if (!sample || Object.keys(this._meta).length > 0) return;
            Object.keys(sample).forEach(key => {
                if (key === this._childArrayName || key === "__metadata") return;
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

            const oModel = table.getModel();
            if (!oModel) return;

            if (!this._oOriginalDataBackup) {
                this._oOriginalDataBackup = JSON.parse(JSON.stringify(oModel.getProperty(this._hierarchyPath) || []));
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
                        
                        if (oNode[this._childArrayName] && Array.isArray(oNode[this._childArrayName])) {
                            const aFilteredChildren = filterTreeNodes(oNode[this._childArrayName]);
                            if (bSelfMatches) {
                                return true; 
                            } else if (aFilteredChildren.length > 0) {
                                oNode[this._childArrayName] = aFilteredChildren;
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
                        if (oNode[this._childArrayName] && Array.isArray(oNode[this._childArrayName])) {
                            sortTreeNodes(oNode[this._childArrayName]);
                        }
                    });
                };
                sortTreeNodes(aWorkingData);
            }

            oModel.setProperty(this._hierarchyPath + "_filtered", aWorkingData);

            table.bindRows({
                path: this._hierarchyPath + "_filtered",
                parameters: { arrayNames: [this._childArrayName] }
            });

            // Mark layout state modified indicator checkbox asterisk if user customizes layouts manually
            if (this._oStandardStateBackup) {
                let bCurrentIsMod = false;
                if (this._sCurrentVariantKey === "*STANDARD*") {
                    bCurrentIsMod = JSON.stringify(state) !== this._oStandardStateBackup;
                } else {
                    const match = this._aBackendVariants.find(v => v.VariantId === this._sCurrentVariantKey);
                    if (match) bCurrentIsMod = JSON.stringify(state) !== match.ConfigData;
                }
                this._customVariantModel.setProperty("/isCurrentModified", bCurrentIsMod);
            }

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
                    items: [this._columnsTab(), this._sortTab(), this._filterTab()]
                });

                this._dialog = new Dialog({
                    title: "Grid Configuration Settings",
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
                        new Button({ text: "Close", press: () => this._dialog.close() })
                    ]
                });
                this._dialog.setModel(this._stateModel, "state");
            }
            this._dialog.open();
        },

       _columnsTab: function () {
            var oColumnSearchField = new SearchField({
                width: "100%",
                placeholder: "Search columns...",
                liveChange: function (oEvent) {
                    var sQuery = oEvent.getParameter("newValue");
                    var oList = oEvent.getSource().getParent().getParent().getItems()[1];
                    var oListBinding = oList.getBinding("items");
                    if (oListBinding) {
                        if (sQuery && sQuery.trim().length > 0) {
                            oListBinding.filter([new sap.ui.model.Filter({
                                path: "label",
                                operator: sap.ui.model.FilterOperator.Contains,
                                value1: sQuery
                            })]);
                        } else {
                            oListBinding.filter([]);
                        }
                    }
                }.bind(this)
            });

            var oColumnsHeaderToolbar = new Toolbar({
                design: "Info",
                content: [new sap.m.ToolbarSpacer(), oColumnSearchField]
            }).addStyleClass("sapUiTinyMarginBottom");

            var oColumnDisplayList = new List({
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
                                            new Button({ icon: "sap-icon://collapse-group", tooltip: "Move First", type: "Transparent", press: (e) => this._moveColumnItemToExtreme(e, "first") }),
                                            new Button({ icon: "sap-icon://navigation-up-arrow", tooltip: "Move Up", type: "Transparent", press: (e) => this._moveColumnItem(e, "up") }),
                                            new Button({ icon: "sap-icon://navigation-down-arrow", tooltip: "Move Down", type: "Transparent", press: (e) => this._moveColumnItem(e, "down") }),
                                            new Button({ icon: "sap-icon://expand-group", tooltip: "Move Last", type: "Transparent", press: (e) => this._moveColumnItemToExtreme(e, "last") })
                                        ]
                                    }).addStyleClass("alvActionButtonsGroup")
                                ]
                            }).addStyleClass("sapUiTinyMargin")
                        ]
                    })
            }});

            return new IconTabFilter({
                key: "columnTab", text: "Columns Display", icon: "sap-icon://table-column",
                content: [new VBox({ width: "100%", items: [oColumnsHeaderToolbar, oColumnDisplayList] })]
            });
        },

        _moveColumnItemToExtreme: function (oEvent, sDestination) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const aCols = this._stateModel.getProperty("/columns");
            const iIndex = oItem.getParent().indexOfItem(oItem);
            if (iIndex === -1) return;
            const [moved] = aCols.splice(iIndex, 1);
            if (sDestination === "first") aCols.unshift(moved);
            else if (sDestination === "last") aCols.push(moved);
            aCols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },

        _moveColumnItem: function (oEvent, sDirection) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const aCols = this._stateModel.getProperty("/columns");
            const iIndex = oItem.getParent().indexOfItem(oItem);
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
                key: "sortTab", text: "Sorting Layers", icon: "sap-icon://sort",
                content: [
                    new Button({
                        text: "Add Sort Hierarchy Level", icon: "sap-icon://add",
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
                                        alignItems: "Center", width: "100%",
                                        items: [
                                            new Select({
                                                selectedKey: "{state>key}", width: "220px",
                                                items: Object.keys(this._meta).map(k => new Item({ key: k, text: this._meta[k].label }))
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new HBox({
                                                items: [
                                                    new Button({ icon: "sap-icon://sort-ascending", type: { path: "state>descending", formatter: b => b ? "Transparent" : "Emphasized" }, press: e => { var c = e.getSource().getBindingContext("state"); if(c) c.getModel().setProperty(c.getPath() + "/descending", false); } }),
                                                    new Button({ icon: "sap-icon://sort-descending", type: { path: "state>descending", formatter: b => b ? "Emphasized" : "Transparent" }, press: e => { var c = e.getSource().getBindingContext("state"); if(c) c.getModel().setProperty(c.getPath() + "/descending", true); } })
                                                ]
                                            }),
                                            new sap.m.ToolbarSpacer(),
                                            new Button({ icon: "sap-icon://delete", type: "Reject", press: e => this._deleteSortRow(e) })
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
            const aSorts = this._stateModel.getProperty("/sort");
            aSorts.splice(oItem.getParent().indexOfItem(oItem), 1);
            this._stateModel.refresh(true);
        },

       _filterTab: function () {
            var that = this;
            return new IconTabFilter({
                key: "filterTab", text: "Filter Rules Engine", icon: "sap-icon://filter",
                content: [
                    new Button({
                        text: "Add Condition Row", icon: "sap-icon://add",
                        press: () => {
                            const aFilters = this._stateModel.getProperty("/filter") || [];
                            aFilters.push({ key: Object.keys(this._meta)[0], operator: "Contains", value1: "", value2: "", values: [] });
                            this._stateModel.setProperty("/filter", aFilters);
                        }
                    }).addStyleClass("sapUiSmallMarginBottom"),
                    new List({
                        items: {
                            path: "state>/filter",
                            template: new CustomListItem({
                                content: [
                                    new HBox({
                                        alignItems: "Center", width: "100%",
                                        items: [
                                            new Select({
                                                selectedKey: "{state>key}",
                                                items: Object.keys(that._meta).map(k => new Item({ key: k, text: that._meta[k].label })),
                                                change: e => { var c = e.getSource().getBindingContext("state"); if(c) { c.getModel().setProperty(c.getPath() + "/value1", ""); c.getModel().setProperty(c.getPath() + "/value2", ""); c.getModel().setProperty(c.getPath() + "/values", []); } }
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new Select({
                                                selectedKey: "{state>operator}",
                                                items: [ new Item({key: "EQ", text: "Equals"}), new Item({key: "Contains", text: "Contains"}), new Item({key: "BT", text: "Between"}), new Item({key: "GT", text: "Greater"}), new Item({key: "LT", text: "Less"}) ],
                                                change: () => that._stateModel.refresh(true)
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new HBox({
                                                visible: { path: "state>operator", formatter: op => op !== "BT" },
                                                items: [ new sap.m.MultiInput({ width: "280px", showValueHelp: true, value: "{state>value1}", valueHelpRequest: e => that._onFilterValueHelpRequest(e, "standard"), tokens: { path: "state>values", template: new Token({ text: "{state>}" }), templateShareable: false } }) ]
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new HBox({
                                                visible: { path: "state>operator", formatter: op => op === "BT" },
                                                items: [
                                                    new Input({ width: "135px", placeholder: "From", showValueHelp: true, value: "{state>value1}", valueHelpRequest: e => that._onFilterValueHelpRequest(e, "from") }).addStyleClass("sapUiTinyMarginEnd"),
                                                    new Input({ width: "135px", placeholder: "To", showValueHelp: true, value: "{state>value2}", valueHelpRequest: e => that._onFilterValueHelpRequest(e, "to") })
                                                ]
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            new sap.m.ToolbarSpacer(),
                                            new Button({ icon: "sap-icon://delete", type: "Reject", press: e => this._deleteFilterRow(e) })
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
            const aFilters = this._stateModel.getProperty("/filter");
            aFilters.splice(oItem.getParent().indexOfItem(oItem), 1);
            this._stateModel.refresh(true);
        },

       _onFilterValueHelpRequest: function (oEvent, sFieldType) {
            var oInput = oEvent.getSource();
            var oBindingContext = oInput.getBindingContext("state");
            var sKey = oBindingContext.getProperty("key");
            var sLabel = this._meta[sKey] ? this._meta[sKey].label : sKey;
            var oMainModel = this._table.getModel();
            if (!oMainModel) return;
            var aTreeRootNodes = oMainModel.getProperty(this._hierarchyPath) || [];
            var aUniqueValues = [];
            var sChildProp = this._childArrayName;

            function extractValuesRecursive(aNodes) {
                if (!aNodes || !Array.isArray(aNodes)) return;
                aNodes.forEach(function (oNode) {
                    var val = oNode[sKey];
                    if (val !== undefined && val !== null && val !== "" && sKey !== sChildProp) {
                        if (!aUniqueValues.includes(val)) aUniqueValues.push(val);
                    }
                    if (oNode[sChildProp] && Array.isArray(oNode[sChildProp])) {
                        extractValuesRecursive(oNode[sChildProp]);
                    }
                });
            }
            extractValuesRecursive(aTreeRootNodes);

            var aHelpListData = aUniqueValues.map(item => ({ text: item.toString(), selected: false }));
            var oValueHelpModel = new JSONModel({ items: aHelpListData });
            var bIsSingleChoice = (sFieldType === "from" || sFieldType === "to");

            var oSelectionList = new List({
                mode: bIsSingleChoice ? "SingleSelectLeft" : "None",
                includeItemInSelection: true,
                selectionChange: function(e) {
                    if (bIsSingleChoice) {
                        var txt = e.getParameter("listItem").getBindingContext("vh").getProperty("text");
                        var oTargetCtx = oCustomVHDialog.data("targetContext");
                        oTargetCtx.getModel().setProperty(oTargetCtx.getPath() + (sFieldType === "from" ? "/value1" : "/value2"), txt);
                        oCustomVHDialog.close(); oCustomVHDialog.destroy();
                    }
                },
                items: {
                    path: "vh>/items",
                    template: new CustomListItem({ content: [ new HBox({ alignItems: "Center", items: [ new CheckBox({ selected: "{vh>selected}", visible: !bIsSingleChoice }).addStyleClass("sapUiSmallMarginEnd"), new Text({ text: "{vh>text}" }) ] }) ] })
                }
            });

            var oCustomVHDialog = new Dialog({
                title: "Select Value — " + sLabel,
                contentHeight: "450px", contentWidth: "420px",
                content: [ new Toolbar({ content: [ new sap.m.ToolbarSpacer(), new SearchField({ liveChange: e => oSelectionList.getBinding("items").filter(e.getParameter("newValue") ? [new sap.ui.model.Filter("text", "Contains", e.getParameter("newValue"))] : []) }) ] }), oSelectionList ],
                buttons: [
                    new Button({ text: "OK", visible: !bIsSingleChoice, press: () => {
                        var tokens = oValueHelpModel.getProperty("/items").filter(i => i.selected).map(i => i.text);
                        var oTargetCtx = oCustomVHDialog.data("targetContext");
                        oTargetCtx.getModel().setProperty(oTargetCtx.getPath() + "/values", tokens);
                        oCustomVHDialog.close(); oCustomVHDialog.destroy();
                    }}),
                    new Button({ text: "Cancel", press: () => { oCustomVHDialog.close(); oCustomVHDialog.destroy(); } })
                ]
            });

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
                    if (bIsFixedTable) { if (iColIndex < iFixedCount) $targetCell = $row.children("td").eq(bHasRowSelectors ? iColIndex + 1 : iColIndex); }
                    else { if (iColIndex >= iFixedCount) $targetCell = $row.children("td").eq(iColIndex - iFixedCount); }
                }
                $targetCell.addClass("alvHighlightCol");
            });
        },

        onRowsUpdated: function (oEvent) {
            const oTable = oEvent.getSource();
            const sSavedKey = this._viewModel.getProperty("/selectedColumnKey");
            if (sSavedKey && oTable.getModel()) {
                const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
                const iColIndex = aVisibleColumns.findIndex(col => col.getSortProperty() === sSavedKey);
                if (iColIndex !== -1) {
                    setTimeout(() => {
                        const oTargetCol = aVisibleColumns[iColIndex];
                        if (oTargetCol) {
                            jQuery("#" + oTargetCol.getId()).addClass("alvHighlightHeader");
                            oTable.$().find("th[data-sap-ui-colid='" + oTargetCol.getId() + "']").addClass("alvHighlightHeader");
                        }
                        this._highlightVisibleDomCells(oTable, iColIndex);
                    }, 0);
                }
            }
        }
    });
});

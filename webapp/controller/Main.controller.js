sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "com/grid/alvdemo/util/TreeTablePersoController"

], function (Controller, JSONModel, TreeTablePersoController) {
    "use strict";

    return Controller.extend("com.grid.alvdemo.controller.Main", {

      /*   onInit: function () {
            const oTable = this.byId("alvTable");

            // 1. 🔹 Bind your Custom Metadata Configurations (ALV Field Catalog)
            // Note: Exclude your child collection structural property name ("categories") from this list
            oTable.setColumnMeta({
                Name: { label: "Category / Product Name", width: "250px" },
                Age: { label: "Age Group Constraint" },
                Department: { label: "Responsible Department" },
                Salary: { label: "Budget Allocation", type: "amount" }
            });

            // 2. 🔹 Define Tree Navigation Paths matching your properties metadata boundaries
            oTable.setHierarchyPath("/catalog");       // Root data node location path 
            oTable.setChildArrayName("categories");   // The structural object property that contains sub-rows

            // 3. 🔹 Construct Hierarchical Mock Tree Data (Parent -> Child Arrays)
            const oTreeStructureData = {
                catalog: [
                    {
                        Name: "Information Technology",
                        Age: "All",
                        Department: "HQ-IT",
                        Salary: 125000,
                        categories: [ // 📂 Sub-items level 1
                            {
                                Name: "Software Development",
                                Age: "22-55",
                                Department: "IT-DEV",
                                Salary: 85000,
                                categories: [ // 📂 Sub-items level 2 (Nested expansion layers)
                                    { Name: "John (Lead UI5)", Age: 30, Department: "IT-DEV-FRONT", Salary: 5000 },
                                    { Name: "Sara (Architect)", Age: 35, Department: "IT-DEV-ARCH", Salary: 6500 }
                                ]
                            },
                            {
                                Name: "Infrastructure Support",
                                Age: "25-60",
                                Department: "IT-INFRA",
                                Salary: 40000,
                                categories: [
                                    { Name: "Mike (SysAdmin)", Age: 40, Department: "IT-INFRA-OPS", Salary: 7000 }
                                ]
                            }
                        ]
                    },
                    {
                        Name: "Human Resources",
                        Age: "18-65",
                        Department: "HQ-HR",
                        Salary: 44000,
                        categories: [
                            { Name: "Anna (Recruiter)", Age: 25, Department: "HR-TALENT", Salary: 4000 }
                        ]
                    },
                    {
                        Name: "Finance & Accounting",
                        Age: "25-65",
                        Department: "HQ-FIN",
                        Salary: 77000,
                        categories: [
                            { Name: "Robert (CPA)", Age: 45, Department: "FIN-AUDIT", Salary: 77000 }
                        ]
                    }
                ]
            };

            // 4. 🔹 Create and set the global core model to the View layer context 
            const oJSONModel = new JSONModel(oTreeStructureData);
            this.getView().setModel(oJSONModel);

            // 5. Trigger the custom table setup lifecycle manually if needed (handled onAfterRendering usually)
            if (typeof oTable._initTable === "function") {
                oTable._initTable();
            }
        } */
        onInit: function () {
            // 1. 🔹 Construct Hierarchical Mock Tree Data (Parent -> Child Arrays)
            const oTreeStructureData = {
                catalog: [
                    {
                        Name: "Information Technology",
                        Age: "All",
                        Department: "HQ-IT",
                        Salary: 125000,
                        categories: [ // 📂 Sub-items level 1
                            {
                                Name: "Software Development",
                                Age: "22-55",
                                Department: "IT-DEV",
                                Salary: 85000,
                                categories: [ // 📂 Sub-items level 2
                                    { Name: "John (Lead UI5)", Age: 30, Department: "IT-DEV-FRONT", Salary: 5000 },
                                    { Name: "Sara (Architect)", Age: 35, Department: "IT-DEV-ARCH", Salary: 6500 }
                                ]
                            },
                            {
                                Name: "Infrastructure Support",
                                Age: "25-60",
                                Department: "IT-INFRA",
                                Salary: 40000,
                                categories: [
                                    { Name: "Mike (SysAdmin)", Age: 40, Department: "IT-INFRA-OPS", Salary: 7000 }
                                ]
                            }
                        ]
                    },
                    {
                        Name: "Human Resources",
                        Age: "18-65",
                        Department: "HQ-HR",
                        Salary: 44000,
                        categories: [
                            { Name: "Anna (Recruiter)", Age: 25, Department: "HR-TALENT", Salary: 4000 }
                        ]
                    },
                    {
                        Name: "Finance & Accounting",
                        Age: "25-65",
                        Department: "HQ-FIN",
                        Salary: 77000,
                        categories: [
                            { Name: "Robert (CPA)", Age: 45, Department: "FIN-AUDIT", Salary: 77000 }
                        ]
                    }
                ]
            };

            // 2. 🔹 Create and set the global core model to the View layer context 
            const oJSONModel = new JSONModel(oTreeStructureData);
            this.getView().setModel(oJSONModel);

            // 🔹 Initialize Simulated Database Tables for Variants Layer
            // This mocks the backend /VariantSet entity payload structure
            const aMockVariantsDatabase = [
                {
                    VariantId: "VAR_001",
                    VariantName: "IT Executives Overview",
                    TableId: "FIN_CATALOG_TREE_01",
                    IsDefault: true,
                    IsPublic: true,
                    CreatedBy: "MOCK_USER_A",
                    // A pre-configured column arrangement simulation string payload
                    ConfigData: JSON.stringify({
                        columns: [
                            { key: "Name", label: "Category / Product Name", visible: true, order: 0, width: "300px" },
                            { key: "Salary", label: "Budget Allocation", visible: true, order: 1, width: "200px" },
                            { key: "Age", label: "Age Group Constraint", visible: false, order: 2, width: "200px" },
                            { key: "Department", label: "Responsible Department", visible: false, order: 3, width: "200px" }
                        ],
                        sort: [{ key: "Salary", descending: true }],
                        filter: []
                    })
                },
                {
                    VariantId: "VAR_002",
                    VariantName: "Department Layout Profile",
                    TableId: "FIN_CATALOG_TREE_01",
                    IsDefault: false,
                    IsPublic: false,
                    CreatedBy: "CURRENT_USER",
                    ConfigData: JSON.stringify({
                        columns: [
                            { key: "Name", label: "Category / Product Name", visible: true, order: 0, width: "250px" },
                            { key: "Department", label: "Responsible Department", visible: true, order: 1, width: "220px" },
                            { key: "Age", label: "Age Group Constraint", visible: true, order: 2, width: "200px" },
                            { key: "Salary", label: "Budget Allocation", visible: true, order: 3, width: "200px" }
                        ],
                        sort: [],
                        filter: [{ key: "Department", operator: "Contains", value1: "HQ", value2: "", values: [] }]
                    })
                }
            ];

            // Store this in a separate internal window property to safely emulate network requests globally
            window._mockVariantDB = aMockVariantsDatabase;
        },

        /**
         * We move initialization here to ensure that the view elements 
         * and their HTML DOM extensions are fully rendered and ready for binding.
         */
        onAfterRendering: function () {
            // Get a reference to your standard native sap.ui.table.TreeTable control instance
            const oTable = this.byId("alvTable");

            if (!oTable) {
                return;
            }

            // 3. 🔹 Instantiate the Plug-and-Play Personalization Controller Class
            this._oPersoController = new TreeTablePersoController({
                table: oTable,                        // Pass the reference to the tree table instance
                hierarchyPath: "/catalog",           // Root data node location path
                childArrayName: "categories" ,        // Structural object property for nested rows
                tableId: "FIN_CATALOG_TREE_01"
            });

            // 4. 🔹 Bind your Custom Metadata Configurations (Field Catalog)
            this._oPersoController.setColumnMeta({
                Name: { label: "Category / Product Name", width: "250px" },
                Age: { label: "Age Group Constraint" },
                Department: { label: "Responsible Department" },
                Salary: { label: "Budget Allocation", type: "amount" }
            });

            // 5. 🔹 Initialize and execute state generation (Sort / Filter UI construction)
            this._oPersoController.initializeTableState();
        }
    });
});

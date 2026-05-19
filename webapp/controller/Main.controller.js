sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("com.grid.alvdemo.controller.Main", {

        onInit: function () {
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
        }

    });
});
/**
 * SFC Genealogy Plugin Controller
 * 
 * Fetches assembled components from SAP DM Assembly API
 * and displays them in a hierarchical tree view.
 * 
 * @namespace sap.dm.custom.plugin.sfcGenealogy.controller
 */
sap.ui.define([
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/base/Log"
], function (PluginViewController, JSONModel, MessageToast, MessageBox, Log) {
    "use strict";

    var oLogger = Log.getLogger("sfcGenealogy", Log.Level.INFO);

    return PluginViewController.extend("sap.dm.custom.plugin.sfcGenealogy.controller.MainView", {

        /**
         * Controller initialization
         */
        onInit: function () {
            if (PluginViewController.prototype.onInit) {
                PluginViewController.prototype.onInit.apply(this, arguments);
            }

            // Initialize models
            this._initModels();
        },

        /**
         * Initialize view models
         */
        _initModels: function () {
            // Main genealogy model
            var oGenealogyModel = new JSONModel({
                sfc: "",
                sfcDescription: "",
                material: "",
                materialDescription: "",
                components: [],
                hierarchyData: [],
                totalComponents: 0,
                isLoading: false,
                hasData: false,
                lastRefresh: null
            });
            this.getView().setModel(oGenealogyModel, "genealogy");

            // View state model
            var oViewState = new JSONModel({
                expandAll: true,
                showDetails: true,
                filterText: ""
            });
            this.getView().setModel(oViewState, "viewState");
        },

        /**
         * Called before plugin rendering - subscribe to events
         */
        onBeforeRenderingPlugin: function () {
            this.subscribe("PodSelectionChangeEvent", this._onPodSelectionChange, this);
            this.subscribe("WorklistSelectEvent", this._onWorklistSelect, this);
            this.subscribe("OperationListSelectEvent", this._onOperationChange, this);
        },

        /**
         * Called after view rendering
         */
        onAfterRendering: function () {
            // Load data if SFC is already selected
            this._loadGenealogyData();
        },

        /**
         * Cleanup on exit
         */
        onExit: function () {
            this.unsubscribe("PodSelectionChangeEvent", this._onPodSelectionChange, this);
            this.unsubscribe("WorklistSelectEvent", this._onWorklistSelect, this);
            this.unsubscribe("OperationListSelectEvent", this._onOperationChange, this);

            if (PluginViewController.prototype.onExit) {
                PluginViewController.prototype.onExit.apply(this, arguments);
            }
        },

        /**
         * Handle POD selection change
         */
        _onPodSelectionChange: function (sChannelId, sEventId, oData) {
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this._loadGenealogyData();
        },

        /**
         * Handle worklist selection
         */
        _onWorklistSelect: function (sChannelId, sEventId, oData) {
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this._loadGenealogyData();
        },

        /**
         * Handle operation change
         */
        _onOperationChange: function (sChannelId, sEventId, oData) {
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this._loadGenealogyData();
        },

        /**
         * Get current SFC from POD selection
         */
        _getCurrentSfc: function () {
            var oPodSelectionModel = this.getPodSelectionModel();
            if (!oPodSelectionModel) {
                return null;
            }

            var aSelections = oPodSelectionModel.getSelections();
            if (!aSelections || aSelections.length === 0) {
                return null;
            }

            var oSelection = aSelections[0];
            var oSfc = oSelection.getSfc();
            return oSfc ? oSfc.getSfc() : oSelection.getInput();
        },

        /**
         * Get current operation from POD selection
         */
        _getCurrentOperation: function () {
            var oPodSelectionModel = this.getPodSelectionModel();
            if (!oPodSelectionModel) {
                return null;
            }

            var aOperations = oPodSelectionModel.getOperations();
            if (aOperations && aOperations.length > 0) {
                return aOperations[0].operation;
            }
            return null;
        },

        /**
         * Load genealogy data from API
         */
        _loadGenealogyData: function () {
            var sSfc = this._getCurrentSfc();
            if (!sSfc) {
                this._clearData();
                return;
            }

            var oModel = this.getView().getModel("genealogy");
            oModel.setProperty("/isLoading", true);
            oModel.setProperty("/sfc", sSfc);

            var sPlant = this.getPodController().getUserPlant();
            var sOperation = this._getCurrentOperation();
            
            // operationActivity is required - just the operation name
            var sOperationActivity = sOperation || "";

            // If no operation, show message and return
            if (!sOperationActivity) {
                oModel.setProperty("/isLoading", false);
                oModel.setProperty("/hasData", false);
                this.showErrorMessage("Please select an operation to view assembled components", true, false);
                return;
            }

            // Build API URL with required operationActivity parameter
            var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/assembledComponents";
            sUrl += "?plant=" + encodeURIComponent(sPlant);
            sUrl += "&sfc=" + encodeURIComponent(sSfc);
            sUrl += "&operationActivity=" + encodeURIComponent(sOperationActivity);

            oLogger.info("Fetching assembled components for SFC: " + sSfc + ", Operation: " + sOperationActivity);

            var that = this;
            this.ajaxGetRequest(sUrl, null,
                function (oResponse) {
                    that._processApiResponse(oResponse, sSfc);
                },
                function (oError) {
                    that._handleApiError(oError);
                }
            );
        },

        /**
         * Process API response and build hierarchy
         */
        _processApiResponse: function (oResponse, sSfc) {
            var oModel = this.getView().getModel("genealogy");
            
            // Log full response for debugging
            oLogger.info("API Response type:", typeof oResponse);
            oLogger.info("API Response keys:", oResponse ? Object.keys(oResponse) : "null");
            console.log("Full API Response:", JSON.stringify(oResponse, null, 2));

            var aComponents = [];
            
            // Handle different response structures
            if (oResponse && Array.isArray(oResponse)) {
                oLogger.info("Response is array with length:", oResponse.length);
                aComponents = oResponse;
            } else if (oResponse && oResponse.assembledComponents && Array.isArray(oResponse.assembledComponents)) {
                oLogger.info("Response has assembledComponents array");
                aComponents = oResponse.assembledComponents;
            } else if (oResponse && oResponse.value && Array.isArray(oResponse.value)) {
                oLogger.info("Response has value array");
                aComponents = oResponse.value;
            } else if (oResponse && typeof oResponse === 'object') {
                // Check if response itself is a single component or has other structure
                oLogger.info("Response is object, checking structure...");
                // Try to find arrays in the response
                for (var key in oResponse) {
                    if (Array.isArray(oResponse[key])) {
                        oLogger.info("Found array in key:", key, "with length:", oResponse[key].length);
                        aComponents = oResponse[key];
                        break;
                    }
                }
            }
            
            oLogger.info("Extracted components count:", aComponents.length);

            // Process components and build hierarchy
            var aProcessedComponents = this._processComponents(aComponents);
            var aHierarchyData = this._buildHierarchy(aProcessedComponents, sSfc);

            oModel.setProperty("/components", aProcessedComponents);
            oModel.setProperty("/hierarchyData", aHierarchyData);
            oModel.setProperty("/totalComponents", aProcessedComponents.length);
            oModel.setProperty("/hasData", aProcessedComponents.length > 0);
            oModel.setProperty("/isLoading", false);
            oModel.setProperty("/lastRefresh", new Date().toLocaleString());

            if (aProcessedComponents.length === 0) {
                MessageToast.show("No assembled components found for this SFC");
            } else {
                // Build visual chart
                this._buildVisualChart(aProcessedComponents, sSfc);
            }
        },

        /**
         * Build visual hierarchy chart
         */
        _buildVisualChart: function (aComponents, sSfc) {
            var oChartContainer = this.byId("visualHierarchyChart");
            if (!oChartContainer) return;

            // Clear existing content
            oChartContainer.removeAllItems();

            // Create SFC root node
            var oSfcNode = new sap.m.VBox({
                alignItems: "Center"
            });
            
            oSfcNode.addItem(new sap.m.HBox({
                justifyContent: "Center",
                items: [
                    new sap.ui.core.Icon({ src: "sap-icon://product", color: "white" }).addStyleClass("sapUiTinyMarginEnd"),
                    new sap.m.Text({ text: sSfc })
                ]
            }).addStyleClass("sfcGenealogyChartNode"));

            // Add connector line
            oSfcNode.addItem(new sap.m.VBox({}).addStyleClass("sfcGenealogyChartConnector"));

            // Create components branch
            var oComponentsBranch = new sap.m.HBox({
                wrap: "Wrap",
                justifyContent: "Center"
            }).addStyleClass("sfcGenealogyChartBranch");

            var that = this;
            aComponents.forEach(function (oComp) {
                var oCompNode = new sap.m.VBox({
                    alignItems: "Center",
                    items: [
                        new sap.m.HBox({
                            alignItems: "Center",
                            items: [
                                new sap.ui.core.Icon({ src: "sap-icon://inventory", color: "white", size: "1rem" }).addStyleClass("sapUiTinyMarginEnd"),
                                new sap.m.Text({ text: oComp.component })
                            ]
                        }),
                        new sap.m.Text({ text: "Qty: " + oComp.quantityAssembled + " " + oComp.unitOfMeasure }).addStyleClass("sfcGenealogyChartQty")
                    ]
                }).addStyleClass("sfcGenealogyChartComponent");

                // Store component data for click handler
                oCompNode.data("componentData", oComp);
                oCompNode.attachBrowserEvent("click", function () {
                    var oData = this.data("componentData");
                    if (oData) {
                        that._showComponentDetails(oData);
                    }
                });

                oComponentsBranch.addItem(oCompNode);
            });

            oSfcNode.addItem(oComponentsBranch);
            oChartContainer.addItem(oSfcNode);
        },

        /**
         * Process raw component data
         */
        _processComponents: function (aComponents) {
            var that = this;
            return aComponents.map(function (oComp, iIndex) {
                // Log component structure for debugging
                console.log("Processing component " + iIndex + ":", JSON.stringify(oComp, null, 2));
                
                // Extract assembly data fields
                var aDataFields = oComp.assemblyDataFields || oComp.dataFields || [];
                var oDataFieldsMap = {};
                
                aDataFields.forEach(function (oField) {
                    var sFieldName = oField.fieldName || oField.name || oField.attribute;
                    var sFieldValue = oField.fieldValue || oField.value;
                    if (sFieldName) {
                        oDataFieldsMap[sFieldName] = sFieldValue;
                    }
                });

                // Get operation - check multiple possible field names
                var sOperation = oComp.operationActivity || oComp.operation || oComp.assemblyOperation || "";
                var sOperationDesc = oComp.operationDescription || oComp.operationActivityDescription || "";
                
                // Get quantity - use assembledQuantity
                var nQuantity = oComp.assembledQuantity || oComp.quantityAssembled || oComp.qty || oComp.quantity || 0;
                
                // Get assembled date - use assembledDate and format it
                var sAssembledDate = oComp.assembledDate || oComp.assembledDateTime || oComp.createdDateTime || "";
                if (sAssembledDate) {
                    try {
                        var oDate = new Date(sAssembledDate);
                        sAssembledDate = oDate.toLocaleString();
                    } catch (e) {
                        // Keep original format if parsing fails
                    }
                }
                
                // Get batch number from main object (batchNumber field)
                var sBatchNumber = oComp.batchNumber || "";
                
                // Get serial number from main object (serialNumber field) or data fields
                var sSerialNumber = oComp.serialNumber || oDataFieldsMap["SERIAL_NUMBER"] || oDataFieldsMap["ERP_SERIAL_NUMBER"] || "";

                return {
                    id: iIndex + 1,
                    component: oComp.component || oComp.material || oComp.componentMaterial || "",
                    componentVersion: oComp.componentVersion || oComp.materialVersion || "",
                    description: oComp.componentDescription || oComp.description || oComp.materialDescription || "",
                    operation: sOperation,
                    operationDescription: sOperationDesc,
                    sequence: oComp.sequence || oComp.assemblySequence || iIndex + 1,
                    quantityAssembled: nQuantity,
                    unitOfMeasure: oComp.unitOfMeasure || oComp.uom || oComp.unit || "",
                    assembledDateTime: sAssembledDate,
                    assembledBy: oComp.assembledBy || oComp.userId || oComp.modifiedBy || oComp.createdBy || "",
                    bomComponent: oComp.bomComponent || oComp.bomComponentRef || "",
                    sfcAssembled: oComp.sfcAssembled || oComp.assembledSfc || oComp.childSfc || "",
                    batchNumber: sBatchNumber,
                    serialNumber: sSerialNumber,
                    vendorBatchNumber: oComp.vendorBatchNumber || oDataFieldsMap["VENDOR_BATCH"] || "",
                    storageLocation: oComp.storageLocation || oDataFieldsMap["STORAGE_LOCATION"] || "",
                    assemblyDataType: oComp.assemblyDataType || "",
                    assemblyDataFields: aDataFields,
                    assemblyDataFieldsMap: oDataFieldsMap,
                    hasDataFields: aDataFields.length > 0,
                    dataFieldsCount: aDataFields.length,
                    rawData: oComp,
                    // Status styling
                    statusState: "Success",
                    statusIcon: "sap-icon://accept"
                };
            });
        },

        /**
         * Build hierarchy structure for tree display
         */
        _buildHierarchy: function (aComponents, sSfc) {
            // Group by operation - skip "No Operation" if operation exists
            var oGroupedByOperation = {};
            
            aComponents.forEach(function (oComp) {
                var sOp = oComp.operation;
                if (!sOp) {
                    return; // Skip components without operation
                }
                if (!oGroupedByOperation[sOp]) {
                    oGroupedByOperation[sOp] = {
                        operation: sOp,
                        operationDescription: oComp.operationDescription,
                        components: [],
                        expanded: true
                    };
                }
                oGroupedByOperation[sOp].components.push(oComp);
            });

            // Build tree structure - only include items with actual content
            var aOperationNodes = [];
            
            Object.values(oGroupedByOperation).forEach(function (oGroup) {
                if (!oGroup.components || oGroup.components.length === 0) {
                    return; // Skip empty operation groups
                }
                
                var aComponentNodes = [];
                
                oGroup.components.forEach(function (oComp) {
                    if (!oComp.component) {
                        return; // Skip components without component name
                    }
                    
                    // Build data field nodes - only for non-empty values
                    var aDataFieldNodes = [];
                    if (oComp.assemblyDataFields && oComp.assemblyDataFields.length > 0) {
                        oComp.assemblyDataFields.forEach(function (oField, idx) {
                            var sFieldName = oField.fieldName || oField.name;
                            var sFieldValue = oField.fieldValue || oField.value;
                            if (sFieldName && sFieldValue) {
                                aDataFieldNodes.push({
                                    id: "field_" + oComp.id + "_" + idx,
                                    text: sFieldName + ": " + sFieldValue,
                                    icon: "sap-icon://tag",
                                    type: "dataField"
                                });
                            }
                        });
                    }
                    
                    aComponentNodes.push({
                        id: "comp_" + oComp.id,
                        text: oComp.component + (oComp.description ? " - " + oComp.description : ""),
                        icon: "sap-icon://inventory",
                        type: "component",
                        componentData: oComp,
                        expanded: false,
                        nodes: aDataFieldNodes.length > 0 ? aDataFieldNodes : undefined
                    });
                });
                
                if (aComponentNodes.length > 0) {
                    aOperationNodes.push({
                        id: "op_" + oGroup.operation,
                        text: oGroup.operation + (oGroup.operationDescription ? " - " + oGroup.operationDescription : ""),
                        icon: "sap-icon://action-settings",
                        type: "operation",
                        componentCount: aComponentNodes.length,
                        expanded: true,
                        nodes: aComponentNodes
                    });
                }
            });

            var aHierarchy = [{
                id: "root",
                text: sSfc,
                icon: "sap-icon://product",
                type: "sfc",
                expanded: true,
                nodes: aOperationNodes.length > 0 ? aOperationNodes : undefined
            }];

            return aHierarchy;
        },

        /**
         * Handle API error
         */
        _handleApiError: function (oError) {
            var oModel = this.getView().getModel("genealogy");
            oModel.setProperty("/isLoading", false);
            oModel.setProperty("/hasData", false);

            var sMessage = "Error loading genealogy data";
            if (oError && oError.message) {
                sMessage = oError.message;
            }
            
            oLogger.error("API Error:", oError);
            this.showErrorMessage(sMessage, true, true);
        },

        /**
         * Clear data when no SFC selected
         */
        _clearData: function () {
            var oModel = this.getView().getModel("genealogy");
            oModel.setProperty("/sfc", "");
            oModel.setProperty("/components", []);
            oModel.setProperty("/hierarchyData", []);
            oModel.setProperty("/totalComponents", 0);
            oModel.setProperty("/hasData", false);
            oModel.setProperty("/isLoading", false);
        },

        /**
         * Refresh button handler
         */
        onRefreshPress: function () {
            this._loadGenealogyData();
        },

        /**
         * Expand all tree nodes
         */
        onExpandAll: function () {
            var oTree = this.byId("genealogyTree");
            if (oTree) {
                oTree.expandToLevel(10);
            }
        },

        /**
         * Collapse all tree nodes
         */
        onCollapseAll: function () {
            var oTree = this.byId("genealogyTree");
            if (oTree) {
                oTree.collapseAll();
            }
        },

        /**
         * Handle tree item selection
         */
        onTreeItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("genealogy");
            if (!oContext) return;

            var oData = oContext.getObject();
            if (oData.type === "component" && oData.componentData) {
                this._showComponentDetails(oData.componentData);
            }
        },

        /**
         * Show component details in dialog
         */
        _showComponentDetails: function (oComponent) {
            var that = this;
            
            // Create details model
            var oDetailsModel = new JSONModel(oComponent);
            
            // Load and open dialog
            if (!this._oDetailsDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.dm.custom.plugin.sfcGenealogy.view.ComponentDetailsDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oDetailsDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.setModel(oDetailsModel, "details");
                    oDialog.open();
                });
            } else {
                this._oDetailsDialog.setModel(oDetailsModel, "details");
                this._oDetailsDialog.open();
            }
        },

        /**
         * Close details dialog
         */
        onCloseDetailsDialog: function () {
            if (this._oDetailsDialog) {
                this._oDetailsDialog.close();
            }
        },

        /**
         * Show data fields popover
         */
        onDataFieldsPress: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("genealogy");
            if (!oContext) return;

            var oComponent = oContext.getObject();
            var aDataFields = oComponent.assemblyDataFields || [];
            
            if (aDataFields.length === 0) {
                MessageToast.show("No data fields available");
                return;
            }

            // Create popover dynamically
            if (this._oDataFieldsPopover) {
                this._oDataFieldsPopover.destroy();
            }

            var oList = new sap.m.List({
                items: aDataFields.map(function (oField) {
                    var sFieldName = oField.fieldName || oField.name || "";
                    var sFieldValue = oField.fieldValue || oField.value || "";
                    return new sap.m.StandardListItem({
                        title: sFieldName,
                        description: sFieldValue,
                        icon: "sap-icon://tag"
                    });
                })
            });

            this._oDataFieldsPopover = new sap.m.Popover({
                title: "Assembly Data Fields",
                placement: "Auto",
                contentWidth: "300px",
                content: [oList],
                footer: new sap.m.Toolbar({
                    content: [
                        new sap.m.ToolbarSpacer(),
                        new sap.m.Button({
                            text: "Close",
                            press: function () {
                                this._oDataFieldsPopover.close();
                            }.bind(this)
                        })
                    ]
                })
            });

            this.getView().addDependent(this._oDataFieldsPopover);
            this._oDataFieldsPopover.openBy(oButton);
        },

        /**
         * Export to CSV
         */
        onExportPress: function () {
            var oModel = this.getView().getModel("genealogy");
            var aComponents = oModel.getProperty("/components");
            
            if (!aComponents || aComponents.length === 0) {
                MessageToast.show("No data to export");
                return;
            }

            var sSfc = oModel.getProperty("/sfc");
            var sCsvContent = this._generateCsv(aComponents);
            this._downloadCsv(sCsvContent, "SFC_Genealogy_" + sSfc + ".csv");
        },

        /**
         * Generate CSV content
         */
        _generateCsv: function (aComponents) {
            var aHeaders = [
                "Component", "Version", "Description", "Operation",
                "Quantity", "UoM", "Assembled DateTime", "Assembled By",
                "Batch Number", "Serial Number", "Data Fields"
            ];

            var aRows = [aHeaders.join(",")];

            aComponents.forEach(function (oComp) {
                var aDataFieldsStr = oComp.assemblyDataFields.map(function (f) {
                    return (f.fieldName || f.name) + "=" + (f.fieldValue || f.value);
                }).join("; ");

                var aRow = [
                    '"' + (oComp.component || "") + '"',
                    '"' + (oComp.componentVersion || "") + '"',
                    '"' + (oComp.description || "") + '"',
                    '"' + (oComp.operation || "") + '"',
                    oComp.quantityAssembled || 0,
                    '"' + (oComp.unitOfMeasure || "") + '"',
                    '"' + (oComp.assembledDateTime || "") + '"',
                    '"' + (oComp.assembledBy || "") + '"',
                    '"' + (oComp.batchNumber || "") + '"',
                    '"' + (oComp.serialNumber || "") + '"',
                    '"' + aDataFieldsStr + '"'
                ];
                aRows.push(aRow.join(","));
            });

            return aRows.join("\n");
        },

        /**
         * Download CSV file
         */
        _downloadCsv: function (sContent, sFilename) {
            var oBlob = new Blob([sContent], { type: "text/csv;charset=utf-8;" });
            var oLink = document.createElement("a");
            oLink.href = URL.createObjectURL(oBlob);
            oLink.download = sFilename;
            oLink.click();
            URL.revokeObjectURL(oLink.href);
            MessageToast.show("Export completed");
        },

        /**
         * Handle table row press - show component details
         */
        onComponentRowPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("genealogy");
            if (oContext) {
                var oComponent = oContext.getObject();
                this._showComponentDetails(oComponent);
            }
        },

        /**
         * Filter all views
         */
        onFilterChange: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue").toLowerCase();
            
            // Filter for both lists
            var oFilter = null;
            if (sQuery) {
                oFilter = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("component", sap.ui.model.FilterOperator.Contains, sQuery),
                        new sap.ui.model.Filter("description", sap.ui.model.FilterOperator.Contains, sQuery),
                        new sap.ui.model.Filter("batchNumber", sap.ui.model.FilterOperator.Contains, sQuery)
                    ],
                    and: false
                });
            }

            // Filter Components Table
            var oTable = this.byId("componentsTable");
            if (oTable) {
                var oTableBinding = oTable.getBinding("items");
                if (oTableBinding) {
                    oTableBinding.filter(oFilter ? [oFilter] : []);
                }
            }

            // Filter Components List (hierarchy)
            var oList = this.byId("componentsList");
            if (oList) {
                var oListBinding = oList.getBinding("items");
                if (oListBinding) {
                    oListBinding.filter(oFilter ? [oFilter] : []);
                }
            }

            // Rebuild Visual Hierarchy with filtered data
            var oModel = this.getView().getModel("genealogy");
            var aComponents = oModel.getProperty("/components") || [];
            var sSfc = oModel.getProperty("/sfc");
            
            if (sQuery) {
                // Filter components for visual chart
                var aFilteredComponents = aComponents.filter(function (oComp) {
                    var sComponent = (oComp.component || "").toLowerCase();
                    var sDescription = (oComp.description || "").toLowerCase();
                    var sBatchNumber = (oComp.batchNumber || "").toLowerCase();
                    return sComponent.indexOf(sQuery) !== -1 || 
                           sDescription.indexOf(sQuery) !== -1 || 
                           sBatchNumber.indexOf(sQuery) !== -1;
                });
                this._buildVisualChart(aFilteredComponents, sSfc);
            } else {
                this._buildVisualChart(aComponents, sSfc);
            }
        },

        /**
         * Close button handler
         */
        onClosePress: function () {
            this.closePlugin();
        }
    });
});
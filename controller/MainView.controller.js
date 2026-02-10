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

            // Build API URL
            var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/assembledComponents";
            sUrl += "?plant=" + encodeURIComponent(sPlant);
            sUrl += "&sfc=" + encodeURIComponent(sSfc);
            
            if (sOperation) {
                sUrl += "&operation=" + encodeURIComponent(sOperation);
            }

            oLogger.info("Fetching assembled components for SFC: " + sSfc);

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
            oLogger.info("API Response:", oResponse);

            var aComponents = [];
            if (oResponse && Array.isArray(oResponse)) {
                aComponents = oResponse;
            } else if (oResponse && oResponse.assembledComponents) {
                aComponents = oResponse.assembledComponents;
            } else if (oResponse && oResponse.value) {
                aComponents = oResponse.value;
            }

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
            }
        },

        /**
         * Process raw component data
         */
        _processComponents: function (aComponents) {
            var that = this;
            return aComponents.map(function (oComp, iIndex) {
                // Extract assembly data fields
                var aDataFields = oComp.assemblyDataFields || oComp.dataFields || [];
                var oDataFieldsMap = {};
                
                aDataFields.forEach(function (oField) {
                    var sFieldName = oField.fieldName || oField.name;
                    var sFieldValue = oField.fieldValue || oField.value;
                    oDataFieldsMap[sFieldName] = sFieldValue;
                });

                return {
                    id: iIndex + 1,
                    component: oComp.component || oComp.material || "",
                    componentVersion: oComp.componentVersion || oComp.materialVersion || "",
                    description: oComp.componentDescription || oComp.description || oComp.materialDescription || "",
                    operation: oComp.operation || oComp.assembledAtOperation || "",
                    operationDescription: oComp.operationDescription || "",
                    sequence: oComp.sequence || oComp.assemblySequence || iIndex + 1,
                    quantityAssembled: oComp.quantityAssembled || oComp.assembledQty || oComp.quantity || 0,
                    unitOfMeasure: oComp.unitOfMeasure || oComp.uom || "",
                    assembledDateTime: oComp.assembledDateTime || oComp.createdDateTime || "",
                    assembledBy: oComp.assembledBy || oComp.userId || "",
                    bomComponent: oComp.bomComponent || oComp.bomComponentRef || "",
                    sfcAssembled: oComp.sfcAssembled || oComp.assembledSfc || "",
                    batchNumber: oComp.batchNumber || oDataFieldsMap["BATCH"] || "",
                    serialNumber: oComp.serialNumber || oDataFieldsMap["SERIAL"] || "",
                    vendorBatchNumber: oComp.vendorBatchNumber || oDataFieldsMap["VENDOR_BATCH"] || "",
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
            // Group by operation
            var oGroupedByOperation = {};
            
            aComponents.forEach(function (oComp) {
                var sOp = oComp.operation || "No Operation";
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

            // Build tree structure
            var aHierarchy = [{
                id: "root",
                text: sSfc,
                icon: "sap-icon://product",
                type: "sfc",
                expanded: true,
                nodes: Object.values(oGroupedByOperation).map(function (oGroup) {
                    return {
                        id: "op_" + oGroup.operation,
                        text: oGroup.operation + (oGroup.operationDescription ? " - " + oGroup.operationDescription : ""),
                        icon: "sap-icon://action-settings",
                        type: "operation",
                        componentCount: oGroup.components.length,
                        expanded: true,
                        nodes: oGroup.components.map(function (oComp) {
                            return {
                                id: "comp_" + oComp.id,
                                text: oComp.component + (oComp.description ? " - " + oComp.description : ""),
                                icon: "sap-icon://inventory",
                                type: "component",
                                componentData: oComp,
                                expanded: false,
                                nodes: oComp.assemblyDataFields.map(function (oField, idx) {
                                    return {
                                        id: "field_" + oComp.id + "_" + idx,
                                        text: (oField.fieldName || oField.name) + ": " + (oField.fieldValue || oField.value || ""),
                                        icon: "sap-icon://tag",
                                        type: "dataField"
                                    };
                                })
                            };
                        })
                    };
                })
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
         * Filter tree items
         */
        onFilterChange: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue").toLowerCase();
            var oTree = this.byId("genealogyTree");
            
            if (!oTree) return;

            var aItems = oTree.getItems();
            aItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext("genealogy");
                if (oContext) {
                    var oData = oContext.getObject();
                    var sText = (oData.text || "").toLowerCase();
                    var bVisible = !sQuery || sText.indexOf(sQuery) !== -1;
                    oItem.setVisible(bVisible);
                }
            });
        },

        /**
         * Close button handler
         */
        onClosePress: function () {
            this.closePlugin();
        }
    });
});
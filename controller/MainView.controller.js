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
    "sap/base/Log",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (PluginViewController, JSONModel, MessageToast, MessageBox, Log, Filter, FilterOperator) {
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
         * Formatter for breadcrumb path display
         */
        formatBreadcrumbPath: function (aBreadcrumb) {
            if (!aBreadcrumb || aBreadcrumb.length === 0) {
                return "";
            }
            return aBreadcrumb.map(function(b) { return b.sfc; }).join(" → ");
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

            // SFC Selection model with breadcrumb navigation for multi-level genealogy
            var oSfcModel = new JSONModel({
                sfcList: [],
                selectedSfc: "",
                isLoadingSfcs: false,
                sfcSearchText: "",
                // Operation selection
                operationList: [],
                selectedOperation: "",
                isLoadingOperations: false,
                // Multi-level genealogy breadcrumb navigation
                sfcBreadcrumb: [], // Array of {sfc: "SFC123", label: "SFC123"} for navigation history
                currentLevel: 0,
                hasParentSfc: false
            });
            this.getView().setModel(oSfcModel, "sfcSelection");
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
            // Delay loading to ensure POD is fully initialized
            var that = this;
            setTimeout(function() {
                // Load SFC list on startup
                that._loadSfcList();
                // Load data if SFC is already selected
                that._loadGenealogyData();
            }, 500);
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
         * Load list of available SFCs from SAP DM API
         */
        _loadSfcList: function () {
            var oSfcModel = this.getView().getModel("sfcSelection");
            oSfcModel.setProperty("/isLoadingSfcs", true);

            try {
                var oPodController = this.getPodController();
                if (!oPodController) {
                    oLogger.warning("POD Controller not available yet");
                    oSfcModel.setProperty("/isLoadingSfcs", false);
                    return;
                }
                
                var sPlant = oPodController.getUserPlant();
                if (!sPlant) {
                    oLogger.warning("Plant not available");
                    oSfcModel.setProperty("/isLoadingSfcs", false);
                    return;
                }
                
                // Use SFC API to get list of SFCs
                // Remove trailing slash from base URL to avoid double slashes
                var sBaseUrl = this.getPublicApiRestDataSourceUri();
                if (sBaseUrl.endsWith("/")) {
                    sBaseUrl = sBaseUrl.slice(0, -1);
                }
                var sUrl = sBaseUrl + "/dmci/v2/extractor/SFC";
                sUrl += "?$filter=PLANT eq '" + encodeURIComponent(sPlant) + "'";
                sUrl += "&$select=SFC,MFG_ORDER,MATERIAL,STATUS,QUANTITY_SFC_BUILD,CREATED_AT";
                sUrl += "&size=100"; // Limit to 100 SFCs

                var that = this;
                this.ajaxGetRequest(sUrl, null,
                    function (oResponse) {
                        that._processSfcListResponse(oResponse);
                    },
                    function (oError) {
                        oLogger.error("Error loading SFC list:", oError);
                        oSfcModel.setProperty("/isLoadingSfcs", false);
                        // Silently fail - SFC list is optional
                    }
                );
            } catch (e) {
                oLogger.error("Error in _loadSfcList:", e);
                oSfcModel.setProperty("/isLoadingSfcs", false);
            }
        },

        /**
         * Process SFC list API response
         */
        _processSfcListResponse: function (oResponse) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var aSfcs = [];

            // Log response for debugging
            console.log("SFC API Response:", oResponse);

            // Handle different response structures
            if (oResponse && Array.isArray(oResponse)) {
                aSfcs = oResponse;
            } else if (oResponse && oResponse.d && oResponse.d.results && Array.isArray(oResponse.d.results)) {
                // OData v2 format: { d: { results: [...] } }
                aSfcs = oResponse.d.results;
                oLogger.info("Found SFC array in d.results (OData v2 format)");
            } else if (oResponse && oResponse.content && Array.isArray(oResponse.content)) {
                aSfcs = oResponse.content;
            } else if (oResponse && oResponse.value && Array.isArray(oResponse.value)) {
                // OData v4/DMCI Extractor response format
                aSfcs = oResponse.value;
            } else if (oResponse && typeof oResponse === 'object') {
                // Try to find arrays in the response
                for (var key in oResponse) {
                    if (Array.isArray(oResponse[key])) {
                        aSfcs = oResponse[key];
                        oLogger.info("Found SFC array in key:", key);
                        break;
                    }
                }
            }

            oLogger.info("Extracted " + aSfcs.length + " SFCs from response");

            // Process and format SFC data - handle DMCI Extractor format (uppercase fields)
            var aProcessedSfcs = aSfcs.map(function (oSfc) {
                // Parse OData date format: /Date(1754175722301+0000)/
                var sCreatedAt = oSfc.CREATED_AT || oSfc.createdDateTime || "";
                if (sCreatedAt && sCreatedAt.indexOf("/Date(") !== -1) {
                    try {
                        var match = sCreatedAt.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
                        if (match && match[1]) {
                            var timestamp = parseInt(match[1], 10);
                            var oDate = new Date(timestamp);
                            sCreatedAt = oDate.toLocaleString();
                        }
                    } catch (e) {
                        // Keep original if parsing fails
                    }
                }

                return {
                    // DMCI Extractor uses uppercase field names like SFC, PLANT, MATERIAL
                    sfc: oSfc.SFC || oSfc.sfc || oSfc.name || "",
                    status: oSfc.STATUS || oSfc.status || oSfc.sfcStatus || "",
                    statusDescription: oSfc.STATUS_DESCRIPTION || oSfc.statusDescription || "",
                    material: oSfc.MATERIAL || oSfc.material || "",
                    materialDescription: oSfc.MATERIAL_DESCRIPTION || oSfc.materialDescription || "",
                    order: oSfc.MFG_ORDER || oSfc.shopOrder || oSfc.order || "",
                    quantity: parseFloat(oSfc.QUANTITY_SFC_BUILD) || oSfc.quantity || 0,
                    createdDateTime: sCreatedAt
                };
            }).filter(function(oSfc) {
                // Filter out empty entries
                return oSfc.sfc && oSfc.sfc.length > 0;
            });

            oSfcModel.setProperty("/sfcList", aProcessedSfcs);
            oSfcModel.setProperty("/isLoadingSfcs", false);

            oLogger.info("Loaded " + aProcessedSfcs.length + " SFCs");
            
            if (aProcessedSfcs.length > 0) {
                MessageToast.show("Loaded " + aProcessedSfcs.length + " SFCs");
            }
        },

        /**
         * Handle SFC Input value help request
         */
        onSfcValueHelp: function () {
            var that = this;
            
            // Create Value Help Dialog if not exists
            if (!this._oSfcValueHelpDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.dm.custom.plugin.sfcGenealogy.view.SfcValueHelpDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oSfcValueHelpDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    that._oSfcValueHelpDialog.open();
                });
            } else {
                this._oSfcValueHelpDialog.open();
            }
        },

        /**
         * Handle SFC search in value help dialog
         */
        onSfcValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter({
                filters: [
                    new Filter("sfc", FilterOperator.Contains, sValue),
                    new Filter("material", FilterOperator.Contains, sValue),
                    new Filter("order", FilterOperator.Contains, sValue)
                ],
                and: false
            });
            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        /**
         * Handle SFC selection from value help dialog
         */
        onSfcValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSfc = oSelectedItem.getTitle();
                this._selectSfc(sSfc);
            }
            // Clear filter
            oEvent.getSource().getBinding("items").filter([]);
        },

        /**
         * Handle SFC value help close
         */
        onSfcValueHelpClose: function (oEvent) {
            oEvent.getSource().getBinding("items").filter([]);
        },

        /**
         * Handle direct SFC input change
         */
        onSfcInputChange: function (oEvent) {
            var sSfc = oEvent.getParameter("value");
            if (sSfc) {
                this._selectSfc(sSfc);
            }
        },

        /**
         * Handle SFC suggestion item selected
         */
        onSfcSuggestionSelected: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSfc = oSelectedItem.getText();
                this._selectSfc(sSfc);
            }
        },

        /**
         * Select an SFC and load its operations
         */
        _selectSfc: function (sSfc) {
            var oGenealogyModel = this.getView().getModel("genealogy");
            var oSfcModel = this.getView().getModel("sfcSelection");

            oGenealogyModel.setProperty("/sfc", sSfc);
            oSfcModel.setProperty("/selectedSfc", sSfc);
            
            // Clear previous operation selection
            oSfcModel.setProperty("/operationList", []);
            oSfcModel.setProperty("/selectedOperation", "");

            // Load operations for selected SFC
            this._loadOperationsForSfc(sSfc);
        },

        /**
         * Load operations for selected SFC from SFC_STEP_STATUS API
         */
        _loadOperationsForSfc: function (sSfc) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            oSfcModel.setProperty("/isLoadingOperations", true);

            try {
                var oPodController = this.getPodController();
                if (!oPodController) {
                    oLogger.warning("POD Controller not available");
                    oSfcModel.setProperty("/isLoadingOperations", false);
                    return;
                }
                
                var sPlant = oPodController.getUserPlant();
                if (!sPlant) {
                    oLogger.warning("Plant not available");
                    oSfcModel.setProperty("/isLoadingOperations", false);
                    return;
                }
                
                // Use SFC_STEP_STATUS API to get operations for SFC
                var sBaseUrl = this.getPublicApiRestDataSourceUri();
                if (sBaseUrl.endsWith("/")) {
                    sBaseUrl = sBaseUrl.slice(0, -1);
                }
                
                var sUrl = sBaseUrl + "/dmci/v2/extractor/SFC_STEP_STATUS";
                sUrl += "?$filter=PLANT eq '" + encodeURIComponent(sPlant) + "' and SFC eq '" + encodeURIComponent(sSfc) + "'";

                oLogger.info("Loading operations for SFC:", sSfc, "URL:", sUrl);

                var that = this;
                this.ajaxGetRequest(sUrl, null,
                    function (oResponse) {
                        that._processOperationListResponse(oResponse);
                    },
                    function (oError) {
                        oLogger.error("Error loading operations:", oError);
                        oSfcModel.setProperty("/isLoadingOperations", false);
                        MessageToast.show("Error loading operations for SFC");
                    }
                );
            } catch (e) {
                oLogger.error("Error in _loadOperationsForSfc:", e);
                oSfcModel.setProperty("/isLoadingOperations", false);
            }
        },

        /**
         * Process operation list API response
         */
        _processOperationListResponse: function (oResponse) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var aOperations = [];

            // Log response for debugging
            console.log("Operations API Response:", oResponse);

            // Handle OData v2 format: { d: { results: [...] } }
            if (oResponse && oResponse.d && oResponse.d.results && Array.isArray(oResponse.d.results)) {
                aOperations = oResponse.d.results;
                oLogger.info("Found operations in d.results (OData v2 format)");
            } else if (oResponse && Array.isArray(oResponse)) {
                aOperations = oResponse;
            } else if (oResponse && oResponse.value && Array.isArray(oResponse.value)) {
                aOperations = oResponse.value;
            }

            oLogger.info("Extracted " + aOperations.length + " step status records from response");

            // Process and format operation data - using OPERATION_ACTIVITY field from SFC_STEP_STATUS
            var aProcessedOperations = aOperations.map(function (oOp) {
                return {
                    // OPERATION_ACTIVITY is the operation name from SFC_STEP_STATUS
                    operation: oOp.OPERATION_ACTIVITY || oOp.operation || "",
                    stepDescription: oOp.ROUTING_STEP || "", // Use ROUTING_STEP as description
                    routingStep: oOp.ROUTING_STEP || "",
                    stepId: oOp.ROUTING_STEP_ID || oOp.stepId || "",
                    resource: oOp.RESOURCE || "",
                    workcenter: oOp.WORKCENTER || "",
                    status: oOp.COMPLETED_AT ? "COMPLETED" : "IN_PROGRESS"
                };
            }).filter(function(oOp) {
                // Filter out empty entries
                return oOp.operation && oOp.operation.length > 0;
            });

            // Remove duplicates based on operation name
            var aUniqueOperations = [];
            var oSeen = {};
            aProcessedOperations.forEach(function(oOp) {
                if (!oSeen[oOp.operation]) {
                    oSeen[oOp.operation] = true;
                    aUniqueOperations.push(oOp);
                }
            });

            // Sort by routing step
            aUniqueOperations.sort(function(a, b) {
                return (a.routingStep || "").localeCompare(b.routingStep || "");
            });

            // Add "All Operations" option at the beginning
            var aOperationsWithAll = [{
                operation: "ALL",
                stepDescription: "All Operations",
                routingStep: "",
                isAllOption: true
            }].concat(aUniqueOperations);

            oSfcModel.setProperty("/operationList", aOperationsWithAll);
            oSfcModel.setProperty("/isLoadingOperations", false);

            oLogger.info("Loaded " + aUniqueOperations.length + " unique operations (plus ALL option)");

            // Auto-select "ALL" as default
            oSfcModel.setProperty("/selectedOperation", "ALL");
            oLogger.info("Auto-selected 'ALL' operations as default");
            
            // Load genealogy data with ALL operations
            this._loadGenealogyData();
            
            MessageToast.show("Loaded " + aUniqueOperations.length + " operations, showing ALL");
        },

        /**
         * Handle operation select change
         */
        onOperationSelectChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sOperation = oSelectedItem.getKey();
                var oSfcModel = this.getView().getModel("sfcSelection");
                oSfcModel.setProperty("/selectedOperation", sOperation);
                
                oLogger.info("Operation changed to:", sOperation);
                
                // Reload genealogy data with new operation
                this._loadGenealogyData();
            }
        },

        /**
         * Refresh operations list
         */
        onRefreshOperations: function () {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var sSfc = oSfcModel.getProperty("/selectedSfc");
            
            if (sSfc) {
                this._loadOperationsForSfc(sSfc);
                MessageToast.show("Refreshing operations...");
            } else {
                MessageToast.show("Please select an SFC first");
            }
        },

        /**
         * Refresh SFC list
         */
        onRefreshSfcList: function () {
            this._loadSfcList();
            MessageToast.show("Refreshing SFC list...");
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
            // First check for manually selected SFC, then POD selection
            var oSfcModel = this.getView().getModel("sfcSelection");
            var sSfc = oSfcModel.getProperty("/selectedSfc") || this._getCurrentSfc();
            
            if (!sSfc) {
                this._clearData();
                return;
            }

            var oModel = this.getView().getModel("genealogy");
            oModel.setProperty("/isLoading", true);
            oModel.setProperty("/sfc", sSfc);

            try {
                var oPodController = this.getPodController();
                if (!oPodController) {
                    oModel.setProperty("/isLoading", false);
                    oLogger.warning("POD Controller not available");
                    return;
                }
                
                var sPlant = oPodController.getUserPlant();
                if (!sPlant) {
                    oModel.setProperty("/isLoading", false);
                    oLogger.warning("Plant not available");
                    return;
                }
                
                // First check manually selected operation from dropdown, then POD selection
                var sOperation = oSfcModel.getProperty("/selectedOperation") || this._getCurrentOperation();

                // If no operation, show message and return
                if (!sOperation) {
                    oModel.setProperty("/isLoading", false);
                    oModel.setProperty("/hasData", false);
                    oLogger.info("No operation selected yet");
                    return;
                }

                // Check if "ALL" is selected - load data for all operations
                if (sOperation === "ALL") {
                    this._loadAllOperationsData(sSfc, sPlant);
                    return;
                }

                // Build API URL with required operationActivity parameter
                var sBaseUrl = this.getPublicApiRestDataSourceUri();
                if (sBaseUrl.endsWith("/")) {
                    sBaseUrl = sBaseUrl.slice(0, -1);
                }
                var sUrl = sBaseUrl + "/assembly/v1/assembledComponents";
                sUrl += "?plant=" + encodeURIComponent(sPlant);
                sUrl += "&sfc=" + encodeURIComponent(sSfc);
                sUrl += "&operationActivity=" + encodeURIComponent(sOperation);

                oLogger.info("Fetching assembled components for SFC: " + sSfc + ", Operation: " + sOperation);

                var that = this;
                this.ajaxGetRequest(sUrl, null,
                    function (oResponse) {
                        that._processApiResponse(oResponse, sSfc);
                    },
                    function (oError) {
                        that._handleApiError(oError);
                    }
                );
            } catch (e) {
                oLogger.error("Error in _loadGenealogyData:", e);
                oModel.setProperty("/isLoading", false);
            }
        },

        /**
         * Load genealogy data for ALL operations
         * Calls API for each operation and merges results
         */
        _loadAllOperationsData: function (sSfc, sPlant) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var oModel = this.getView().getModel("genealogy");
            var aOperationList = oSfcModel.getProperty("/operationList") || [];
            
            // Filter out the "ALL" option to get actual operations
            var aActualOperations = aOperationList.filter(function(oOp) {
                return oOp.operation !== "ALL" && oOp.operation;
            });

            if (aActualOperations.length === 0) {
                oModel.setProperty("/isLoading", false);
                oModel.setProperty("/hasData", false);
                MessageToast.show("No operations available to load");
                return;
            }

            oLogger.info("Loading data for ALL " + aActualOperations.length + " operations");

            var sBaseUrl = this.getPublicApiRestDataSourceUri();
            if (sBaseUrl.endsWith("/")) {
                sBaseUrl = sBaseUrl.slice(0, -1);
            }

            var that = this;
            var aAllComponents = [];
            var nCompleted = 0;
            var nTotal = aActualOperations.length;
            var nErrors = 0;

            // Call API for each operation
            aActualOperations.forEach(function(oOp) {
                var sUrl = sBaseUrl + "/assembly/v1/assembledComponents";
                sUrl += "?plant=" + encodeURIComponent(sPlant);
                sUrl += "&sfc=" + encodeURIComponent(sSfc);
                sUrl += "&operationActivity=" + encodeURIComponent(oOp.operation);

                oLogger.info("Fetching for operation: " + oOp.operation);

                that.ajaxGetRequest(sUrl, null,
                    function (oResponse) {
                        // Extract components from response
                        var aComponents = that._extractComponentsFromResponse(oResponse);
                        oLogger.info("Got " + aComponents.length + " components from " + oOp.operation);
                        
                        // Add to combined list
                        aAllComponents = aAllComponents.concat(aComponents);
                        
                        nCompleted++;
                        that._checkAllOperationsComplete(nCompleted, nTotal, nErrors, aAllComponents, sSfc);
                    },
                    function (oError) {
                        oLogger.warning("Error loading data for operation " + oOp.operation + ":", oError);
                        nErrors++;
                        nCompleted++;
                        that._checkAllOperationsComplete(nCompleted, nTotal, nErrors, aAllComponents, sSfc);
                    }
                );
            });
        },

        /**
         * Extract components array from API response
         */
        _extractComponentsFromResponse: function (oResponse) {
            var aComponents = [];
            
            if (oResponse && Array.isArray(oResponse)) {
                aComponents = oResponse;
            } else if (oResponse && oResponse.assembledComponents && Array.isArray(oResponse.assembledComponents)) {
                aComponents = oResponse.assembledComponents;
            } else if (oResponse && oResponse.value && Array.isArray(oResponse.value)) {
                aComponents = oResponse.value;
            } else if (oResponse && typeof oResponse === 'object') {
                for (var key in oResponse) {
                    if (Array.isArray(oResponse[key])) {
                        aComponents = oResponse[key];
                        break;
                    }
                }
            }
            
            return aComponents;
        },

        /**
         * Check if all operation API calls are complete and process results
         */
        _checkAllOperationsComplete: function (nCompleted, nTotal, nErrors, aAllComponents, sSfc) {
            if (nCompleted < nTotal) {
                return; // Still waiting for more responses
            }

            oLogger.info("All operations complete. Total components: " + aAllComponents.length + ", Errors: " + nErrors);

            var oModel = this.getView().getModel("genealogy");

            // Process all collected components
            var aProcessedComponents = this._processComponents(aAllComponents);
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
                this._buildVisualChart(aProcessedComponents, sSfc);
                MessageToast.show("Loaded " + aProcessedComponents.length + " components from all operations");
            }
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

                // Get child SFC (assembled SFC)
                var sChildSfc = oComp.sfcAssembled || oComp.assembledSfc || oComp.childSfc || "";
                var bHasChildSfc = sChildSfc && sChildSfc.length > 0;

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
                    sfcAssembled: sChildSfc,
                    hasChildSfc: bHasChildSfc, // Flag for drill-down capability
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
                oFilter = new Filter({
                    filters: [
                        new Filter("component", FilterOperator.Contains, sQuery),
                        new Filter("description", FilterOperator.Contains, sQuery),
                        new Filter("batchNumber", FilterOperator.Contains, sQuery)
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
        },

        // ==================== Multi-Level Genealogy (Drill-Down) ====================

        /**
         * Navigate to child SFC (drill-down)
         * Saves current SFC in breadcrumb and loads child SFC genealogy
         */
        onDrillDownToChildSfc: function (oEvent) {
            var oSource = oEvent.getSource();
            var sChildSfc = oSource.data("childSfc");
            
            if (!sChildSfc) {
                MessageToast.show("No child SFC available");
                return;
            }

            this._drillDownToSfc(sChildSfc);
        },

        /**
         * Drill down to a specific SFC
         */
        _drillDownToSfc: function (sChildSfc) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var sCurrentSfc = oSfcModel.getProperty("/selectedSfc");
            var aBreadcrumb = oSfcModel.getProperty("/sfcBreadcrumb") || [];

            // Add current SFC to breadcrumb
            if (sCurrentSfc) {
                aBreadcrumb.push({
                    sfc: sCurrentSfc,
                    label: sCurrentSfc
                });
            }

            // Update breadcrumb and navigate to child SFC
            oSfcModel.setProperty("/sfcBreadcrumb", aBreadcrumb);
            oSfcModel.setProperty("/currentLevel", aBreadcrumb.length);
            oSfcModel.setProperty("/hasParentSfc", true);

            oLogger.info("Drilling down from " + sCurrentSfc + " to child SFC: " + sChildSfc);
            oLogger.info("Breadcrumb:", aBreadcrumb.map(function(b) { return b.sfc; }).join(" > "));

            // Load child SFC data
            this._selectSfcWithoutClearingBreadcrumb(sChildSfc);

            MessageToast.show("Viewing child SFC: " + sChildSfc);
        },

        /**
         * Select SFC without clearing breadcrumb (for drill-down navigation)
         */
        _selectSfcWithoutClearingBreadcrumb: function (sSfc) {
            var oGenealogyModel = this.getView().getModel("genealogy");
            var oSfcModel = this.getView().getModel("sfcSelection");

            oGenealogyModel.setProperty("/sfc", sSfc);
            oSfcModel.setProperty("/selectedSfc", sSfc);
            
            // Clear previous operation selection
            oSfcModel.setProperty("/operationList", []);
            oSfcModel.setProperty("/selectedOperation", "");

            // Load operations for selected SFC
            this._loadOperationsForSfc(sSfc);
        },

        /**
         * Navigate back to parent SFC in breadcrumb
         */
        onNavigateToParentSfc: function () {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var aBreadcrumb = oSfcModel.getProperty("/sfcBreadcrumb") || [];

            if (aBreadcrumb.length === 0) {
                MessageToast.show("No parent SFC to navigate to");
                return;
            }

            // Pop the last SFC from breadcrumb
            var oParent = aBreadcrumb.pop();
            var sParentSfc = oParent.sfc;

            // Update breadcrumb state
            oSfcModel.setProperty("/sfcBreadcrumb", aBreadcrumb);
            oSfcModel.setProperty("/currentLevel", aBreadcrumb.length);
            oSfcModel.setProperty("/hasParentSfc", aBreadcrumb.length > 0);

            oLogger.info("Navigating back to parent SFC: " + sParentSfc);

            // Load parent SFC data
            this._selectSfcWithoutClearingBreadcrumb(sParentSfc);

            MessageToast.show("Returned to: " + sParentSfc);
        },

        /**
         * Navigate to specific SFC in breadcrumb (clicking a breadcrumb item)
         */
        onBreadcrumbSelect: function (oEvent) {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var aBreadcrumb = oSfcModel.getProperty("/sfcBreadcrumb") || [];
            
            // Get the index of the clicked breadcrumb item
            var oSource = oEvent.getSource();
            var iIndex = oSource.data("breadcrumbIndex");
            
            if (iIndex === undefined || iIndex === null) {
                return;
            }

            iIndex = parseInt(iIndex, 10);

            // Get the target SFC
            var sTargetSfc = aBreadcrumb[iIndex].sfc;

            // Trim breadcrumb to the clicked level
            aBreadcrumb = aBreadcrumb.slice(0, iIndex);

            // Update breadcrumb state
            oSfcModel.setProperty("/sfcBreadcrumb", aBreadcrumb);
            oSfcModel.setProperty("/currentLevel", aBreadcrumb.length);
            oSfcModel.setProperty("/hasParentSfc", aBreadcrumb.length > 0);

            oLogger.info("Navigating to breadcrumb SFC: " + sTargetSfc);

            // Load target SFC data
            this._selectSfcWithoutClearingBreadcrumb(sTargetSfc);
        },

        /**
         * Clear breadcrumb when selecting a new SFC from dropdown
         */
        _clearBreadcrumb: function () {
            var oSfcModel = this.getView().getModel("sfcSelection");
            oSfcModel.setProperty("/sfcBreadcrumb", []);
            oSfcModel.setProperty("/currentLevel", 0);
            oSfcModel.setProperty("/hasParentSfc", false);
        },

        /**
         * Get breadcrumb display text
         */
        getBreadcrumbText: function () {
            var oSfcModel = this.getView().getModel("sfcSelection");
            var aBreadcrumb = oSfcModel.getProperty("/sfcBreadcrumb") || [];
            var sCurrentSfc = oSfcModel.getProperty("/selectedSfc") || "";

            if (aBreadcrumb.length === 0) {
                return sCurrentSfc;
            }

            var aPath = aBreadcrumb.map(function(b) { return b.sfc; });
            aPath.push(sCurrentSfc);
            return aPath.join(" → ");
        },

        /**
         * Handle drill-down button press in Component Details Dialog
         */
        onDrillDownFromDialog: function () {
            if (this._oDetailsDialog) {
                var oDetailsModel = this._oDetailsDialog.getModel("details");
                var sChildSfc = oDetailsModel.getProperty("/sfcAssembled");
                
                if (sChildSfc) {
                    this._oDetailsDialog.close();
                    this._drillDownToSfc(sChildSfc);
                } else {
                    MessageToast.show("No child SFC available");
                }
            }
        }
    });
});

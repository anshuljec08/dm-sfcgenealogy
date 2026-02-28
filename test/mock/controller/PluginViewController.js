/**
 * Mock POD Foundation PluginViewController
 * 
 * This mock simulates the SAP DM POD Foundation controller
 * for local testing purposes.
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    // Mock SFC data for testing
    var MOCK_SFC_LIST = [
        { sfc: "SFC001", status: "ACTIVE", material: "MAT001", materialDescription: "Pump Assembly", shopOrder: "ORD001", quantity: 10 },
        { sfc: "SFC002", status: "ACTIVE", material: "MAT002", materialDescription: "Motor Unit", shopOrder: "ORD001", quantity: 5 },
        { sfc: "SFC003", status: "IN_QUEUE", material: "MAT001", materialDescription: "Pump Assembly", shopOrder: "ORD002", quantity: 8 },
        { sfc: "SFC004", status: "ACTIVE", material: "MAT003", materialDescription: "Control Panel", shopOrder: "ORD003", quantity: 3 },
        { sfc: "SFC005", status: "DONE", material: "MAT002", materialDescription: "Motor Unit", shopOrder: "ORD002", quantity: 12 },
        { sfc: "SFC006", status: "ACTIVE", material: "MAT004", materialDescription: "Sensor Module", shopOrder: "ORD004", quantity: 20 },
        { sfc: "SFC007", status: "IN_QUEUE", material: "MAT005", materialDescription: "Valve Assembly", shopOrder: "ORD005", quantity: 15 }
    ];

    // Mock assembled components data
    var MOCK_COMPONENTS = {
        "SFC001": [
            {
                component: "COMP001",
                componentVersion: "A",
                componentDescription: "Impeller Blade",
                operationActivity: "OP010",
                assembledQuantity: 1,
                unitOfMeasure: "EA",
                batchNumber: "BATCH001",
                serialNumber: "SN001",
                assembledDate: "2026-02-28T10:30:00Z",
                assembledBy: "USER01",
                assemblyDataFields: [
                    { fieldName: "TORQUE", fieldValue: "25 Nm" },
                    { fieldName: "TEMPERATURE", fieldValue: "22°C" }
                ]
            },
            {
                component: "COMP002",
                componentVersion: "B",
                componentDescription: "Shaft Coupling",
                operationActivity: "OP010",
                assembledQuantity: 2,
                unitOfMeasure: "EA",
                batchNumber: "BATCH002",
                serialNumber: "",
                assembledDate: "2026-02-28T11:00:00Z",
                assembledBy: "USER01",
                assemblyDataFields: []
            },
            {
                component: "COMP003",
                componentVersion: "A",
                componentDescription: "Bearing Set",
                operationActivity: "OP020",
                assembledQuantity: 4,
                unitOfMeasure: "EA",
                batchNumber: "BATCH003",
                serialNumber: "",
                assembledDate: "2026-02-28T11:30:00Z",
                assembledBy: "USER02",
                assemblyDataFields: [
                    { fieldName: "LUBRICATION", fieldValue: "Applied" }
                ]
            }
        ],
        "SFC002": [
            {
                component: "MOTOR001",
                componentVersion: "C",
                componentDescription: "Electric Motor 5kW",
                operationActivity: "OP010",
                assembledQuantity: 1,
                unitOfMeasure: "EA",
                batchNumber: "MBATCH001",
                serialNumber: "MOT-SN-001",
                assembledDate: "2026-02-27T14:00:00Z",
                assembledBy: "USER03",
                assemblyDataFields: [
                    { fieldName: "VOLTAGE_TEST", fieldValue: "PASS" },
                    { fieldName: "CURRENT_DRAW", fieldValue: "12.5A" }
                ]
            }
        ],
        "SFC004": [
            {
                component: "PCB001",
                componentVersion: "D",
                componentDescription: "Main Circuit Board",
                operationActivity: "OP010",
                assembledQuantity: 1,
                unitOfMeasure: "EA",
                batchNumber: "PCB-2026-001",
                serialNumber: "PCB-SN-12345",
                assembledDate: "2026-02-28T09:00:00Z",
                assembledBy: "USER04",
                assemblyDataFields: [
                    { fieldName: "FIRMWARE_VER", fieldValue: "2.1.0" },
                    { fieldName: "TEST_RESULT", fieldValue: "PASS" }
                ]
            },
            {
                component: "DISP001",
                componentVersion: "A",
                componentDescription: "LCD Display 7inch",
                operationActivity: "OP020",
                assembledQuantity: 1,
                unitOfMeasure: "EA",
                batchNumber: "DISP-2026-045",
                serialNumber: "DISP-SN-67890",
                assembledDate: "2026-02-28T09:30:00Z",
                assembledBy: "USER04",
                assemblyDataFields: []
            }
        ]
    };

    return Controller.extend("sap.dm.dme.podfoundation.controller.PluginViewController", {

        /**
         * Mock POD Controller
         */
        _mockPodController: {
            getUserPlant: function() {
                return "PLANT01";
            }
        },

        /**
         * Mock POD Selection Model
         */
        _mockPodSelectionModel: {
            _selectedSfc: null,
            _selectedOperation: "OP010",
            
            getSelections: function() {
                var that = this;
                if (!this._selectedSfc) {
                    return [];
                }
                return [{
                    getSfc: function() {
                        return {
                            getSfc: function() {
                                return that._selectedSfc;
                            }
                        };
                    },
                    getInput: function() {
                        return that._selectedSfc;
                    }
                }];
            },
            getOperations: function() {
                return [{ operation: this._selectedOperation }];
            },
            setSelectedSfc: function(sSfc) {
                this._selectedSfc = sSfc;
            },
            setSelectedOperation: function(sOp) {
                this._selectedOperation = sOp;
            }
        },

        /**
         * Get POD Controller
         */
        getPodController: function() {
            return this._mockPodController;
        },

        /**
         * Get POD Selection Model
         */
        getPodSelectionModel: function() {
            return this._mockPodSelectionModel;
        },

        /**
         * Get Public API REST Data Source URI
         */
        getPublicApiRestDataSourceUri: function() {
            return "/mock-api";
        },

        /**
         * Mock AJAX GET Request
         */
        ajaxGetRequest: function(sUrl, oParams, fnSuccess, fnError) {
            console.log("Mock API Request:", sUrl);
            
            // Simulate network delay
            setTimeout(function() {
                try {
                    // Parse the URL to determine what data to return
                    if (sUrl.indexOf("/sfc/v1/sfcs") !== -1) {
                        // Return mock SFC list
                        fnSuccess({ content: MOCK_SFC_LIST });
                    } else if (sUrl.indexOf("/assembly/v1/assembledComponents") !== -1) {
                        // Extract SFC from URL
                        var sfcMatch = sUrl.match(/sfc=([^&]+)/);
                        var sSfc = sfcMatch ? decodeURIComponent(sfcMatch[1]) : null;
                        
                        console.log("Fetching components for SFC:", sSfc);
                        
                        if (sSfc && MOCK_COMPONENTS[sSfc]) {
                            fnSuccess(MOCK_COMPONENTS[sSfc]);
                        } else {
                            fnSuccess([]);
                        }
                    } else {
                        fnError({ message: "Unknown API endpoint" });
                    }
                } catch (e) {
                    fnError({ message: e.message });
                }
            }, 500);
        },

        /**
         * Subscribe to POD events (mock - does nothing)
         */
        subscribe: function(sEventId, fnHandler, oContext) {
            console.log("Mock subscribe to:", sEventId);
        },

        /**
         * Unsubscribe from POD events (mock - does nothing)
         */
        unsubscribe: function(sEventId, fnHandler, oContext) {
            console.log("Mock unsubscribe from:", sEventId);
        },

        /**
         * Check if event was fired by this plugin
         */
        isEventFiredByThisPlugin: function(oData) {
            return false;
        },

        /**
         * Show error message
         */
        showErrorMessage: function(sMessage, bShowAsToast, bShowAsDialog) {
            if (bShowAsToast) {
                sap.m.MessageToast.show(sMessage);
            }
            if (bShowAsDialog) {
                sap.m.MessageBox.error(sMessage);
            }
            console.error("Plugin Error:", sMessage);
        },

        /**
         * Close plugin (mock - does nothing)
         */
        closePlugin: function() {
            console.log("Mock close plugin");
            sap.m.MessageToast.show("Close plugin called (mock)");
        }
    });
});
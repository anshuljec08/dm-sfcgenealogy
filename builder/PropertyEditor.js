/**
 * Property Editor for SFC Genealogy Plugin
 * 
 * Configures plugin properties in POD Designer
 * 
 * @namespace sap.dm.custom.plugin.sfcGenealogy.builder
 */
sap.ui.define([
    "sap/dm/dme/podfoundation/control/PropertyEditor"
], function (PropertyEditor) {
    "use strict";

    return PropertyEditor.extend("sap.dm.custom.plugin.sfcGenealogy.builder.PropertyEditor", {

        /**
         * Constructor
         */
        constructor: function (sId, mSettings) {
            PropertyEditor.apply(this, arguments);
            
            // Set i18n key prefix for property labels
            this.setI18nKeyPrefix("sfcGenealogy.");
            
            // Set resource bundle for POD Designer labels
            this.setResourceBundleName("sap.dm.custom.plugin.sfcGenealogy.i18n.builder");
            
            // Set resource bundle for plugin runtime labels
            this.setPluginResourceBundleName("sap.dm.custom.plugin.sfcGenealogy.i18n.i18n");
        },

        /**
         * Add property editor controls
         */
        addPropertyEditorContent: function (oPropertyFormContainer) {
            var oData = this.getPropertyData();
            
            // Title
            this.addInputField(oPropertyFormContainer, "title", oData);
            
            // Show/Hide Close Button
            this.addSwitch(oPropertyFormContainer, "closeButtonVisible", oData);
            
            // Auto Refresh
            this.addSwitch(oPropertyFormContainer, "autoRefresh", oData);
            
            // Show Tree View
            this.addSwitch(oPropertyFormContainer, "showTreeView", oData);
            
            // Show Summary Table
            this.addSwitch(oPropertyFormContainer, "showSummaryTable", oData);
            
            // Expand Tree by Default
            this.addSwitch(oPropertyFormContainer, "expandTreeByDefault", oData);
        },

        /**
         * Default property values
         */
        getDefaultPropertyData: function () {
            return {
                "title": "SFC Genealogy",
                "closeButtonVisible": false,
                "autoRefresh": true,
                "showTreeView": true,
                "showSummaryTable": true,
                "expandTreeByDefault": true
            };
        }
    });
});
/**
 * SFC Genealogy Plugin Component
 * 
 * Displays assembled components hierarchy for an SFC
 * using the SAP DM Assembly API.
 * 
 * @namespace sap.dm.custom.plugin.sfcGenealogy
 */
sap.ui.define([
    "sap/dm/dme/podfoundation/component/production/ProductionUIComponent",
    "sap/ui/Device"
], function (ProductionUIComponent, Device) {
    "use strict";

    /**
     * SFC Genealogy Plugin Component
     * @extends sap.dm.dme.podfoundation.component.production.ProductionUIComponent
     */
    return ProductionUIComponent.extend("sap.dm.custom.plugin.sfcGenealogy.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * Initialize the component
         */
        init: function () {
            ProductionUIComponent.prototype.init.apply(this, arguments);
        },

        /**
         * Cleanup when component is destroyed
         */
        destroy: function () {
            ProductionUIComponent.prototype.destroy.apply(this, arguments);
        }
    });
});
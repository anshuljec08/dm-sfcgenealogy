# SFC Genealogy Plugin

A beautiful, modern POD plugin for SAP Digital Manufacturing that displays the **complete genealogy of assembled components** for a given SFC, including all assembly data fields.

![SFC Genealogy](https://img.shields.io/badge/SAP-Digital%20Manufacturing-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### Hierarchical Genealogy View
- **Tree View** showing SFC → Operations → Components → Data Fields hierarchy
- **Color-coded levels** for easy visual distinction
- Expandable/collapsible nodes

### Component Summary Table
- Complete list of assembled components
- Component, Description, Operation, Quantity, UoM
- Batch Number, Serial Number
- Assembly Data Fields count
- Assembled Date/Time

### Component Details Dialog
- **General Information**: Component, Version, Description, Operation, Sequence, Quantity
- **Traceability**: Batch Number, Serial Number, Vendor Batch, SFC Assembled
- **Assembly Data Fields**: Complete list of custom data fields with values

### Modern UI Features
- 🎨 Beautiful gradient styling with SAP Fiori design
- 📱 Responsive design for all screen sizes
- 🔍 Search/filter functionality
- 📊 Export to CSV
- 🔄 Auto-refresh on SFC selection change

## 📁 Project Structure

```
sfcGenealogy/
├── Component.js                    # Main component
├── manifest.json                   # Application manifest
├── builder/
│   └── PropertyEditor.js           # POD Designer configuration
├── controller/
│   └── MainView.controller.js      # Main controller with API calls
├── view/
│   ├── MainView.view.xml           # Main view with Tree & Table
│   └── ComponentDetailsDialog.fragment.xml  # Details popup
├── css/
│   └── style.css                   # Custom styling
├── designer/
│   └── components.json             # Plugin registration
├── i18n/
│   ├── i18n.properties             # Runtime translations
│   ├── i18n_en.properties
│   ├── builder.properties          # POD Designer translations
│   └── builder_en.properties
└── README.md
```

## 🔧 Configuration

### designer/components.json

The plugin is configured for **CUSTOMPOD1** at **plant 1710**:

```json
{
    "components": [
        {
            "id": "sfcGenealogyPlugin",
            "type": "VIEW_PLUGIN",
            "name": "sap.dm.custom.plugin.sfcGenealogy",
            "supportedPodTypes": ["WORK_CENTER", "OPERATION", "ORDER", "OTHER", "MONITOR"]
        }
    ]
}
```

## 🔌 API Integration

The plugin calls the SAP DM Assembly API:

**Endpoint:** `GET /assembly/v1/assembledComponents`

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| plant | Yes | Plant code |
| sfc | Yes | SFC number |
| operation | No | Filter by operation |

**API Documentation:** [SAP API Business Hub - Assembly API](https://api.sap.com/api/sapdme_assembly/path/get_assembledComponents)

## 🚀 Deployment

### Step 1: Prepare ZIP

Rename the folder to `sfcGenealogy` to match the namespace.

### Step 2: ZIP Structure

```
sfcGenealogy.zip
└── sfcGenealogy/
    ├── Component.js
    ├── manifest.json
    ├── builder/
    ├── controller/
    ├── view/
    ├── css/
    ├── designer/
    └── i18n/
```

### Step 3: Upload

1. Go to **POD Designer** > **Custom Plugins**
2. Click **Upload** and select the ZIP file
3. Add the plugin to your POD layout

## 🎨 Visual Styling

### Color Palette

| Level | Color | Hex Code |
|-------|-------|----------|
| SFC (Root) | Blue | `#0854a0` |
| Operation | Teal | `#107e7d` |
| Component | Green | `#27ae60` |
| Data Field | Purple | `#9b59b6` |

### Tree View Indicators
- **Blue left border** - SFC root node
- **Teal left border** - Operation nodes
- **Green left border** - Component nodes
- **Purple left border** - Data field nodes

## 📋 Data Fields Displayed

The plugin extracts and displays these fields from each component:

| Field | Source |
|-------|--------|
| Component | `component` / `material` |
| Version | `componentVersion` / `materialVersion` |
| Description | `componentDescription` / `description` |
| Operation | `operation` / `assembledAtOperation` |
| Quantity | `quantityAssembled` / `assembledQty` |
| Unit of Measure | `unitOfMeasure` / `uom` |
| Batch Number | `batchNumber` / assemblyDataFields["BATCH"] |
| Serial Number | `serialNumber` / assemblyDataFields["SERIAL"] |
| Assembled DateTime | `assembledDateTime` / `createdDateTime` |
| Assembled By | `assembledBy` / `userId` |

### Assembly Data Fields

All custom assembly data fields are displayed with:
- Field Name
- Field Value

## 🛠️ Technical Details

### Namespace
```
sap.dm.custom.plugin.sfcGenealogy
```

### Base Classes
| File | Extends |
|------|---------|
| Component.js | `ProductionUIComponent` |
| MainView.controller.js | `PluginViewController` |
| PropertyEditor.js | `PropertyEditor` |

### Events Subscribed
- `PodSelectionChangeEvent` - Refresh on SFC change
- `WorklistSelectEvent` - Refresh on worklist selection
- `OperationListSelectEvent` - Refresh on operation change

### Dependencies
- `sap.ui.core`
- `sap.m`
- `sap.f` (Cards)
- `sap.ui.layout`

## 🐛 Debugging

View console logs for debugging:

```javascript
// In MainView.controller.js
var oLogger = Log.getLogger("sfcGenealogy", Log.Level.INFO);
```

Console output prefix: `sfcGenealogy`

## 📝 License

MIT License - Feel free to use and modify.

## 👤 Author

SAP Digital Manufacturing Custom Plugin Development

---

*Last Updated: February 2026*
# SFC Genealogy Plugin for SAP Digital Manufacturing

A custom POD plugin for SAP Digital Manufacturing that displays the genealogy (assembled components) of a Shop Floor Control (SFC).

<img width="1512" alt="SFC Genealogy Plugin" src="https://github.com/user-attachments/assets/e068f0e4-bad9-48e3-a82e-5777bd421016" />

## Features

- **SFC Selection Dropdown**: Search and select SFCs with value help dialog
- **Operation Selection**: 
  - **"All Operations" mode (default)** - Shows assembled components from ALL operations combined
  - Select specific operation to filter components by operation
- **Component Hierarchy View**: Collapsible list showing all assembled components with key information
- **Components Summary Table**: Detailed table view with all component data
- **Visual Hierarchy Chart**: Graphical tree visualization of SFC and its components
- **Data Fields Popover**: Click to view assembly data fields for each component
- **Component Details Dialog**: Full details dialog when clicking on a component
- **Search/Filter**: Filter all views by component name, description, or batch number
- **Export to CSV**: Download component data as CSV file
- **Responsive Design**: Works on desktop and tablet devices

## What's New

### v2.0 - All Operations Feature
- Added "ALL - All Operations" as the default selection when an SFC is selected
- When "ALL" is selected, the plugin fetches components from all operations and merges them
- Users can still filter by a specific operation if needed

## Installation

1. Download or clone this repository
2. Zip all files (not the folder, just the contents)
3. Upload to SAP Digital Manufacturing POD Designer as a custom plugin

<img width="1437" height="706" alt="image" src="https://github.com/user-attachments/assets/f4e31680-ea76-4a1d-a7a8-cc82b13409f7" />

## Usage

1. Add the plugin to a POD layout in POD Designer
2. Select an SFC from the dropdown (with search/value help)
3. Operations are loaded automatically from the SFC Step Status
4. **"ALL - All Operations"** is selected by default to show all components
5. Optionally select a specific operation to filter
6. The plugin displays all assembled components for that SFC

## Views

### Component Hierarchy

<img width="1897" height="493" alt="image" src="https://github.com/user-attachments/assets/d5aff6a1-12a3-4838-bd6b-75d0ad1c935f" />

- Collapsible panel showing components in a flat list
- Shows component name, description, quantity, unit of measure, and batch number
- Click on any row to open the details dialog

### Components Summary

<img width="1910" height="682" alt="image" src="https://github.com/user-attachments/assets/b2c1c719-436d-4aa9-87c1-ddbd0dad27e8" />

- Detailed table with columns:
  - #: Row number
  - Component: Material number and version
  - Description: Component description
  - Operation: Assembly operation
  - Quantity: Assembled quantity
  - UoM: Unit of measure
  - Batch Number: Batch/lot number if available
  - Serial Number: Serial number if available
  - Data Fields: Click to view assembly data fields in a popover
  - Assembled Date/Time: When the component was assembled

### Visual Hierarchy

<img width="1915" height="541" alt="image" src="https://github.com/user-attachments/assets/fd160601-99b2-4f69-abe1-7f0906e9d4d8" />

- Graphical tree showing SFC at the top with all components below
- Each component shows name and quantity
- Click on any component to open the details dialog
- Collapsed by default to save space

## API

This plugin uses the following SAP DM APIs:

### Assembly API
- Endpoint: `/assembly/v1/assembledComponents`
- Parameters: `plant`, `sfc`, `operationActivity`

### DMCI Extractor API (for SFC and Operation lists)
- SFC List: `/dmci/v2/extractor/SFC`
- Operation List: `/dmci/v2/extractor/SFC_STEP_STATUS`

## Files Structure

```
sfcGenealogy/
├── Component.js              # UI5 Component definition
├── manifest.json             # Application manifest
├── controller/
│   └── MainView.controller.js  # Main controller logic
├── view/
│   ├── MainView.view.xml       # Main view
│   ├── ComponentDetailsDialog.fragment.xml  # Details dialog
│   └── SfcValueHelpDialog.fragment.xml      # SFC value help
├── designer/
│   └── components.json         # POD Designer configuration
├── builder/
│   └── PropertyEditor.js       # Property editor for POD Designer
├── i18n/
│   ├── i18n.properties         # Internationalization texts
│   ├── i18n_en.properties      # English texts
│   ├── builder.properties      # Builder texts
│   └── builder_en.properties   # Builder English texts
└── css/
    └── style.css               # Custom styles
```

## Dependencies

- SAP UI5
- SAP Digital Manufacturing POD Foundation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Authors

- Manoel Costa - [manoelcosta.com](http://manoelcosta.com/)
- Enhanced by Anshul - [@anshuljec08](https://github.com/anshuljec08)

---

**Disclaimer:** This is a community extension and is not officially supported by SAP. Use at your own discretion.
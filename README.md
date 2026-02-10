# SFC Genealogy Plugin for SAP Digital Manufacturing

A custom POD plugin for SAP Digital Manufacturing that displays the genealogy (assembled components) of a Shop Floor Control (SFC).

<img width="1915" height="1076" alt="image" src="https://github.com/user-attachments/assets/43d3bc16-d8ec-45fc-99c6-fe017c088966" />

## Features

- **Component Hierarchy View**: Flat list showing all assembled components with key information
- **Components Summary Table**: Detailed table view with all component data
- **Visual Hierarchy Chart**: Graphical tree visualization of SFC and its components
- **Data Fields Popover**: Click to view assembly data fields for each component
- **Component Details Dialog**: Full details dialog when clicking on a component
- **Search/Filter**: Filter all views by component name, description, or batch number
- **Export to CSV**: Download component data as CSV file
- **Responsive Design**: Works on desktop and tablet devices

## Installation

1. Download or clone this repository
2. Zip all files (not the folder, just the contents)
3. Upload to SAP Digital Manufacturing POD Designer as a custom plugin

<img width="1437" height="706" alt="image" src="https://github.com/user-attachments/assets/f4e31680-ea76-4a1d-a7a8-cc82b13409f7" />

## Usage

1. Add the plugin to a POD layout in POD Designer
2. Select an SFC from the worklist
3. Select an operation from the operation list (required)
4. The plugin will display all assembled components for that SFC at the selected operation

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

This plugin uses the SAP DM Assembly API:
- Endpoint: `/assembly/v1/assembledComponents`
- Parameters: `plant`, `sfc`, `operationActivity`

## Files Structure

```
sfcGenealogy/
├── Component.js              # UI5 Component definition
├── manifest.json             # Application manifest
├── controller/
│   └── MainView.controller.js  # Main controller logic
├── view/
│   ├── MainView.view.xml       # Main view
│   └── ComponentDetailsDialog.fragment.xml  # Details dialog
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

## 👨‍💻 Author

Manoel Costa
http://manoelcosta.com/

---

**Disclaimer:** This is a community extension and is not officially supported by SAP. Use at your own discretion.

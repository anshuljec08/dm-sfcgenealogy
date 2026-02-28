# Deploying SFC Genealogy Plugin to SAP Digital Manufacturing

This guide explains how to deploy and test the SFC Genealogy plugin on SAP Digital Manufacturing (DM).

## Prerequisites

1. Access to SAP Digital Manufacturing
2. POD Designer permissions
3. The plugin zip file: `sfcGenealogy_plugin.zip`

## Step 1: Upload the Plugin

1. **Login to SAP Digital Manufacturing**
   - Navigate to your DM tenant URL
   - Login with your credentials

2. **Open POD Designer**
   - Go to **Design PODs** (or **POD Designer**)
   - Click on **Manage Service Plugins** or **Plugins** tab

3. **Upload the Plugin**
   - Click **Upload** or **Import**
   - Select the `sfcGenealogy_plugin.zip` file from:
     ```
     DM_Genealogy/sfcGenealogy_plugin.zip
     ```
   - Wait for the upload to complete
   - You should see "SFC Genealogy" in the plugin list

## Step 2: Add Plugin to a POD

1. **Create or Edit a POD**
   - Go to **POD Designer**
   - Either create a new POD or edit an existing one

2. **Add the Plugin**
   - In the POD Designer canvas, look for the **Plugins** panel
   - Find **SFC Genealogy** under Custom Plugins
   - Drag and drop it onto your POD layout
   - Position it where you want (typically in a main content area)

3. **Configure Plugin Properties** (Optional)
   - Click on the plugin in the canvas
   - Configure any available properties in the Property Editor

4. **Save the POD**
   - Click **Save** to save your POD configuration

## Step 3: Test the Plugin

1. **Launch the POD**
   - Go to **Execute PODs** or the POD runtime
   - Select the POD you configured
   - Select a Work Center/Resource

2. **Test SFC Selection Feature**
   - You'll see the SFC selection toolbar at the top
   - The SFC list will automatically load from your plant
   - Type to search or click the value help icon (🔍) to see all SFCs
   - Select an SFC from the list

3. **View Genealogy Data**
   - Select an Operation from the operation list (required)
   - The plugin will fetch and display assembled components
   - Use the search field to filter components
   - Click on a component row to see details
   - Use the Visual Hierarchy panel to see a graphical view

## Troubleshooting

### Plugin not appearing in POD Designer
- Ensure the zip file contains all required files
- Check the browser console for JavaScript errors
- Verify the manifest.json has correct namespace

### SFC list not loading
- Check if you have access to the SFC API
- Verify plant configuration
- Look at browser console for API errors

### Components not showing
- An **Operation** must be selected (required by Assembly API)
- Verify the SFC has assembled components
- Check browser console for API response

### API Errors
- Ensure you have proper API permissions
- Check network tab for 401/403 errors
- Verify the plant has data

## Plugin Files Structure

```
sfcGenealogy_plugin.zip/
├── Component.js              # UI5 Component
├── manifest.json             # App manifest
├── controller/
│   └── MainView.controller.js
├── view/
│   ├── MainView.view.xml
│   ├── ComponentDetailsDialog.fragment.xml
│   └── SfcValueHelpDialog.fragment.xml
├── css/
│   └── style.css
├── i18n/
│   ├── i18n.properties
│   ├── i18n_en.properties
│   ├── builder.properties
│   └── builder_en.properties
├── builder/
│   └── PropertyEditor.js
└── designer/
    └── components.json
```

## APIs Used

| API | Endpoint | Description |
|-----|----------|-------------|
| SFC List | `GET /sfc/v1/sfcs` | Fetches available SFCs for selection |
| Assembly | `GET /assembly/v1/assembledComponents` | Fetches assembled components for an SFC |

## Re-deploying Updates

To update the plugin:

1. Make your code changes
2. Run: `cd DM_Genealogy && zip -r sfcGenealogy_plugin.zip Component.js manifest.json controller/ view/ css/ i18n/ builder/ designer/ -x "*.DS_Store" -x "test/*" -x "node_modules/*" -x "*.zip"`
3. In POD Designer > Plugins, delete the old version
4. Upload the new zip file
5. Re-add to POD if necessary

## Support

For issues with:
- **Plugin code**: Check the browser console (F12 > Console)
- **API issues**: Check network requests (F12 > Network)
- **DM configuration**: Contact your SAP DM administrator
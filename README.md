# TeamCity Pull Request Builder

## Description
The TeamCity-Pull-Request-Builder is a Google Chrome plugin that allows you to automatically trigger builds of your project that are associated with a specific pull request.

## Installation
1. Navigate to the TeamCity-Pull-Request-Builder plugin page on the Chrome Web Store using this [link](https://chrome.google.com/webstore/detail/teamcity-pull-request-bui/jeddilgijkpgnncoolllmmjcaplpeijj).
2. Click the "Add to Chrome" button and confirm the extension installation.

## Configuration
The plugin is configured through the Options page by editing a JSON configuration.

Example settings:
```json
{
    "BaseUrl": "https://yourteamcityserver.com/",
    "Username": "MyLogin",
    "Password": "MyPassword",
    "Repository": {
        "MyRepo": [
            {
                "BuildType": "Build_Type",
                "Name": "Build",
            },            
            {
                "BuildType": "Tests_0",
                "Name": "Tests 0",
                "Group": "Tests",
                "Order": 1
            },
            {
                "BuildType": "Tests_1",
                "Name": "Tests 1",
                "Group": "Tests",
                "Order": 2
            }
        ]
    }
}
```

### Configuration Parameters:
- `BaseUrl`: The base URL of your TeamCity server.
- `Repository`: The username for your TeamCity server.
- `Username`: The password for your TeamCity server.
- `Password`: An object where each property represents a repository, and the value is an array of build configuration objects.

Each build configuration object contains the following properties:
- `BuildType`: The identifier of the build type in TeamCity.
- `Name`: The name that will be displayed in the plugin interface.
- `Group`: The group to which this build configuration belongs. If specified, the build configurations will be grouped under this name in the plugin interface.
- `Order`: The sequential number to determine the display order of the build configurations within a group.

## Usage
After configuring the plugin, builds for pull requests will automatically be triggered according to your configuration.

## Support
If you encounter any issues using the plugin or have suggestions for its improvement, please create an issue in this repository.

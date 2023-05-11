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
    "Repository": {
        "CasePro": [
            {
                "BuildType": "Tests_0",
                "Name": "tests 0"
            },
            {
                "BuildType": "Tests_1",
                "Name": "tests 1"
            }
        ]
    }
}
```

### Configuration Parameters:
- `BaseUrl`: The base URL of your TeamCity server.
- `Repository`: An object where each property represents a repository, and the value is an array of build configuration objects.

Each build configuration object contains the following properties:
- `BuildType`: The identifier of the build type in TeamCity.
- `Name`: The name that will be displayed in the plugin interface.

## Usage
After configuring the plugin, builds for pull requests will automatically be triggered according to your configuration.

## Support
If you encounter any issues using the plugin or have suggestions for its improvement, please create an issue in this repository.

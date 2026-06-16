# TeamCity Pull Request Builder

## Description
The TeamCity-Pull-Request-Builder is a Google Chrome plugin that allows you to automatically trigger builds of your project that are associated with a specific pull request.

## What's new in 3.0.0
- Better TeamCity status handling, including failed starts and `Unable to collect changes` errors.
- Refresh build statuses without reloading the merge request page.
- Build duration display for running and finished builds.
- Updated GitLab sidebar UI with compact status badges.
- User-friendly Options page with a visual editor and JSON import/export.
- Basic test coverage for status, date, duration, and GitLab URL parsing.

## Installation
1. Navigate to the TeamCity-Pull-Request-Builder plugin page on the Chrome Web Store using this [link](https://chrome.google.com/webstore/detail/teamcity-pull-request-bui/jeddilgijkpgnncoolllmmjcaplpeijj).
2. Click the "Add to Chrome" button and confirm the extension installation.

## Configuration
The plugin is configured through the Options page. You can use the visual editor or edit/import the JSON configuration directly.

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
                "Name": "Build"
            },            
            {
                "BuildType": "Tests_0",
                "Name": "Tests 0",
                "Group": "Tests",
                "Order": 1,
                "BranchPrefix": "requests",
                "Depends": "Build_Type"
            },
            {
                "BuildType": "Tests_1",
                "Name": "Tests 1",
                "Group": "Tests",
                "Order": 2,
                "Depends": "Build_Type"
            }
        ]
    },
    "HeadingBorder": true
}
```

### Configuration Parameters:
- `BaseUrl`: The base URL of your TeamCity server.
- `Username`: The username for your TeamCity server.
- `Password`: The password for your TeamCity server.
- `Repository`: An object where each property represents a repository, and the value is an array of build configuration objects.

Each build configuration object contains the following properties:
- `BuildType`: The identifier of the build type in TeamCity.
- `Name`: The name that will be displayed in the plugin interface.
- `Group`: The group to which this build configuration belongs. If specified, the build configurations will be grouped under this name in the plugin interface.
- `Order`: The sequential number to determine the display order of the build configurations within a group.
- `BranchPrefix`: An optional branch prefix used by TeamCity. Default value: `requests`.
- `Depends`: An optional identifier of another build type that this configuration depends on. If specified, this build configuration is considered outdated or not actual if the build it depends on has a different version.
- `HeadingBorder`: Optional boolean. If `true`, headings in the merge request description are rendered with a bottom border for readability.

## Usage
After configuring the plugin, open a GitLab merge request. The TeamCity block appears in the right sidebar and shows configured builds, status, duration, and a Run button. Use the refresh button in the block to update statuses without reloading the page.

## Development
Run the checks and unit tests:

```bash
npm test
```

## Release cycle
Releases are published by GitHub Actions after changes are pushed to `main`.

1. Update the version in `manifest.json` and `package.json`.
2. Commit and merge the changes into `main`.
3. The release workflow runs tests, reads the version from `manifest.json`, and checks whether a GitHub release with that tag already exists.
4. If the release does not exist, the workflow builds the extension zip, uploads it to the Chrome Web Store, submits it for publishing, and creates a GitHub release.

Release tags use the plain version value, for example `3.0.0`.

The workflow expects these GitHub Actions secrets:

- `CHROME_EXTENSION_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

## Support
If you encounter any issues using the plugin or have suggestions for its improvement, please create an issue in this repository.

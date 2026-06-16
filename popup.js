const version = chrome.runtime.getManifest().version;

document.getElementById("version-label").textContent = `Version ${version}`;
document.getElementById("release-link").href = `https://github.com/deimosowen/TeamCity-Pull-Request-Builder/releases/tag/${version}`;

document.getElementById("settings-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "options.html" });
});

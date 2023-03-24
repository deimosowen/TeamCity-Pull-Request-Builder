const CASEPRO_PULLS_BUILDS = "CasePro_Pulls_CaseProBuildPullSite";
const CASEPRO_LINUX_BUILDS = "CasePro_Linux_BuildDockerImagesPulls";
const TEAMCITY_URL = 'https://ci.parcsis.org/';

chrome.tabs.onUpdated.addListener((tabId, tab) => {
    if (tab.url && tab.url.includes("github.com/Keepteam/CasePro/pull/")) {
        chrome.tabs.sendMessage(tabId, {
            type: "OPEN_PULL"
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'getBuild') {
        handleGetBuild(message)
            .then(data => {
                sendResponse({ response: data });
            });
        return true;
    } else if (message.command === 'runBuild') {
        handleRunBuild(message)
            .then(data => {
                sendResponse({ response: data });
            });
        return true;
    }
});

async function handleGetBuild(request) {
    try {
        const data = await getBuilds(request.isLinux, request.pull);
        return data;
    } catch (error) {
        console.error("Failed to get builds:", error);
        return null;
    }
}

async function handleRunBuild(request) {
    try {
        const CSRFToken = await getAuthenticationTestResult();
        const data = await runBuildQueue(request.isLinux, request.pull, CSRFToken);
        return data;
    } catch (error) {
        console.error("Failed to run build:", error);
        return null;
    }
}

async function getBuilds(isLinux, branch) {
    const buildType = isLinux ? CASEPRO_LINUX_BUILDS : CASEPRO_PULLS_BUILDS;
    const cookie = await getCookie();
    const url = `${TEAMCITY_URL}app/rest/builds?locator=buildType:${buildType},branch:${branch},count:1,running:any`;

    const response = await fetch(url, {
        headers: {
            "Cookie": `${cookie.name}=${cookie.value}`,
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(response.statusText);
    }
    return response.json();
}

async function runBuildQueue(isLinux, branch, CSRFToken) {
    const buildType = isLinux ? CASEPRO_LINUX_BUILDS : CASEPRO_PULLS_BUILDS;
    const cookie = await getCookie();
    const url = `${TEAMCITY_URL}app/rest/buildQueue`;
    const body = JSON.stringify({
        branchName: branch,
        buildType: {
            id: buildType
        }
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Cookie": `${cookie.name}=${cookie.value}`,
            'Content-Type': 'application/json',
            "Accept": "application/json",
            'X-TC-CSRF-Token': CSRFToken
        },
        body: body
    });

    if (!response.ok) {
        throw new Error(response.statusText);
    }
    return response.json();
}

async function getCookie() {
    return new Promise(resolve => {
        chrome.cookies.get({ url: TEAMCITY_URL, name: 'TCSESSIONID' }, function (cookie) {
            resolve(cookie);
        });
    });
}

async function getAuthenticationTestResult() {
    const response = await fetch(`${TEAMCITY_URL}authenticationTest.html?csrf`, {
        method: 'GET'
    });

    if (response.ok) {
        return response.text();
    } else {
        throw new Error(`Failed to get authentication test result: ${response.statusText}`);
    }
}
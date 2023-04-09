const options = {
    config: {},
    init: async () => {
        await options.loadConfig();
    },
    getConfig: async () => {
        const { config } = await chrome.storage.local.get(["config"]);
        return config;
    },
    loadConfig: async () => {
        try {
            const config = await options.getConfig();
            options.config = config;
        }
        catch (err) {
            console.error(err);
        }
    }
};

chrome.tabs.onUpdated.addListener((tabId, tab) => {
    const repositories = Object.keys(options.config.Repository);
    if (tab.url && checkUrlIncludesRepo(tab.url, repositories)) {
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

function checkUrlIncludesRepo(url, repoList) {
    for (const repo of repoList) {
        if (url.includes(`github.com/Keepteam/${repo}/pull/`)) {
            return true;
        }
    }
    return false;
}

async function handleGetBuild(request) {
    try {
        const result = await getBuilds(request.buildType, request.pull);
        return result;
    } catch (error) {
        console.error("Failed to get builds:", error);
        return null;
    }
}

async function handleRunBuild(request) {
    try {
        const CSRFToken = await getAuthenticationTestResult();
        const result = await runBuildQueue(request.buildType, request.pull, CSRFToken);
        return result;
    } catch (error) {
        console.error("Failed to run build:", error);
        return null;
    }
}

async function getBuilds(buildType, branch) {
    const cookie = await getCookie();
    const url = `${options.config.BaseUrl}app/rest/builds?locator=buildType:${buildType},branch:${branch},count:1,running:any`;
    const response = await fetch(url, {
        headers: {
            "Cookie": `${cookie.name}=${cookie.value}`,
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(response.statusText);
    }
    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    return {
        isAuthorized: !response.redirected,
        data: !response.redirected ? data : null
    };
}

async function runBuildQueue(buildType, branch, CSRFToken) {
    const cookie = await getCookie();
    const url = `${options.config.BaseUrl}app/rest/buildQueue`;
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
    return {
        isAuthorized: !response.redirected,
        data: !response.redirected ? response.json() : null
    };
}

async function getCookie() {
    return new Promise(resolve => {
        chrome.cookies.get({ url: options.config.BaseUrl, name: 'TCSESSIONID' }, function (cookie) {
            resolve(cookie);
        });
    });
}

async function getAuthenticationTestResult() {
    const response = await fetch(`${options.config.BaseUrl}authenticationTest.html?csrf`, {
        method: 'GET'
    });

    if (response.ok) {
        return response.text();
    } else {
        throw new Error(`Failed to get authentication test result: ${response.statusText}`);
    }
}

options.init();
const global = {
    COMMAND: {
        GET_BUILD: 'getBuild',
        RUN_BUILD: 'runBuild',
        RELOAD_CONFIG: 'reloadConfig'
    },
    init: async () => {
        await options.init();
        await global.initListener();
    },
    initListener: async () => {
        chrome.tabs.onUpdated.addListener((tabId, tab) => {
            const repositories = Object.keys(options.config.Repository);
            if (tab.url && checkUrlIncludesRepo(tab.url, repositories)) {
                chrome.tabs.sendMessage(tabId, {
                    type: "OPEN_PULL"
                });
            }
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.command === global.COMMAND.GET_BUILD) {
                API.getBuilds(message)
                    .then(data => {
                        sendResponse({ response: data });
                    });
            } else if (message.command === global.COMMAND.RUN_BUILD) {
                API.runBuildQueue(message)
                    .then(data => {
                        sendResponse({ response: data });
                    });
            } else if (message.command === global.COMMAND.RELOAD_CONFIG) {
                options.reloadConfig().then(data => {
                    sendResponse({ response: data });
                });
            }
            return true;
        });

        function checkUrlIncludesRepo(url, repoList) {
            for (const repo of repoList) {
                const regex = new RegExp(`github\\.com\\/.*?\\/${repo}\\/pull\\/`);
                if (regex.test(url)) {
                    return true;
                }
            }
            return false;
        }
    }
}

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
    },
    reloadConfig: async () => {
        await API.logout();
        await options.loadConfig();
    }
};

const API = {
    getCredentials: () => {
        return 'Basic ' + btoa(`${options.config.Username}:${options.config.Password}`);
    },
    getAuthenticationTestResult: async () => {
        const response = await fetch(`${options.config.BaseUrl}authenticationTest.html?csrf`, {
            method: 'GET',
            headers: {
                'Authorization': API.getCredentials()
            },
        });

        if (response.ok) {
            return response.text();
        } else {
            return null;
        }
    },
    getBuilds: async (request) => {
        const url = `${options.config.BaseUrl}app/rest/builds?locator=buildType:${request.buildType},branch:${request.pull},count:1,running:any`;
        const response = await fetch(url, {
            headers: {
                'Authorization': API.getCredentials(),
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
    },
    runBuildQueue: async (request) => {
        const CSRFToken = await API.getAuthenticationTestResult();
        const url = `${options.config.BaseUrl}app/rest/buildQueue`;
        const body = JSON.stringify({
            branchName: request.pull,
            buildType: {
                id: request.buildType
            }
        });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': API.getCredentials(),
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
            data: !response.redirected ? await response.json() : null
        };
    },
    logout: async () => {
        const CSRFToken = await API.getAuthenticationTestResult();
        if (CSRFToken) {
            const response = await fetch(`${options.config.BaseUrl}ajax.html?logout=1`, {
                method: "POST",
                headers: {
                    'X-TC-CSRF-Token': CSRFToken
                },
            });
        }
    }
}

global.init();
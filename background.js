import "./tc-utils.js";

const utils = globalThis.TcPrbUtils;

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
            const repositories = Object.keys(options.config?.Repository || {});
            if (repositories.length === 0) {
                return;
            }
            if (tab.url && checkUrlIncludesRepo(tab.url, repositories)) {
                chrome.tabs.sendMessage(tabId, {
                    type: "OPEN_PULL"
                }, () => void chrome.runtime.lastError);
            }
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const reply = promise => {
                promise
                    .then(data => {
                        sendResponse({ response: data });
                    })
                    .catch(error => {
                        console.error(error);
                        sendResponse({
                            response: {
                                isAuthorized: true,
                                data: null,
                                error: error.message || String(error)
                            }
                        });
                    });
            };

            if (message.command === global.COMMAND.GET_BUILD) {
                reply(API.getBuilds(message));
            } else if (message.command === global.COMMAND.RUN_BUILD) {
                reply(API.runBuildQueue(message));
            } else if (message.command === global.COMMAND.RELOAD_CONFIG) {
                reply(options.reloadConfig());
            } else {
                sendResponse({ response: null });
            }
            return true;
        });

        function checkUrlIncludesRepo(url, repoList) {
            const repoName = utils.getRepoNameFromGitLabUrl(url);
            return repoList.includes(repoName);
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
        return config || {};
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
    },
    findBranchPrefix: (buildType) => {
        const data = options.config || {};
        const defaultValue = 'requests';
        for (const repoName in data.Repository || {}) {
            const builds = data.Repository[repoName];
            for (const build of builds) {
                if (build.BuildType === buildType) {
                    return build.BranchPrefix || defaultValue;
                }
            }
        }
        return defaultValue;
    }
};

const API = {
    getCredentials: () => {
        return 'Basic ' + btoa(`${options.config.Username}:${options.config.Password}`);
    },
    parseResponseData: async (response) => {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        }
        return await response.text();
    },
    isUnauthorized: (response) => {
        return response.status === 401 && response.ok == false;
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
        const buildQueue = await API.getBuildQueue(request);
        if (buildQueue !== null && buildQueue.data !== null && buildQueue.data.count !== 0) {
            return buildQueue;
        }
        const branchPrefix = options.findBranchPrefix(request.buildType);
        const locator = `buildType:${request.buildType},branch:${branchPrefix}/${request.pull},count:1,running:any`;
        const fields = "count,build(id,status,state,branchName,webUrl,number,startDate,finishDate,finishOnAgentDate,queuedDate,statusText)";
        const url = `${options.config.BaseUrl}app/rest/builds?${new URLSearchParams({ locator, fields })}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': API.getCredentials(),
                "Accept": "application/json"
            }
        });
        const isAuthorized = !API.isUnauthorized(response);
        if (!response.ok) {
            return {
                isAuthorized: isAuthorized,
                data: null
            };
        }
        let data = await API.parseResponseData(response);
        return {
            isAuthorized: isAuthorized,
            data: isAuthorized ? data : null
        };
    },
    getBuildQueue: async (request) => {
        const locator = `buildType:(id:${request.buildType})`;
        const fields = "count,build(id,status,state,branchName,webUrl,number,startDate,finishDate,finishOnAgentDate,queuedDate,statusText)";
        const url = `${options.config.BaseUrl}app/rest/buildQueue?${new URLSearchParams({ locator, fields })}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': API.getCredentials(),
                "Accept": "application/json"
            }
        });

        const isAuthorized = !API.isUnauthorized(response);
        if (!response.ok) {
            return {
                isAuthorized: isAuthorized,
                data: null
            };
        }
        let data = null;
        const branchPrefix = options.findBranchPrefix(request.buildType);
        data = await API.parseResponseData(response);
        if (typeof data === "object" && data !== null) {
            data.build = utils.getBuilds(data).filter(item => item.branchName === `${branchPrefix}/${request.pull}`);
            data.count = data.build.length;
        }
        return {
            isAuthorized: isAuthorized,
            data: isAuthorized ? data : null
        };
    },
    runBuildQueue: async (request) => {
        const CSRFToken = await API.getAuthenticationTestResult();
        const branchPrefix = options.findBranchPrefix(request.buildType);
        const url = `${options.config.BaseUrl}app/rest/buildQueue`;
        const body = JSON.stringify({
            branchName: `${branchPrefix}/${request.pull}`,
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
        const data = !response.redirected ? await API.parseResponseData(response) : null;
        return {
            isAuthorized: !response.redirected,
            data
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

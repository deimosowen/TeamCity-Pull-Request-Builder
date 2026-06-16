const utils = globalThis.TcPrbUtils;

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
            options.config = await options.getConfig();
        } catch (err) {
            options.config = {};
            console.error(err);
        }
    },
    validConfig: async () => {
        const requiredFields = ["BaseUrl", "Username", "Password", "Repository"];
        if (!options.config || typeof options.config !== "object") {
            return false;
        }
        return requiredFields.every(field => Object.prototype.hasOwnProperty.call(options.config, field));
    }
};

const cs = {
    command: {
        GET_BUILD: "getBuild",
        RUN_BUILD: "runBuild",
        RELOAD_CONFIG: "reloadConfig"
    },
    init: async () => {
        await options.init();

        window.addEventListener("load", async () => {
            await cs.render();
        });

        chrome.runtime.onMessage.addListener(({ type }) => {
            if (type === "OPEN_PULL") {
                setTimeout(async () => await cs.render(), 1000);
            }
        });
    },
    render: async () => {
        addBuildInTeamCityMenu();
        addHeadingBorderInMergeRequestDescription();
    },
    getRepoBuildSetting: () => {
        const repoName = utils.getRepoNameFromGitLabUrl(window.location.href);
        const repositories = options.config?.Repository || {};
        return repositories[repoName];
    }
};

function getPullNumber() {
    const bodyElement = document.querySelector("body");
    const pageTypeId = bodyElement?.getAttribute("data-page-type-id");
    const fromPageType = Number.parseInt(pageTypeId, 10);
    if (Number.isFinite(fromPageType)) {
        return fromPageType;
    }

    const match = window.location.href.match(/\/merge_requests\/(\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
}

function createSidebarItem() {
    let sidebarItem = document.getElementById("root-build-tc-menu");
    if (!sidebarItem) {
        sidebarItem = document.createElement("div");
        sidebarItem.setAttribute("id", "root-build-tc-menu");
    }

    sidebarItem.className = "block build-tc tc-panel";
    sidebarItem.replaceChildren();
    return sidebarItem;
}

function createRefreshIcon() {
    return createSvgIcon("M1.5 8a6.5 6.5 0 0 1 11.1-4.6V1.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.67A5 5 0 1 0 13 8a.75.75 0 0 1 1.5 0A6.5 6.5 0 1 1 1.5 8Z", "tc-refresh-icon");
}

function createSvgIcon(pathData, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(className);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
}

function createHeaderElement(builds, labelsElement) {
    const header = document.createElement("div");
    header.classList.add("tc-panel-header");

    const title = document.createElement("div");
    title.classList.add("tc-panel-title");
    title.textContent = "Build in TeamCity";

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.classList.add("tc-refresh-button");
    refreshButton.title = "Refresh statuses";
    refreshButton.appendChild(createRefreshIcon());
    refreshButton.addEventListener("click", async () => {
        refreshButton.disabled = true;
        await refreshBuildLabels(labelsElement, builds);
        refreshButton.disabled = false;
    });

    header.appendChild(title);
    header.appendChild(refreshButton);
    return header;
}

function appendMessage(container, message, type = "muted") {
    const element = document.createElement("div");
    element.classList.add("tc-panel-message", `tc-panel-message-${type}`);
    element.textContent = message;
    container.appendChild(element);
}

function createLoaderElement() {
    const loaderElement = document.createElement("div");
    loaderElement.classList.add("tc-loader");
    loaderElement.textContent = "Loading TeamCity builds...";
    return loaderElement;
}

async function fetchBuilds(builds, pull) {
    const requests = builds.map(async data => {
        const response = await chrome.runtime.sendMessagePromise({
            command: cs.command.GET_BUILD,
            buildType: data.BuildType,
            pull
        });
        return { ...data, response };
    });

    return await Promise.all(requests);
}

function sortBuilds(builds) {
    return [...builds].sort((a, b) => {
        const defaultGroup = "zzzz";
        const defaultOrder = Infinity;
        const groupA = a.Group != null ? a.Group : defaultGroup;
        const groupB = b.Group != null ? b.Group : defaultGroup;
        const orderA = a.Order != null ? a.Order : defaultOrder;
        const orderB = b.Order != null ? b.Order : defaultOrder;

        if (groupA === defaultGroup && groupB !== defaultGroup) {
            return -1;
        }
        if (groupA !== defaultGroup && groupB === defaultGroup) {
            return 1;
        }
        if (groupA !== groupB) {
            return groupA < groupB ? -1 : 1;
        }
        return orderA - orderB;
    });
}

function isBuildActual(build, responses) {
    if (!build.Depends) {
        return true;
    }

    const dependsBuild = responses.find(item => item.BuildType === build.Depends);
    const dependsNumber = utils.getBuilds(dependsBuild?.response?.response?.data)[0]?.number;
    const currentNumber = utils.getBuilds(build?.response?.response?.data)[0]?.number;
    if (!dependsNumber || !currentNumber) {
        return true;
    }

    const dependsVersion = utils.extractVersionNumber(dependsNumber);
    const currentVersion = utils.extractVersionNumber(currentNumber);
    return Boolean(dependsVersion && currentVersion && dependsVersion === currentVersion);
}

function getStatusIconPath(statusInfo) {
    switch (statusInfo.status) {
        case utils.resultStatus.SUCCESS:
            return "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z";
        case utils.resultStatus.FAILURE:
        case utils.resultStatus.ERROR:
            return "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z";
        case utils.resultStatus.RUNNING:
            return "M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.5a5 5 0 1 0 0 10A5 5 0 0 0 8 3Zm.75 2.75v2.1l1.55 1.55a.75.75 0 1 1-1.06 1.06L7.47 8.69A.75.75 0 0 1 7.25 8V5.75a.75.75 0 0 1 1.5 0Z";
        case utils.resultStatus.QUEUED:
            return "M4 1.75A.75.75 0 0 1 4.75 1h6.5a.75.75 0 0 1 .75.75v1.1A4.25 4.25 0 0 1 9.46 6.75 4.25 4.25 0 0 1 12 10.65v1.6a.75.75 0 0 1-.75.75h-6.5A.75.75 0 0 1 4 12.25v-1.6a4.25 4.25 0 0 1 2.54-3.9A4.25 4.25 0 0 1 4 2.85v-1.1Zm1.5.75v.35A2.75 2.75 0 0 0 8.25 5.6 2.75 2.75 0 0 0 11 2.85V2.5H5.5Zm0 8.15v.85H11v-.85A2.75 2.75 0 0 0 8.25 7.9 2.75 2.75 0 0 0 5.5 10.65Z";
        default:
            return "M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.5a5 5 0 1 0 0 10A5 5 0 0 0 8 3Z";
    }
}

function getBuildMetaText(statusInfo, timing) {
    if (statusInfo.status === utils.resultStatus.NOT_BUILDS) {
        return "No builds yet";
    }
    if (statusInfo.status === utils.resultStatus.QUEUED) {
        return "Waiting in queue";
    }
    if (statusInfo.status === utils.resultStatus.RUNNING) {
        return timing.durationText ? `Running for ${timing.durationText}` : "Build in progress";
    }

    const datePart = timing.dateText ? `Last build: ${timing.dateText}` : "Last build";
    return timing.durationText ? `${datePart} (${timing.durationText})` : datePart;
}

function createStatusIcon(statusInfo) {
    const status = document.createElement("span");
    status.classList.add("tc-status", `tc-status-${statusInfo.severity}`);
    status.title = statusInfo.label;
    status.appendChild(createSvgIcon(getStatusIconPath(statusInfo), "tc-status-icon"));
    return status;
}

function createRunIcon() {
    return createSvgIcon("M4.25 2.75a.75.75 0 0 1 1.12-.65l6.5 4.25a.75.75 0 0 1 0 1.3l-6.5 4.25a.75.75 0 0 1-1.12-.65v-8.5Z", "tc-run-icon");
}

function setRunButtonState(button, state) {
    button.replaceChildren();
    button.classList.remove("tc-build-button-busy", "tc-build-button-error");

    if (state === "starting") {
        button.textContent = "...";
        button.title = "Starting build";
        button.classList.add("tc-build-button-busy");
        return;
    }
    if (state === "queued") {
        button.appendChild(createSvgIcon(getStatusIconPath({ status: utils.resultStatus.QUEUED }), "tc-run-icon"));
        button.title = "Build queued";
        button.classList.add("tc-build-button-busy");
        return;
    }
    if (state === "retry") {
        button.textContent = "!";
        button.title = "Build start failed. Retry";
        button.classList.add("tc-build-button-error");
        return;
    }

    button.appendChild(createRunIcon());
    button.title = "Run build";
}

function createBuildRow(buildConfig, responses, pull) {
    const data = buildConfig.response?.response?.data;
    const build = utils.getBuilds(data)[0];
    const statusInfo = utils.normalizeBuildStatus(data);
    const timing = utils.getBuildTiming(build);
    const buildIsActual = isBuildActual(buildConfig, responses);
    const defaultHref = `${options.config.BaseUrl}buildConfiguration/${encodeURIComponent(buildConfig.BuildType)}?mode=builds#all-projects`;

    const item = document.createElement("div");
    item.classList.add("tc-build-row");

    const main = document.createElement("div");
    main.classList.add("tc-build-main");

    const link = document.createElement("a");
    link.classList.add("tc-build-name");
    link.href = build?.webUrl || defaultHref;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = buildConfig.Name || buildConfig.BuildType;
    main.appendChild(link);

    const meta = document.createElement("div");
    meta.classList.add("tc-build-meta");

    const text = document.createElement("span");
    text.textContent = getBuildMetaText(statusInfo, timing);
    meta.appendChild(text);
    meta.appendChild(createStatusIcon(statusInfo));

    if (!buildIsActual) {
        const outdated = document.createElement("span");
        outdated.classList.add("tc-outdated");
        outdated.title = `Depends on ${buildConfig.Depends}`;
        outdated.appendChild(createSvgIcon("M8.67 1.98a.75.75 0 0 0-1.34 0l-6 11A.75.75 0 0 0 2 14h12a.75.75 0 0 0 .67-1.1l-6-11ZM8.75 6v3.25a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 1.5 0ZM8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z", "tc-status-icon"));
        meta.appendChild(outdated);
    }

    main.appendChild(meta);

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("tc-build-button");
    button.setAttribute("aria-label", `Run ${buildConfig.Name || buildConfig.BuildType}`);
    setRunButtonState(button, "idle");
    button.addEventListener("click", event => handleBuildButtonClick(event, { BuildType: buildConfig.BuildType, pull }));

    item.appendChild(main);
    item.appendChild(button);
    return item;
}

function appendGroupTitle(container, title) {
    const groupTitle = document.createElement("div");
    groupTitle.classList.add("tc-group-title");
    const label = document.createElement("span");
    label.textContent = title;
    groupTitle.appendChild(label);
    container.appendChild(groupTitle);
}

function renderBuildResponses(container, responses, pull) {
    const list = document.createElement("div");
    list.classList.add("tc-build-list");

    let currentGroup = null;
    for (const buildConfig of sortBuilds(responses)) {
        const envelope = buildConfig.response?.response;
        if (!envelope?.isAuthorized || envelope.data === null) {
            appendMessage(container, "Failed to connect to TeamCity. Check options and permissions.", "danger");
            return;
        }

        if (buildConfig.Group && buildConfig.Group !== currentGroup) {
            currentGroup = buildConfig.Group;
            appendGroupTitle(list, buildConfig.Group);
        }
        if (!buildConfig.Group) {
            currentGroup = null;
        }

        list.appendChild(createBuildRow(buildConfig, responses, pull));
    }

    container.appendChild(list);
}

async function refreshBuildLabels(labelsElement, builds) {
    labelsElement.replaceChildren(createLoaderElement());

    const pull = getPullNumber();
    const isValid = await options.validConfig();
    if (!isValid || !pull) {
        labelsElement.replaceChildren();
        appendMessage(labelsElement, "TeamCity settings are incomplete.", "danger");
        return;
    }

    try {
        const responses = await fetchBuilds(builds, pull);
        labelsElement.replaceChildren();
        renderBuildResponses(labelsElement, responses, pull);
    } catch (error) {
        console.error("TeamCity request failed:", error);
        labelsElement.replaceChildren();
        appendMessage(labelsElement, "Could not load TeamCity builds.", "danger");
    }
}

function createLabelsElement(builds) {
    const labelsElement = document.createElement("div");
    labelsElement.classList.add("tc-panel-body");
    refreshBuildLabels(labelsElement, builds);
    return labelsElement;
}

function addBuildInTeamCityMenu() {
    const buildSetting = cs.getRepoBuildSetting();
    if (!buildSetting) {
        return;
    }

    if (window.__tcPrbMenuTimer) {
        clearInterval(window.__tcPrbMenuTimer);
    }

    let attempts = 0;
    window.__tcPrbMenuTimer = setInterval(() => {
        attempts += 1;
        const projectsMenu = document.getElementById("milestone-edit");
        if (!projectsMenu && attempts < 30) {
            return;
        }

        clearInterval(window.__tcPrbMenuTimer);
        window.__tcPrbMenuTimer = null;
        if (!projectsMenu) {
            return;
        }

        const parent = projectsMenu.closest(".milestone");
        if (!parent?.parentNode) {
            return;
        }

        const sidebarItem = createSidebarItem();
        const labelsElement = createLabelsElement(buildSetting);

        addScrollToForm(parent);
        sidebarItem.appendChild(createHeaderElement(buildSetting, labelsElement));
        sidebarItem.appendChild(labelsElement);
        parent.parentNode.insertBefore(sidebarItem, parent);
    }, 500);
}

function addHeadingBorderInMergeRequestDescription() {
    if (options.config.HeadingBorder === true) {
        const descriptionElement = document.querySelector(".merge-request-overview .detail-page-description .description.js-task-list-container");
        if (descriptionElement) {
            const headings = descriptionElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
            headings.forEach(heading => {
                heading.style.borderBottom = "1px solid rgb(216, 222, 228)";
                heading.style.paddingBottom = ".3em";
                heading.style.fontSize = "1.5em";
            });
        }
    }
}

function addScrollToForm(element) {
    const form = element.closest("form.issuable-context-form");
    if (form) {
        form.style.overflowY = "auto";
        form.style.paddingLeft = "0px";
    }
}

async function handleBuildButtonClick(event, { BuildType, pull }) {
    event.preventDefault();
    const button = event.currentTarget;
    button.disabled = true;
    setRunButtonState(button, "starting");

    try {
        const result = await chrome.runtime.sendMessagePromise({
            command: cs.command.RUN_BUILD,
            buildType: BuildType,
            pull
        });
        const queuedState = result?.response?.data?.state || result?.response?.data?.build?.state;
        setRunButtonState(button, queuedState === "queued" ? "queued" : "starting");
        setTimeout(() => cs.render(), 1000);
    } catch (error) {
        console.error("TeamCity build start failed:", error);
        button.disabled = false;
        setRunButtonState(button, "retry");
    }
}

chrome.runtime.sendMessagePromise = function (message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
};

cs.init();

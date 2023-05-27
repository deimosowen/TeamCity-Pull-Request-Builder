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
            let config = await options.getConfig();
            options.config = config;
        }
        catch (err) {
            console.error(err);
        }
    },
    validConfig: async () => {
        const requiredFields = ["BaseUrl", "Username", "Password", "Repository"];
        for (const field of requiredFields) {
            if (!options.config.hasOwnProperty(field)) {
                return false;
            }
        }
        return true;
    }
};

const cs = {
    resultStatus: {
        SUCCESS: "SUCCESS",
        RUNNING: "RUNNING",
        FAILURE: "FAILURE"
    },
    command: {
        GET_BUILD: 'getBuild',
        RUN_BUILD: 'runBuild',
        RELOAD_CONFIG: 'reloadConfig'
    },
    init: async () => {
        await options.init();

        window.addEventListener('load', async () => {
            await cs.render();
        });

        chrome.runtime.onMessage.addListener(({ type }) => {
            if (type === 'OPEN_PULL') {
                setTimeout(async () => await cs.render(), 1000);
            }
        });
    },
    render: async () => {
        if (isCleanUrl()) {
            addBuildInTeamCityMenu();
        }
    },
    getRepoBuildSetting: () => {
        function getRepoName() {
            const regex = /https:\/\/github\.com\/[^/]+\/([^/]+)/;
            const match = window.location.href.match(regex);
            if (match && match[1]) {
                return match[1];
            }
        };
        function findRepoInSetting() {
            const repoName = getRepoName();
            const jsonData = options.config;
            if (jsonData.Repository && jsonData.Repository[repoName]) {
                return jsonData.Repository[repoName];
            }
            return;
        };
        return findRepoInSetting();
    }
}

function getPullNumberFromURL() {
    return parseInt(window.location.href.match(/\/(\d+)(#|$)/)[1], 10);
}

function isCleanUrl() {
    const regex = /^\/[^\/]+\/[^\/]+\/pull\/\d+\/?$/;
    const path = window.location.pathname;
    const hostname = window.location.hostname;
    const isCorrectHost = (hostname === 'github.com' && regex.test(path));
    return isCorrectHost;
}

function createSidebarItem() {
    let sidebarItem = document.getElementById("root-build-tc-menu");
    if (sidebarItem) {
        sidebarItem.innerHTML = "";
    } else {
        sidebarItem = document.createElement("div");
        sidebarItem.setAttribute("id", "root-build-tc-menu");
        sidebarItem.classList.add("discussion-sidebar-item", "js-discussion-sidebar-item");
    }
    return sidebarItem;
}

function createDetailsElement() {
    const detailsElement = document.createElement("details");
    detailsElement.classList.add("details-reset");
    detailsElement.setAttribute("id", "labels-select-menu");
    return detailsElement;
}

function createSummaryElement() {
    const summaryElement = document.createElement("summary");
    summaryElement.classList.add("discussion-sidebar-heading", "text-bold");
    summaryElement.setAttribute("aria-haspopup", "menu");
    summaryElement.textContent = "Build in TeamCity";
    return summaryElement;
}

function appendErrorElement(labelsElement, id, errorText, actionText, className) {
    if (!document.getElementById(id)) {
        const label = document.createElement("p");
        label.innerHTML = `
            <span class="d-flex min-width-0 flex-1 js-hovercard-left" id="${id}">
              <div class="${className} assignee text-center" style="width: 100%;">
              <div>${errorText}</div>
                <div class="v-align-middle">${actionText}</div>
              </div>
            </span>`;
        labelsElement.appendChild(label);
    }
}

function createLoaderElement() {
    const loaderElement = document.createElement("div");
    loaderElement.setAttribute("id", "tc-loader");
    loaderElement.classList.add("text-center");
    const loaderHTML = `
    <div class="text-center">
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="m-3 anim-rotate">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke"></circle>
        <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
      </svg>
    </div>
  `;
    loaderElement.innerHTML = loaderHTML;
    return loaderElement;
}

async function fetchBuilds(builds, pull) {
    const requests = builds.map(data =>
        new Promise(async (resolve, reject) => {
            try {
                const response = await chrome.runtime.sendMessagePromise({
                    command: cs.command.GET_BUILD,
                    buildType: data.BuildType,
                    pull: pull
                });
                resolve({ ...data, response });
            } catch (error) {
                reject(error);
            }
        })
    );

    return await Promise.all(requests);
}

function createLabelsElement(builds) {
    const pull = getPullNumberFromURL();
    const labelsElement = document.createElement("div");
    labelsElement.classList.add("flex-wrap");
    labelsElement.classList.add("sidebar-assignee");
    const loaderElement = createLoaderElement();
    labelsElement.appendChild(loaderElement);

    options.validConfig()
        .then((status) => {
            if (status) {
                fetchBuilds(builds, pull)
                    .then(responses => {
                        responses.sort((a, b) => {
                            const defaultGroup = 'zzzz';
                            const defaultOrder = Infinity;

                            const groupA = a.Group != null ? a.Group : defaultGroup;
                            const orderA = a.Order != null ? a.Order : defaultOrder;
                            const groupB = b.Group != null ? b.Group : defaultGroup;
                            const orderB = b.Order != null ? b.Order : defaultOrder;

                            if (groupA === defaultGroup && groupB === defaultGroup) {
                                return orderA - orderB;
                            }

                            if (groupA === defaultGroup || groupB === defaultGroup) {
                                return groupA === defaultGroup ? -1 : 1;
                            }

                            if (groupA < groupB) {
                                return -1;
                            } else if (groupA > groupB) {
                                return 1;
                            } else {
                                return orderA - orderB;
                            }
                        });

                        let currentGroup = null;
                        let groupElement = null;

                        labelsElement.removeChild(loaderElement);
                        for (const { response, Name, BuildType, Group } of responses) {
                            if (response.response === null) {
                                appendErrorElement(labelsElement, 'isRequestError', 'Failed to connect to the server', "Please verify connection settings in 'Options' page.", 'color-fg-danger');
                                return;
                            }
                            if (response.response.isAuthorized === false) {
                                appendErrorElement(labelsElement, 'isNeedAuthorized', 'You are not authorized', 'Log in to TeamCity', 'Link--primary');
                                return;
                            }
                            if (Group != currentGroup) {
                                currentGroup = Group;
                                if (Group) {
                                    groupElement = document.createElement("div");
                                    groupElement.classList.add("group");
                                    const groupTitle = createGroupTitle(Group);
                                    groupElement.appendChild(groupTitle);
                                    labelsElement.appendChild(groupElement);
                                }
                            } else {
                                groupElement = labelsElement;
                            }
                            const buildResult = checkStatus(response.response.data);
                            let details = "";

                            if (buildResult === cs.resultStatus.SUCCESS) {
                                details = createBuildDetailsElement(
                                    `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`,
                                    createSvgElement("M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z", "octicon-check color-fg-success")
                                );
                            } else if (buildResult === cs.resultStatus.FAILURE) {
                                details = createBuildDetailsElement(
                                    `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`,
                                    createSvgElement("M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z", "octicon-x color-fg-danger")
                                );
                            } else if (buildResult === cs.resultStatus.RUNNING) {
                                details = createBuildDetailsElement(
                                    "Build in progress",
                                    createSvgElement("M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z", "octicon-x hx_dot-fill-pending-icon")
                                );
                            } else {
                                details = createBuildDetailsElement("Build not initiated yet");
                            }

                            const item = document.createElement("div");
                            item.classList.add("mb-2");

                            const defaultHref = `${options.config.BaseUrl}buildConfiguration/${BuildType}?mode=builds#all-projects`;

                            const label = document.createElement("div");
                            label.classList.add("Link--primary");
                            label.classList.add("v-align-middle");
                            label.innerHTML = `<a class="Link--primary assignee" href="${response.response.data.count === 0 ? defaultHref : response.response.data.build[0].webUrl}" target="_blank">${Name}</a>`;
                            item.appendChild(label);

                            const configurations = document.createElement("div");
                            configurations.classList.add("d-flex");
                            configurations.classList.add("flex-lg-justify-between");
                            configurations.innerHTML = `${details}`;
                            item.appendChild(configurations);

                            groupElement.appendChild(item);
                            const button = item.querySelector(".Button");
                            button.addEventListener("click", (event) => handleBuildButtonClick(event, { BuildType, pull }));
                        };
                    })
                    .catch(error => {
                        console.error("Ошибка при выполнении запросов:", error);
                        labelsElement.removeChild(loaderElement);
                    });
            }
            else {
                labelsElement.removeChild(loaderElement);
                appendErrorElement(labelsElement, 'isRequestError', 'Failed to connect to the server', "Please verify connection settings in 'Options' page.", 'color-fg-danger');
            }
        });
    return labelsElement;
}

function createGroupTitle(title) {
    let container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.width = "100%";

    let line1 = document.createElement("span");
    line1.style.flexGrow = ".15";
    line1.style.height = "1px";
    line1.style.background = "#d8dee4";
    container.appendChild(line1);

    let text = document.createElement("span");
    text.textContent = title;
    text.style.margin = "0 10px";
    text.classList.add("text-bold");
    text.classList.add("discussion-sidebar-heading");
    container.appendChild(text);

    let line2 = document.createElement("span");
    line2.style.flexGrow = "1";
    line2.style.height = "1px";
    line2.style.background = "#d8dee4";
    container.appendChild(line2);

    return container;
}

function createSvgElement(path, extraClasses) {
    return `
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon ${extraClasses}">
        <path d="${path}"></path>
      </svg>`;
}

function createBuildDetailsElement(text, svgElement = '') {
    return `
    <div class="color-fg-muted reason text-small text-normal v-align-middle">
        ${text}
        ${svgElement}
    </div>
    <div class="position-relative">
    <button class="Button Button--link">
        <span class="Button-content">
            <span class="Button-label">Run Build</span>
        </span>
    </button>
</div>`;
}

function addBuildInTeamCityMenu() {
    const buildSetting = cs.getRepoBuildSetting();
    if (!buildSetting) {
        return;
    }
    const projectsMenu = document.getElementById('projects-select-menu');
    const parent = projectsMenu.closest('.discussion-sidebar-item.js-discussion-sidebar-item');
    const sidebarItem = createSidebarItem();
    const detailsElement = createDetailsElement();
    const summaryElement = createSummaryElement();
    const labelsElement = createLabelsElement(buildSetting);

    detailsElement.appendChild(summaryElement);
    sidebarItem.appendChild(detailsElement);
    sidebarItem.appendChild(labelsElement);
    parent.parentNode.insertBefore(sidebarItem, parent);
}

function handleBuildButtonClick(event, { BuildType, pull }) {
    event.preventDefault();
    const button = event.target.closest('.Button--link');
    if (!button) return;
    button.disabled = true;
    button.querySelector('.Button-label').textContent = 'Build started';
    chrome.runtime.sendMessage({
        command: cs.command.RUN_BUILD,
        buildType: BuildType,
        pull: pull
    }, function (response) {
        if (response.state === "queued") {
            button.querySelector('.Button-label').textContent = 'Build in queue';
        }
    });
}

function formatDate(inputDate) {
    const year = inputDate.slice(0, 4);
    const month = inputDate.slice(4, 6);
    const day = inputDate.slice(6, 8);
    const hours = inputDate.slice(9, 11);
    const minutes = inputDate.slice(11, 13);
    const seconds = inputDate.slice(13, 15);

    if (day < 1 || day > 31) {
        throw new Error('Invalid day value');
    }

    if (hours < 0 || hours > 23) {
        throw new Error('Invalid hours value');
    }

    if (minutes < 0 || minutes > 59) {
        throw new Error('Invalid minutes value');
    }

    if (seconds < 0 || seconds > 59) {
        throw new Error('Invalid seconds value');
    }

    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    const dayFormatted = date.getDate().toString().padStart(2, '0');
    const monthFormatted = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
    const yearFormatted = date.getFullYear().toString().slice(2);
    const hoursFormatted = date.getHours().toString().padStart(2, '0');
    const minutesFormatted = date.getMinutes().toString().padStart(2, '0');
    return `${dayFormatted} ${monthFormatted} ${yearFormatted} ${hoursFormatted}:${minutesFormatted}`;
}

function checkStatus(response) {
    if (response.count === 0) {
        return cs.resultStatus.NOTBUILDS;
    }

    const { status, state } = response.build[0];

    switch (true) {
        case (status === "SUCCESS" && state === "finished"):
            return cs.resultStatus.SUCCESS;
        case (status === "SUCCESS" && state === "running"):
        case (state === "queued"):
            return cs.resultStatus.RUNNING;
        case (status === "FAILURE"):
            return cs.resultStatus.FAILURE;
        default:
            throw new Error(`Unknown status: ${status} or state: ${state}`);
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
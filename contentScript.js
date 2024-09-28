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
        FAILURE: "FAILURE",
        QUEUED: "QUEUED",
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
        addBuildInTeamCityMenu();
    },
    getRepoBuildSetting: () => {
        function getRepoName() {
            const regex = /https:\/\/gitlab\.pravo\.tech\/[^/]+\/([^/]+)/;
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

function getPullNumber() {
    const bodyElement = document.querySelector('body');
    const pageTypeId = bodyElement.getAttribute('data-page-type-id');
    return parseInt(pageTypeId);
}

function createSidebarItem() {
    let sidebarItem = document.getElementById("root-build-tc-menu");
    if (sidebarItem) {
        sidebarItem.innerHTML = "";
    } else {
        sidebarItem = document.createElement("div");
        sidebarItem.setAttribute("id", "root-build-tc-menu");
        sidebarItem.classList.add("block", "build-tc");
    }
    return sidebarItem;
}

function createDetailsElement() {
    const detailsElement = document.createElement("div");
    detailsElement.classList.add("gl--flex-full", "gl-align-items-center", "gl-display-flex", "gl-font-weight-bold", "gl-line-height-20", "gl-text-gray-900");
    detailsElement.setAttribute("id", "labels-select-menu");
    return detailsElement;
}

function createSummaryElement() {
    const element = document.createElement("span");
    element.textContent = "Build in TeamCity";
    return element;
}

function appendErrorElement(labelsElement, id, errorText, actionText, className) {
    if (!document.getElementById(id)) {
        const label = document.createElement("p");
        label.classList.add("mt-2");
        label.innerHTML = `
            <span class="d-flex min-width-0 flex-1 js-hovercard-left" id="${id}">
              <div class="${className} assignee text-center" style="width: 100%;">
              <div>${errorText}</div>
                <div class="vertical-align-sub">${actionText}</div>
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
        <span aria-label="Loading" role="status" class="gl-spinner-container align-bottom">
            <span class="gl-spinner gl-spinner-lg !gl-vertical-align-text-bottom gl-spinner-dark mt-2"></span>
        </span>
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
    const pull = getPullNumber();
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
                        for (const { response, Name, BuildType, Group, Depends } of responses) {
                            if (response.response === null || !response.response.isAuthorized) {
                                appendErrorElement(labelsElement, 'isRequestError', 'Failed to connect to the server', "Please verify connection settings in 'Options' page.", 'text-danger');
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
                            let buildIsActual = true;
                            if (Depends) {
                                const dependsBuild = responses.find(x => x.BuildType === Depends);
                                if (dependsBuild) {
                                    const dependsBuildNumber = dependsBuild.response.response.data.build[0]?.number;
                                    const responseBuildNumber = response.response.data.build[0]?.number;
                                    if (dependsBuildNumber && responseBuildNumber) {
                                        const dependsVersion = extractVersionNumber(dependsBuildNumber);
                                        const responseVersion = extractVersionNumber(responseBuildNumber);

                                        if (!dependsVersion || !responseVersion || dependsVersion !== responseVersion) {
                                            buildIsActual = false;
                                        }
                                    }
                                }
                            }

                            const buildResult = checkStatus(response.response.data);
                            let details = "";
                            if (buildResult === cs.resultStatus.SUCCESS) {
                                details = createBuildDetailsElement(
                                    `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`,
                                    createSvgElement("M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z", "text-success"),
                                    buildIsActual
                                );
                            } else if (buildResult === cs.resultStatus.FAILURE) {
                                const buildText = response.response.data.build[0].finishOnAgentDate
                                    ? `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`
                                    : `Build in progress`;
                                details = createBuildDetailsElement(buildText,
                                    createSvgElement("M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z", "text-danger"),
                                    buildIsActual
                                );
                            } else if (buildResult === cs.resultStatus.RUNNING) {
                                details = createBuildDetailsElement(
                                    "Build in progress",
                                    createSvgElement("M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z", "text-warning"),
                                    buildIsActual
                                );
                            } else if (buildResult === cs.resultStatus.QUEUED) {
                                details = createBuildDetailsElement(
                                    "Build in queue",
                                    createSvgElement("M13 3.07v-2H3v2A5 5 0 0 0 7.65 8 5 5 0 0 0 3 13v2h10v-2a5 5 0 0 0-4.65-5A5 5 0 0 0 13 3.07zm-8.6-.6h7.2v.6a3.67 3.67 0 0 1-.14.93H4.54a3.67 3.67 0 0 1-.14-.93zM11.6 13v.6H4.4V13a3.6 3.6 0 0 1 7.2 0z", "")
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
                            label.innerHTML = `<a class="" href="${response.response.data.count === 0 ? defaultHref : response.response.data.build[0].webUrl}" target="_blank">${Name}</a>`;
                            item.appendChild(label);

                            const configurations = document.createElement("div");
                            configurations.classList.add("gl--flex-full");
                            configurations.classList.add("gl-display-flex");
                            configurations.classList.add("gl-align-items-center");
                            configurations.classList.add("gl-line-height-20");
                            configurations.classList.add("gl-text-gray-900");
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
                appendErrorElement(labelsElement, 'isRequestError', 'Failed to connect to the server', "Please verify connection settings in 'Options' page.", 'text-danger');
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
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="vertical-align-sub ${extraClasses}">
        <path d="${path}"></path>
      </svg>`;
}

function createBuildDetailsElement(text, svgElement = '', buildIsActual = true) {
    const buildIsActualText = buildIsActual ? '' :
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
        <title>Build is outdated</title>
        <polygon points="12,1 1,23 23,23" fill="none" stroke="#ab6100"/>
        <line x1="12" y1="6" x2="12" y2="15" stroke="#ab6100" stroke-width="1.5"/>
        <circle cx="12" cy="18" r="1" fill="#ab6100" />
      </svg>`;

    return `
    <div class="gl-text-gray-500 text-1">
        ${text}
        ${svgElement}
        ${buildIsActualText}
    </div>
    <button class="Button Button--link btn gl-ml-auto btn-default btn-sm gl-button">
        <span class="Button-label gl-button-text text-1">Run</span>
    </button>`;
}

function addBuildInTeamCityMenu() {
    const buildSetting = cs.getRepoBuildSetting();
    if (!buildSetting) {
        return;
    }

    const tryToAddMenu = setInterval(() => {
        const projectsMenu = document.getElementById('milestone-edit');
        if (projectsMenu) {
            clearInterval(tryToAddMenu);

            const parent = projectsMenu.closest('.milestone');
            const sidebarItem = createSidebarItem();
            const detailsElement = createDetailsElement();
            const summaryElement = createSummaryElement();
            const labelsElement = createLabelsElement(buildSetting);

            addScrollToForm(parent);

            detailsElement.appendChild(summaryElement);
            sidebarItem.appendChild(detailsElement);
            sidebarItem.appendChild(labelsElement);
            parent.parentNode.insertBefore(sidebarItem, parent);
        }
    }, 500);
}

function addScrollToForm(element) {
    const form = element.closest('form.issuable-context-form');
    form.style.overflowY = 'auto';
    form.style.paddingLeft = '0px';
}

function handleBuildButtonClick(event, { BuildType, pull }) {
    event.preventDefault();
    const button = event.target.closest('.Button--link');
    if (!button) return;
    button.disabled = true;
    button.querySelector('.Button-label').textContent = 'Started';
    chrome.runtime.sendMessage({
        command: cs.command.RUN_BUILD,
        buildType: BuildType,
        pull: pull
    }, function (response) {
        if (response.state === "queued") {
            button.querySelector('.Button-label').textContent = 'In queue';
        }
    });
}

function formatDate(inputDate) {
    try {
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
        const date = new Date(year, month - 1, day, hours, minutes, seconds);

        const dayFormatted = date.getDate().toString().padStart(2, '0');
        const monthFormatted = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
        const yearFormatted = date.getFullYear().toString().slice(2);
        const hoursFormatted = date.getHours().toString().padStart(2, '0');
        const minutesFormatted = date.getMinutes().toString().padStart(2, '0');
        return `${dayFormatted} ${monthFormatted} ${yearFormatted} ${hoursFormatted}:${minutesFormatted}`;
    } catch (error) {
        console.error(error);
        return inputDate;
    }
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
            return cs.resultStatus.RUNNING
        case (state === "queued"):
            return cs.resultStatus.QUEUED;
        case (status === "FAILURE"):
            return cs.resultStatus.FAILURE;
        default:
            throw new Error(`Unknown status: ${status} or state: ${state}`);
    }
}

function extractVersionNumber(string) {
    if (!string) {
        return null;
    }
    const match = string.match(/(\d+\.\d+\.\d+)/);
    return match ? match[0] : null;
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
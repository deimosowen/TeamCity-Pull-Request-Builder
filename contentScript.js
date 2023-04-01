const ResultStatus = {
    SUCCESS: "SUCCESS",
    RUNNING: "RUNNING",
    FAILURE: "FAILURE",
    INVALID_INPUT: "INVALID INPUT",
};

function init() {
    if (isCleanUrl()) {
        addBuildInTeamCityMenu();
    }
}

function getPullNumberFromURL() {
    return parseInt(window.location.href.match(/\/(\d+)(#|$)/)[1], 10);
}

function isCleanUrl() {
    const regex = /\/(\d+\/?)?$/;
    const path = window.location.pathname;
    const hostname = window.location.hostname;
    const isCorrectHost = (hostname === 'github.com' && path.startsWith('/Keepteam/CasePro'));
    return isCorrectHost && regex.test(path);
}

function createSidebarItem() {
    const sidebarItem = document.createElement("div");
    sidebarItem.classList.add("discussion-sidebar-item", "js-discussion-sidebar-item");
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

function createLabelsElement(labelsData) {
    const pull = getPullNumberFromURL();
    const labelsElement = document.createElement("div");
    labelsElement.classList.add("flex-wrap");
    labelsElement.classList.add("sidebar-assignee");
    labelsElement.addEventListener('click', handleBuildButtonClick);

    for (const data of labelsData) {
        chrome.runtime.sendMessage({
            command: 'getBuild',
            isLinux: data.isLinux,
            pull: pull
        }, function (response) {
            if (response.response.isAuthorized === false) {
                const isNeedAuthorized = document.getElementById('isNeedAuthorized');
                if (isNeedAuthorized === null) {
                    const label = document.createElement("p");
                    label.innerHTML = `
                <span class="d-flex min-width-0 flex-1 js-hovercard-left" id="isNeedAuthorized">
                  <a class="Link--primary assignee text-center" href="https://ci.parcsis.org/login.html" target="_blank"style="width: 100%;">
                  <div>You are not authorized</div>
                    <div class="Link--primary v-align-middle">Log in to TeamCity</div>
                  </a>
                </span>`;
                    labelsElement.appendChild(label);
                }
                return;
            }
            const buildResult = checkStatus(response.response.data);
            let details = "";

            if (buildResult === ResultStatus.SUCCESS) {
                details = createBuildDetailsElement(
                    `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`,
                    createSvgElement("M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z", "octicon-check color-fg-success")
                );
            } else if (buildResult === ResultStatus.FAILURE) {
                details = createBuildDetailsElement(
                    `Last build: ${formatDate(response.response.data.build[0].finishOnAgentDate)}`,
                    createSvgElement("M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z", "octicon-x color-fg-danger")
                );
            } else if (buildResult === ResultStatus.RUNNING) {
                details = createBuildDetailsElement(
                    "Build in progress",
                    createSvgElement("M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z", "octicon-x hx_dot-fill-pending-icon")
                );
            }

            const label = document.createElement("p");
            label.dataset.isLinux = data.isLinux;
            label.innerHTML = `
            <span class="float-right position-relative">
              <button class="Button Button--link">
                <span class="Button-content">
                  <span class="Button-label">Run Build</span>
                </span>
              </button>
            </span>
            <span class="d-flex min-width-0 flex-1 js-hovercard-left">
              <a class="Link--primary assignee" href="${response.response.data.count === 0 ? data.href : response.response.data.build[0].webUrl}" target="_blank">
                <div class="Link--primary v-align-middle">${data.text}</div>
                ${details}
              </a>
            </span>`;
            labelsElement.appendChild(label);
        });
    };

    return labelsElement;
}

function createSvgElement(path, extraClasses) {
    return `
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon ${extraClasses}">
        <path d="${path}"></path>
      </svg>`;
}

function createBuildDetailsElement(text, svgElement) {
    return `
      <div class="color-fg-muted reason text-small text-normal v-align-middle">
        ${text}
        ${svgElement}
      </div>`;
}

function addBuildInTeamCityMenu() {
    const projectsMenu = document.getElementById('projects-select-menu');
    const parent = projectsMenu.closest('.discussion-sidebar-item.js-discussion-sidebar-item');
    const labelsData = [
        { text: 'CasePro pull requests', isLinux: false, href: 'https://ci.parcsis.org/buildConfiguration/CasePro_Pulls_CaseProBuildPullSite?mode=builds#all-projects' },
        { text: 'CasePro pull requests (Linux)', isLinux: true, href: 'https://ci.parcsis.org/buildConfiguration/CasePro_Linux_BuildDockerImagesPulls?mode=builds#all-projects' },
    ];

    const sidebarItem = createSidebarItem();
    const detailsElement = createDetailsElement();
    const summaryElement = createSummaryElement();
    const labelsElement = createLabelsElement(labelsData);

    detailsElement.appendChild(summaryElement);
    sidebarItem.appendChild(detailsElement);
    sidebarItem.appendChild(labelsElement);
    parent.parentNode.insertBefore(sidebarItem, parent);
}

function handleBuildButtonClick(event) {
    const button = event.target.closest('.Button--link');
    if (!button) return;
    event.preventDefault();
    const isLinux = button.closest('p').dataset.isLinux === 'true';
    const pull = getPullNumberFromURL();

    button.disabled = true;
    button.querySelector('.Button-label').textContent = 'Build started';
    chrome.runtime.sendMessage({
        command: 'runBuild',
        isLinux: isLinux,
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
        return ResultStatus.NOTBUILDS;
    }

    const status = response.build[0].status;
    const state = response.build[0].state;

    if (status === "SUCCESS" && state === "finished") {
        return ResultStatus.SUCCESS;
    } else if (status === "SUCCESS" && state === "running") {
        return ResultStatus.RUNNING;
    } else if (status === "FAILURE" && state === "finished") {
        return ResultStatus.FAILURE;
    }
}

window.addEventListener('load', () => {
    init();
});

chrome.runtime.onMessage.addListener(({ type }) => {
    if (type === 'OPEN_PULL') {
        setTimeout(() => init(), 1000);
    }
});
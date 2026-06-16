const PasswordMasker = {
    mask: "********",

    isMasked(password) {
        return password === this.mask;
    },

    applyMask(password) {
        return password ? this.mask : "";
    },

    unmask(current, original = "") {
        return this.isMasked(current) ? original : current;
    }
};

const state = {
    config: null,
    originalPassword: "",
    isRendering: false,
    activeTab: "ui"
};

const elements = {
    save: document.getElementById("saveConfig"),
    setDefault: document.getElementById("setDefault"),
    status: document.getElementById("statusMessage"),
    tabUi: document.getElementById("tabUi"),
    tabJson: document.getElementById("tabJson"),
    uiPanel: document.getElementById("uiPanel"),
    jsonPanel: document.getElementById("jsonPanel"),
    form: document.getElementById("configForm"),
    addRepository: document.getElementById("addRepository"),
    repositoryEditor: document.getElementById("repositoryEditor"),
    json: document.getElementById("optionsJson"),
    baseUrl: document.getElementById("optBaseUrl"),
    username: document.getElementById("optUsername"),
    password: document.getElementById("optPassword"),
    headingBorder: document.getElementById("optHeadingBorder")
};

const requiredFields = ["BaseUrl", "Username", "Password", "Repository"];

async function init() {
    elements.save.addEventListener("click", saveConfig);
    elements.setDefault.addEventListener("click", loadExample);
    elements.addRepository.addEventListener("click", () => {
        addRepositoryElement("MyRepo", []);
        syncFromUi("Repository added");
    });
    elements.form.addEventListener("input", () => syncFromUi());
    elements.form.addEventListener("change", () => syncFromUi());
    elements.json.addEventListener("input", syncFromJson);
    elements.tabUi.addEventListener("click", () => setActiveTab("ui"));
    elements.tabJson.addEventListener("click", () => setActiveTab("json"));

    const config = await getStoredConfig() || getDefaultConfig();
    state.originalPassword = config.Password || "";
    renderAll(config);
    setStatus("Ready", "muted");
}

async function getStoredConfig() {
    const { config } = await chrome.storage.local.get(["config"]);
    return config;
}

function getDefaultConfig() {
    return {
        BaseUrl: "https://yourteamcityserver.com/",
        Username: "MyLogin",
        Password: "MyPassword",
        Repository: {
            MyRepo: [
                {
                    BuildType: "Build_Type",
                    Name: "Build"
                },
                {
                    BuildType: "Tests_0",
                    Name: "Tests 0",
                    Group: "Tests",
                    Order: 1,
                    Depends: "Build_Type"
                }
            ]
        }
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function toDisplayConfig(config) {
    const displayConfig = {
        BaseUrl: config.BaseUrl || "",
        Username: config.Username || "",
        Password: PasswordMasker.applyMask(config.Password),
        Repository: config.Repository || {}
    };

    if (config.HeadingBorder === true) {
        displayConfig.HeadingBorder = true;
    }

    return displayConfig;
}

function normalizeConfig(config) {
    const normalized = {
        BaseUrl: config.BaseUrl || "",
        Username: config.Username || "",
        Password: config.Password || "",
        Repository: config.Repository || {}
    };

    if (config.HeadingBorder === true) {
        normalized.HeadingBorder = true;
    }

    return normalized;
}

function renderAll(config) {
    state.isRendering = true;
    state.config = normalizeConfig(clone(config));
    renderForm(state.config);
    renderJson(state.config);
    state.isRendering = false;
}

function renderForm(config) {
    const displayConfig = toDisplayConfig(config);
    elements.baseUrl.value = displayConfig.BaseUrl;
    elements.username.value = displayConfig.Username;
    elements.password.value = displayConfig.Password;
    elements.headingBorder.checked = displayConfig.HeadingBorder === true;
    elements.repositoryEditor.replaceChildren();

    Object.entries(displayConfig.Repository).forEach(([repoName, builds]) => {
        addRepositoryElement(repoName, builds);
    });
}

function renderJson(config) {
    elements.json.value = JSON.stringify(toDisplayConfig(config), null, 4);
}

function setActiveTab(tab) {
    state.activeTab = tab;
    const isUi = tab === "ui";
    elements.tabUi.classList.toggle("is-active", isUi);
    elements.tabJson.classList.toggle("is-active", !isUi);
    elements.tabUi.setAttribute("aria-selected", String(isUi));
    elements.tabJson.setAttribute("aria-selected", String(!isUi));
    elements.uiPanel.hidden = !isUi;
    elements.jsonPanel.hidden = isUi;
    elements.uiPanel.classList.toggle("is-active", isUi);
    elements.jsonPanel.classList.toggle("is-active", !isUi);
}

function syncFromUi(message = "Synced") {
    if (state.isRendering) {
        return;
    }

    state.config = collectConfigFromForm();
    state.isRendering = true;
    renderJson(state.config);
    state.isRendering = false;
    setStatus(message, "muted");
}

function syncFromJson() {
    if (state.isRendering) {
        return;
    }

    try {
        const parsed = JSON.parse(elements.json.value);
        const validation = validateConfig(parsed);
        if (!validation.ok) {
            setStatus(validation.message, "danger");
            return;
        }

        state.config = normalizeConfig(parsed);
        state.isRendering = true;
        renderForm(state.config);
        state.isRendering = false;
        setStatus("JSON synced", "muted");
    } catch {
        setStatus("JSON is not valid", "danger");
    }
}

function collectConfigFromForm() {
    const repository = {};
    elements.repositoryEditor.querySelectorAll(".repo-item").forEach(repoItem => {
        const repoName = repoItem.querySelector(".repo-name").value.trim();
        if (!repoName) {
            return;
        }

        repository[repoName] = [];
        repoItem.querySelectorAll(".build-item").forEach(buildItem => {
            const build = {};
            const buildType = buildItem.querySelector(".build-type").value.trim();
            const name = buildItem.querySelector(".build-name").value.trim();
            const group = buildItem.querySelector(".build-group").value.trim();
            const order = buildItem.querySelector(".build-order").value;
            const branchPrefix = buildItem.querySelector(".build-branch-prefix").value.trim();
            const depends = buildItem.querySelector(".build-depends").value.trim();

            if (buildType) {
                build.BuildType = buildType;
            }
            if (name) {
                build.Name = name;
            }
            if (group) {
                build.Group = group;
            }
            if (order !== "") {
                build.Order = Number(order);
            }
            if (branchPrefix) {
                build.BranchPrefix = branchPrefix;
            }
            if (depends) {
                build.Depends = depends;
            }

            repository[repoName].push(build);
        });
    });

    const config = {
        BaseUrl: elements.baseUrl.value.trim(),
        Username: elements.username.value.trim(),
        Password: elements.password.value,
        Repository: repository
    };

    if (elements.headingBorder.checked) {
        config.HeadingBorder = true;
    }

    return config;
}

function validateConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return { ok: false, message: "Config must be an object" };
    }

    for (const field of requiredFields) {
        if (!(field in config)) {
            return { ok: false, message: `Missing required field: ${field}` };
        }
    }

    if (!config.Repository || typeof config.Repository !== "object" || Array.isArray(config.Repository)) {
        return { ok: false, message: "Repository must be an object" };
    }

    for (const [repoName, builds] of Object.entries(config.Repository)) {
        if (!repoName || !Array.isArray(builds)) {
            return { ok: false, message: "Each repository must contain a build array" };
        }
        for (const build of builds) {
            if (!build || typeof build !== "object" || !build.BuildType || !build.Name) {
                return { ok: false, message: "Each build must contain BuildType and Name" };
            }
        }
    }

    return { ok: true, message: "" };
}

async function saveConfig() {
    const config = state.activeTab === "json" ? parseJsonForSave() : collectConfigFromForm();
    if (!config) {
        return;
    }

    const validation = validateConfig(config);
    if (!validation.ok) {
        setStatus(validation.message, "danger");
        return;
    }

    const currentConfig = await getStoredConfig();
    const newConfig = normalizeConfig(config);
    newConfig.Password = PasswordMasker.unmask(newConfig.Password, state.originalPassword || currentConfig?.Password);
    if (newConfig.BaseUrl && !newConfig.BaseUrl.endsWith("/")) {
        newConfig.BaseUrl += "/";
    }

    await chrome.storage.local.set({ config: newConfig });
    state.originalPassword = newConfig.Password || "";

    if (currentConfig?.Username !== newConfig.Username || currentConfig?.Password !== newConfig.Password) {
        chrome.runtime.sendMessage({ command: "reloadConfig" });
    }

    renderAll(newConfig);
    setStatus("Saved", "success");
}

function parseJsonForSave() {
    try {
        return JSON.parse(elements.json.value);
    } catch {
        setStatus("JSON is not valid", "danger");
        return null;
    }
}

function loadExample() {
    const config = getDefaultConfig();
    state.originalPassword = config.Password;
    renderAll(config);
    setStatus("Example loaded", "muted");
}

function addRepositoryElement(repoName, builds) {
    const repoItem = document.createElement("section");
    repoItem.className = "repo-item";

    const header = document.createElement("div");
    header.className = "repo-header";

    const repoNameField = createField("Repository", "repo-name", repoName || "");
    header.appendChild(repoNameField);

    const actions = document.createElement("div");
    actions.className = "repo-actions";

    const addBuild = document.createElement("button");
    addBuild.type = "button";
    addBuild.className = "button button-secondary";
    addBuild.textContent = "Add build";
    actions.appendChild(addBuild);

    const removeRepo = document.createElement("button");
    removeRepo.type = "button";
    removeRepo.className = "button button-danger";
    removeRepo.textContent = "Remove";
    actions.appendChild(removeRepo);
    header.appendChild(actions);

    const buildsContainer = document.createElement("div");
    buildsContainer.className = "builds-container";

    addBuild.addEventListener("click", () => {
        addBuildElement(buildsContainer, {});
        syncFromUi("Build added");
    });
    removeRepo.addEventListener("click", () => {
        repoItem.remove();
        syncFromUi("Repository removed");
    });

    repoItem.appendChild(header);
    repoItem.appendChild(buildsContainer);
    elements.repositoryEditor.appendChild(repoItem);

    const buildList = Array.isArray(builds) ? builds : [];
    if (buildList.length === 0) {
        addBuildElement(buildsContainer, {});
    } else {
        buildList.forEach(build => addBuildElement(buildsContainer, build));
    }
}

function addBuildElement(container, build) {
    const buildItem = document.createElement("div");
    buildItem.className = "build-item";

    buildItem.appendChild(createField("Build type", "build-type", build.BuildType || ""));
    buildItem.appendChild(createField("Name", "build-name", build.Name || ""));
    buildItem.appendChild(createField("Group", "build-group", build.Group || ""));
    buildItem.appendChild(createField("Order", "build-order", build.Order ?? "", "number"));
    buildItem.appendChild(createField("Branch prefix", "build-branch-prefix", build.BranchPrefix || ""));
    buildItem.appendChild(createField("Depends", "build-depends", build.Depends || ""));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.title = "Remove build";
    remove.setAttribute("aria-label", "Remove build");
    remove.appendChild(createTrashIcon());
    remove.addEventListener("click", () => {
        buildItem.remove();
        syncFromUi("Build removed");
    });
    buildItem.appendChild(remove);

    container.appendChild(buildItem);
}

function createField(label, className, value, type = "text") {
    const field = document.createElement("label");
    field.className = "field";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const input = document.createElement("input");
    input.className = className;
    input.type = type;
    input.value = value;

    field.appendChild(labelElement);
    field.appendChild(input);
    return field;
}

function createTrashIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M6.5 1.75A.75.75 0 0 1 7.25 1h1.5a.75.75 0 0 1 .75.75V2.5H13a.75.75 0 0 1 0 1.5h-.55l-.62 9.3A1.75 1.75 0 0 1 10.08 15H5.92a1.75 1.75 0 0 1-1.75-1.7L3.55 4H3a.75.75 0 0 1 0-1.5h3.5v-.75ZM5.05 4l.62 9.2a.25.25 0 0 0 .25.3h4.16a.25.25 0 0 0 .25-.3L10.95 4h-5.9Z");
    svg.appendChild(path);
    return svg;
}

function setStatus(message, type) {
    elements.status.className = "status-message";
    if (type === "success") {
        elements.status.classList.add("is-success");
    }
    if (type === "danger") {
        elements.status.classList.add("is-danger");
    }
    elements.status.textContent = message;
}

init();

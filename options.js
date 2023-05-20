const options = {
    fields: ["BaseUrl", "Username", "Password", "Repository"],
    elements: {
        btnPrettifyJson: document.getElementById('prettifyJson'),
        btnSaveJson: document.getElementById('saveJson'),
        btnSetDefault: document.getElementById('setDefault'),
        optionsJson: document.getElementById('optionsJson'),
        notificationContainer: document.getElementById('notification'),
    },
    init: async () => {
        options.elements.btnPrettifyJson.addEventListener('click', () => {
            options.validConfig();
        });
        options.elements.btnSaveJson.addEventListener('click', async () => {
            await options.saveConfig();
        });
        options.elements.btnSetDefault.addEventListener('click', async () => {
            const config = await options.setDefaultConfig();
            const formattedJSON = JSON.stringify(config, undefined, 4);
            options.elements.optionsJson.value = formattedJSON;
        });
        await options.loadConfig();
        options.help();
    },
    getConfig: async () => {
        const { config } = await chrome.storage.local.get(["config"]);
        return config;
    },
    loadConfig: async () => {
        try {
            let config = await options.getConfig();
            if (!config) {
                config = await options.setDefaultConfig();
            }
            let sortedJsonObj = {};
            for (let i = 0; i < options.fields.length; i++) {
                if (options.fields[i] in config) {
                    sortedJsonObj[options.fields[i]] = config[options.fields[i]];
                }
            }
            const formattedJSON = JSON.stringify(sortedJsonObj, undefined, 4);
            options.elements.optionsJson.value = formattedJSON;
        }
        catch (err) {
            options.createNotify('is-danger', 'Invalid JSON structure');
            console.error(err);
        }
    },
    saveConfig: async () => {
        if (options.validConfig()) {
            const jsonText = options.elements.optionsJson.value;
            const parsedJSON = JSON.parse(jsonText);
            if (parsedJSON.BaseUrl && !parsedJSON.BaseUrl.endsWith("/")) {
                parsedJSON.BaseUrl += "/";
            }
            await chrome.storage.local.set({ config: parsedJSON });
            chrome.runtime.sendMessage({ command: 'reloadConfig' });
            options.createNotify('is-success', 'Data saved successfully');
        }
    },
    setDefaultConfig: async () => {
        const defaultConfig = {
            "BaseUrl": "https://yourteamcityserver.com/",
            "Username": "MyLogin",
            "Password": "MyPassword",
            "Repository": {
                "MyRepo": [
                    {
                        "BuildType": "Tests_0",
                        "Name": "tests 0"
                    },
                    {
                        "BuildType": "Tests_1",
                        "Name": "tests 1"
                    }
                ]
            }
        };
        return defaultConfig;
    },
    validConfig: () => {
        try {
            const jsonText = options.elements.optionsJson.value;
            const parsedJSON = JSON.parse(jsonText);
            for (const field of options.fields) {
                if (!(field in parsedJSON)) {
                    options.createNotify('is-danger', `Missing required field: ${field}`);
                    return false;
                }
            }
            const formattedJSON = JSON.stringify(parsedJSON, null, 4);
            options.elements.optionsJson.value = formattedJSON;
            options.createNotify('is-success', 'Valid JSON structure');
            return true;
        } catch {
            options.createNotify('is-danger', 'Invalid JSON structure');
            return false;
        }
    },
    createNotify: (style, message) => {
        options.elements.notificationContainer.innerHTML = '';
        const columns = document.createElement('div');
        columns.className = 'columns';
        const column = document.createElement('div');
        column.className = 'column is-three-fifths';
        const notification = document.createElement('div');
        notification.className = `notification ${style} is-light`;
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete';
        deleteButton.addEventListener('click', () => {
            options.elements.notificationContainer.removeChild(columns);
        });
        const messageText = document.createTextNode(message);
        notification.appendChild(deleteButton);
        notification.appendChild(messageText);
        column.appendChild(notification);
        columns.appendChild(column);
        options.elements.notificationContainer.appendChild(columns);
    },
    help: () => {
        document.addEventListener('DOMContentLoaded', () => {
            function openModal($el) {
                $el.classList.add('is-active');
            }

            function closeModal($el) {
                $el.classList.remove('is-active');
            }

            function closeAllModals() {
                (document.querySelectorAll('.modal') || []).forEach(($modal) => {
                    closeModal($modal);
                });
            }

            (document.querySelectorAll('.js-modal-trigger') || []).forEach(($trigger) => {
                const modal = $trigger.dataset.target;
                const $target = document.getElementById(modal);
                $trigger.addEventListener('click', () => {
                    openModal($target);
                });
            });

            (document.querySelectorAll('.modal-background, .modal-close, .modal-card-head .delete, .modal-card-foot .button') || []).forEach(($close) => {
                const $target = $close.closest('.modal');
                $close.addEventListener('click', () => {
                    closeModal($target);
                });
            });

            document.addEventListener('keydown', (event) => {
                const e = event || window.event;
                if (e.keyCode === 27) {
                    closeAllModals();
                }
            });
        });
    }
};

options.init();
const options = {
    elements: {
        btnPrettifyJson: document.getElementById('prettifyJson'),
        btnSaveJson: document.getElementById('saveJson'),
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
        await options.loadConfig();
    },
    getConfig: async () => {
        const { config } = await chrome.storage.session.get(["config"]);
        return config;
    },
    loadConfig: async () => {
        const config = await options.getConfig();
        const formattedJSON = JSON.stringify(config, undefined, 4);
        options.elements.optionsJson.value = formattedJSON;
    },
    saveConfig: async () => {
        if (options.validConfig()) {
            const jsonText = options.elements.optionsJson.value;
            const parsedJSON = JSON.parse(jsonText);
            await chrome.storage.session.set({ config: parsedJSON });
            options.createNotify('is-success', 'Data saved successfully');
        }
    },
    validConfig: () => {
        try {
            const jsonText = options.elements.optionsJson.value;
            const parsedJSON = JSON.parse(jsonText);
            const formattedJSON = JSON.stringify(parsedJSON, undefined, 4);
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
    }
};

options.init();
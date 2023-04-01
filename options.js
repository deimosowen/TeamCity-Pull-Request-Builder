const options = {
    config: {},

    init: () => {
        const prettifyJson = document.getElementById('prettifyJson');
        prettifyJson.addEventListener('click', () => {
            const optionsJson = document.getElementById('optionsJson');
            const jsonText = optionsJson.value;
            const parsedJSON = JSON.parse(jsonText);
            const formattedJSON = JSON.stringify(parsedJSON, undefined, 4);
            optionsJson.value = formattedJSON;
        });
    },

    loadConfig: () => {

    },

    saveConfig: () => {

    }
};

options.init();
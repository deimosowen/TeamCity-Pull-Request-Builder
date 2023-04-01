const version = chrome.runtime.getManifest().version;
const formGroup = document.querySelector('.form-group');
const summary = document.getElementById('summary');

const linkElem = document.createElement('a');

linkElem.href = 'https://github.com/deimosowen/TeamCity-Pull-Request-Builder';
linkElem.innerHTML = '<span>GitHub Repository</span>';
linkElem.target = '_blank';
linkElem.classList.add('button', 'is-ghost');
summary.appendChild(linkElem);

const versionElem = document.createElement('p');
versionElem.innerText = `Version: ${version}`;
versionElem.classList.add('pr-2');
summary.appendChild(versionElem);

document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html' });
});
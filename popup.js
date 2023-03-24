const version = chrome.runtime.getManifest().version;
const formGroup = document.querySelector('.form-group');

const versionElem = document.createElement('p');
versionElem.innerText = `Version: ${version}`;
versionElem.style.color = 'gray';
versionElem.style.marginLeft = '10px';
formGroup.appendChild(versionElem);

const linkElem = document.createElement('a');
linkElem.href = 'https://github.com/deimosowen/TeamCity-Pull-Request-Builder';
linkElem.innerText = 'GitHub Repository';
linkElem.style.color = 'gray';
linkElem.style.marginLeft = '10px';
linkElem.target = '_blank';
formGroup.appendChild(linkElem);
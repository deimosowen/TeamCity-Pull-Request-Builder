const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const utils = require("../tc-utils");

const source = fs.readFileSync(path.join(__dirname, "../contentScript.js"), "utf8");
const sidebar = (section = '<div class="block milestone" data-testid="sidebar-milestones"></div>') =>
    `<aside class="right-sidebar" data-testid="issuable-sidebar"><form class="issuable-context-form">${section}</form></aside>`;
const settle = () => new Promise(resolve => setTimeout(resolve, 180));

async function setup(t, html, { afterLoad = false, deferBuilds = false } = {}) {
    const dom = new JSDOM(`<body data-page-type-id="999">${html}</body>`, {
        url: "https://gitlab.pravo.tech/group/repo/-/merge_requests/12",
        runScripts: "outside-only"
    });
    t.after(() => dom.window.close());
    const { window } = dom;
    const requests = [];
    const pending = [];
    let onMessage;
    let resolveConfig;
    window.TcPrbUtils = utils;
    window.chrome = {
        storage: { local: { get: () => new Promise(resolve => { resolveConfig = resolve; }) } },
        runtime: {
            onMessage: { addListener: listener => { onMessage = listener; } },
            sendMessage(message, callback) {
                requests.push(message);
                const reply = () => callback({ response: {
                    isAuthorized: true,
                    data: message.command === "runBuild" ? { state: "queued" } : {
                        count: 1, build: [{ state: "finished", status: "SUCCESS", number: "1.0.0" }]
                    }
                } });
                if (deferBuilds) pending.push(reply);
                else reply();
            }
        }
    };
    window.eval(source.replace(/cs\.init\(\);\s*$/, "window.testReady = cs.init();"));
    if (afterLoad && window.document.readyState !== "complete") {
        await new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
    }
    resolveConfig({ config: {
        BaseUrl: "https://teamcity.example/", Username: "test", Password: "test",
        Repository: { repo: [{ BuildType: "Build", Name: "Build" }] }
    } });
    await window.testReady;
    await settle();
    return {
        window, document: window.document, requests, pending,
        navigate(pathname) {
            window.history.pushState({}, "", pathname);
            onMessage({ type: "OPEN_PULL" });
        }
    };
}

test("GitLab 19 sidebar mounts without an Edit button even after window.load", async t => {
    const { document, requests } = await setup(t, sidebar(), { afterLoad: true });
    const panel = document.getElementById("root-build-tc-menu");
    assert.ok(panel);
    assert.equal(panel.nextElementSibling.dataset.testid, "sidebar-milestones");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].pull, 12); // URL wins over stale body metadata.
});

test("legacy milestone section is supported", async t => {
    const { document } = await setup(t, sidebar('<div class="block milestone"><button id="milestone-edit">Edit</button></div>'));
    assert.equal(document.getElementById("root-build-tc-menu").nextElementSibling.className, "block milestone");
});

test("missing milestone falls back to the sidebar form", async t => {
    const { document } = await setup(t, sidebar(""));
    assert.equal(document.getElementById("root-build-tc-menu").parentElement.tagName, "FORM");
});

test("late sidebar and replacement are detected without duplicate fetch loops", async t => {
    const { document, requests } = await setup(t, "");
    assert.equal(requests.length, 0);
    document.body.insertAdjacentHTML("beforeend", sidebar());
    await settle();
    assert.equal(document.querySelectorAll("#root-build-tc-menu").length, 1);
    document.querySelector("aside").outerHTML = sidebar();
    await settle();
    assert.equal(document.querySelectorAll("#root-build-tc-menu").length, 1);
    document.body.appendChild(document.createElement("span"));
    await settle();
    assert.equal(requests.length, 2);
});

test("navigation updates the MR, preserves it across tabs, and removes unsupported pages", async t => {
    const { document, requests, navigate, window } = await setup(t, sidebar());
    navigate("/group/repo/-/merge_requests/13");
    await settle();
    assert.equal(requests.at(-1).pull, 13);
    navigate("/group/repo/-/merge_requests/13/diffs");
    await settle();
    assert.equal(requests.length, 2);
    window.history.replaceState({}, "", "/group/repo/-/merge_requests/12");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await settle();
    assert.equal(requests.at(-1).pull, 12);
    navigate("/group/other/-/merge_requests/12");
    await settle();
    assert.equal(document.getElementById("root-build-tc-menu"), null);
    navigate("/group/repo/-/merge_requests");
    await settle();
    assert.equal(document.getElementById("root-build-tc-menu"), null);
});

test("responses for the previous MR cannot populate the new panel", async t => {
    const { document, pending, navigate } = await setup(t, sidebar(), { deferBuilds: true });
    navigate("/group/repo/-/merge_requests/13");
    await settle();
    pending[0]();
    await settle();
    assert.ok(document.querySelector("#root-build-tc-menu .tc-loader"));
    pending[1]();
    await settle();
    assert.ok(document.querySelector("#root-build-tc-menu .tc-build-row"));
});

test("Run still refreshes statuses after the idempotent mount change", async t => {
    const { document, requests } = await setup(t, sidebar());
    document.querySelector(".tc-build-button").click();
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.deepEqual(requests.map(request => request.command), ["getBuild", "runBuild", "getBuild"]);
    assert.equal(requests[1].pull, 12);
    assert.equal(document.querySelectorAll("#root-build-tc-menu").length, 1);
});

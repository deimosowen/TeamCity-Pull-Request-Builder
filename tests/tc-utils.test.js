const assert = require("node:assert/strict");
const utils = require("../tc-utils");

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test("normalizes empty response as not built", () => {
    const result = utils.normalizeBuildStatus({ count: 0, build: [] });
    assert.equal(result.status, utils.resultStatus.NOT_BUILDS);
});

test("normalizes successful finished build", () => {
    const result = utils.normalizeBuildStatus({
        count: 1,
        build: [{ status: "SUCCESS", state: "finished" }]
    });
    assert.equal(result.status, utils.resultStatus.SUCCESS);
});

test("normalizes TeamCity collect changes error as failure", () => {
    const result = utils.normalizeBuildStatus({
        count: 1,
        build: [{
            status: "UNKNOWN",
            state: "finished",
            statusText: "Unable to collect changes"
        }]
    });
    assert.equal(result.status, utils.resultStatus.FAILURE);
    assert.equal(result.label, "Unable to collect changes");
});

test("normalizes queued and running builds", () => {
    assert.equal(utils.normalizeBuildStatus({ count: 1, build: [{ state: "queued" }] }).status, utils.resultStatus.QUEUED);
    assert.equal(utils.normalizeBuildStatus({ count: 1, build: [{ status: "SUCCESS", state: "running" }] }).status, utils.resultStatus.RUNNING);
});

test("parses TeamCity date and formats duration", () => {
    const date = utils.parseTeamCityDate("20260616T180700+0300");
    assert.equal(date.toISOString(), "2026-06-16T15:07:00.000Z");
    assert.equal(utils.formatDuration(65 * 60000), "1h 05m");
    assert.equal(utils.formatDuration(59 * 1000), "<1m");
});

test("build timing uses TeamCity start and finish dates", () => {
    const timing = utils.getBuildTiming({
        startDate: "20260616T180700+0300",
        finishDate: "20260616T183900+0300"
    });
    assert.equal(timing.durationText, "32m");
    assert.equal(timing.dateText, "16 Jun 26 18:39");
});

test("extracts nested GitLab repository name", () => {
    const repo = utils.getRepoNameFromGitLabUrl("https://gitlab.pravo.tech/group/subgroup/MyRepo/-/merge_requests/123");
    assert.equal(repo, "MyRepo");
});

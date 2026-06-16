(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
    root.TcPrbUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const resultStatus = {
        SUCCESS: "SUCCESS",
        RUNNING: "RUNNING",
        FAILURE: "FAILURE",
        QUEUED: "QUEUED",
        NOT_BUILDS: "NOT_BUILDS",
        ERROR: "ERROR"
    };

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function asArray(value) {
        if (!value) {
            return [];
        }
        return Array.isArray(value) ? value : [value];
    }

    function getBuilds(response) {
        if (!response || !response.build) {
            return [];
        }
        return asArray(response.build).filter(Boolean);
    }

    function normalizeBuildStatus(response) {
        const builds = getBuilds(response);
        if (!response || Number(response.count) === 0 || builds.length === 0) {
            return {
                status: resultStatus.NOT_BUILDS,
                severity: "muted",
                label: "Build not initiated yet"
            };
        }

        const build = builds[0];
        const status = String(build.status || "").toUpperCase();
        const state = String(build.state || "").toLowerCase();
        const statusText = build.statusText || build.statusTextHtml || build.comment?.text || "";

        if (state === "queued") {
            return {
                status: resultStatus.QUEUED,
                severity: "queued",
                label: "Build in queue",
                build
            };
        }

        if (state === "running") {
            return {
                status: resultStatus.RUNNING,
                severity: "running",
                label: "Build in progress",
                build
            };
        }

        if (status === "SUCCESS" && state === "finished") {
            return {
                status: resultStatus.SUCCESS,
                severity: "success",
                label: "Successful",
                build
            };
        }

        if (status === "FAILURE" || status === "ERROR" || status === "UNKNOWN" || state === "finished") {
            return {
                status: resultStatus.FAILURE,
                severity: "failure",
                label: statusText || "Failed",
                build
            };
        }

        return {
            status: resultStatus.ERROR,
            severity: "failure",
            label: statusText || `Unknown status: ${status || "empty"} / ${state || "empty"}`,
            build
        };
    }

    function parseTeamCityDate(value) {
        if (!value || typeof value !== "string") {
            return null;
        }

        const match = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})([+-]\d{4}|Z)?$/);
        if (!match) {
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const [, year, month, day, hour, minute, second, zone = "Z"] = match;
        const normalizedZone = zone === "Z" ? "Z" : `${zone.slice(0, 3)}:${zone.slice(3)}`;
        const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedZone}`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatShortDate(inputDate) {
        const date = inputDate instanceof Date ? inputDate : parseTeamCityDate(inputDate);
        if (!date) {
            return inputDate || "";
        }

        const dayFormatted = date.getDate().toString().padStart(2, "0");
        const monthFormatted = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
        const yearFormatted = date.getFullYear().toString().slice(2);
        const hoursFormatted = date.getHours().toString().padStart(2, "0");
        const minutesFormatted = date.getMinutes().toString().padStart(2, "0");
        return `${dayFormatted} ${monthFormatted} ${yearFormatted} ${hoursFormatted}:${minutesFormatted}`;
    }

    function formatDuration(ms) {
        if (!Number.isFinite(ms) || ms < 0) {
            return "";
        }

        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
        }
        if (minutes > 0) {
            return `${minutes}m`;
        }
        return "<1m";
    }

    function getBuildTiming(build, now = new Date()) {
        if (!build) {
            return {
                dateText: "",
                durationText: ""
            };
        }

        const start = parseTeamCityDate(build.startDate || build.queuedDate);
        const finish = parseTeamCityDate(build.finishOnAgentDate || build.finishDate);
        const end = finish || now;
        const durationText = start ? formatDuration(end.getTime() - start.getTime()) : "";
        const dateSource = finish || start;

        return {
            dateText: dateSource ? formatShortDate(dateSource) : "",
            durationText
        };
    }

    function getRepoNameFromGitLabUrl(url) {
        const match = String(url).match(/^https?:\/\/[^/]+\/(.+)\/-\/merge_requests\//);
        if (!match) {
            return "";
        }
        const parts = match[1].split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
    }

    function extractVersionNumber(value) {
        if (!value) {
            return null;
        }
        const match = String(value).match(/(\d+\.\d+\.\d+)/);
        return match ? match[0] : null;
    }

    return {
        resultStatus,
        escapeRegExp,
        getBuilds,
        normalizeBuildStatus,
        parseTeamCityDate,
        formatShortDate,
        formatDuration,
        getBuildTiming,
        getRepoNameFromGitLabUrl,
        extractVersionNumber
    };
});

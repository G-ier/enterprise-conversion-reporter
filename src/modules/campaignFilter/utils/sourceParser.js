const { ConversionReporterLogger } = require("../../../shared/utils/logger");

function parseSourceString(sourceString) {
    const [moduleGroup, source, jobKey, accountName, date, hour, filename] = sourceString.split("/");
    const received_at = filename.split(".")[0];

    ConversionReporterLogger.info(`
        Source Info:
        ----------------------------------------------------
        Module Group: ${moduleGroup}
        Source: ${source}
        Job Key: ${jobKey}
        Account Name: ${accountName}
        Filename: ${filename}
        Received At: ${received_at}
        ----------------------------------------------------
    `);

    return {
        moduleGroup,
        source,
        jobKey,
        accountName,
        date,
        hour,
        filename,
        received_at
    };
}

module.exports = { parseSourceString };